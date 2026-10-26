// Differential test: paint compute() + BOQ sections 23 / 25 / 31 vs the real Excel v5 formulas (evaluated by the
// oracle) on ~50 seeded random projects. Paint reads other sheets, so every case also drives them, on both sides:
// - ฉาบปูน_Plaster (C5/C6/C13 = SUMIF of plaster E by kind; plaster E reads the brick sheet, kept at the sample),
// - ฝ้าเพดาน_Ceiling (C7–C9 = SUMIF of ceiling F by paint group),
// - ตกแต่งผนัง_Wall Finishing and มุงหลังคา_Roofing E16: only the "ใช้ค่าจาก …" suggestions for C10–C12 read them.
// Guide: docs/rebuild/ORACLE_TESTS.md.
//
// C10 `=3.3+4.8`, C11 `=(0.5*13)+(0.3*11)` and C12 `=63.2*0.23` are typed constants in Excel (oddities O-3/O-4/O-5).
// D20 (derive them from the source sheets) is NOT approved, so the app keeps them as inputs too: the test types the
// app's numbers into C10–C12 (as a user retyping them would) and checks everything downstream. No D1/D5 delta
// applies to this sheet: every comparison is exact.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import {
    ceilingExcelInputs, randomCeilingInput, randomWallFinishingInput, wallFinishingExcelInputs, WF_SHEET,
} from '../../../test-utils/oracle-finishes';
import { expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { ceiling, type CeilingInput } from '../ceiling';
import {
    PLASTER_KINDS, PLASTER_SIDES, PLASTER_WALL_PARTS, STRUCTURAL_WALL, STRUCTURAL_WALL_DEFAULT_AREA, plaster,
    type PlasterInput, type PlasterRow,
} from '../plaster';
import { FASCIA_ROW, roofing, type RoofingInput } from '../roofing';
import {
    MOULDING_0_1, MOULDING_0_3, slatArea, wallFinishing, mouldingLength, type WallFinishingInput,
} from '../wall-finishing';
import {
    applyPaintSuggestions, paint, paintLinkedSources, paintSuggestions, PAINT_LINES, type PaintInput,
} from '.';

const SHEET = 'ทาสี_Paint ';
const PLASTER = 'ฉาบปูน_Plaster';
const ROOFING = 'มุงหลังคา_Roofing';
const BOQ = 'BOQ (Home)';

// ─── Plaster mapping (rows 5–10: E = SUMIF(Brick!B, B, Brick!I)·D; row 11: E = ((1*25)+(0.8*2.6*3))·D) ───
const PLASTER_SUMIF_ROWS = [5, 6, 7, 8, 9, 10];
const PLASTER_STRUCTURE_ROW = 11;
/** The row with a typed structure area goes to row 11 (Excel's only hard-coded row); others to rows 5–10. */
const isStructureRow = (r: PlasterRow) => r.manualArea !== undefined;

function plasterExcelRows(input: PlasterInput): number[] {
    let k = 0;
    let structure = 0;
    return input.rows.map(r => {
        if (isStructureRow(r)) {
            if (r.wallPart !== STRUCTURAL_WALL || r.manualArea !== STRUCTURAL_WALL_DEFAULT_AREA || structure++ > 0) {
                throw new Error('Excel has one structure row (11) and its area is hard-coded 31.24 per side');
            }
            return PLASTER_STRUCTURE_ROW;
        }
        const row = PLASTER_SUMIF_ROWS[k++];
        if (row === undefined) throw new Error('Excel computes plaster E on rows 5–11 only');
        return row;
    });
}

function plasterExcelInputs(input: PlasterInput): Record<string, OracleInput> {
    const out: Record<string, OracleInput> = {};
    for (const row of [...PLASTER_SUMIF_ROWS, PLASTER_STRUCTURE_ROW]) for (const col of ['B', 'C', 'D']) out[`${PLASTER}!${col}${row}`] = null;
    const rows = plasterExcelRows(input);
    input.rows.forEach((r, i) => {
        const at = (col: string) => `${PLASTER}!${col}${rows[i] ?? 0}`;
        out[at('B')] = r.wallPart === '' ? null : r.wallPart;
        // Excel's dropdown option is `ฉาบภายใน ` (trailing space, oddity 5): typed verbatim, matched trimmed
        out[at('C')] = r.kind === '' ? null : r.kind === 'ฉาบภายใน' ? 'ฉาบภายใน ' : r.kind;
        out[at('D')] = r.sides;
    });
    return out;
}

// ─── One case = the inputs of every sheet paint reads + paint itself ──────────
interface PaintCase {
    plaster: PlasterInput;
    ceiling: CeilingInput;
    wallFinishing: WallFinishingInput;
    /** Roofing E16 ไม้เชิงชาย take-off lengths (roofing row FASCIA_ROW); the rest of the roof stays at the sample. */
    fascia: number[];
    paint: PaintInput;
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

function roofingInput(fascia: number[]): RoofingInput {
    const base = roofing.defaults();
    return { ...base, rows: base.rows.map((r, i) => (i === FASCIA_ROW ? { ...r, takeoff: { kind: 'lengths', lengths: fascia } } : r)) };
}

function excelInputs(c: PaintCase): Record<string, OracleInput> {
    return {
        ...plasterExcelInputs(c.plaster),
        ...ceilingExcelInputs(c.ceiling),
        ...wallFinishingExcelInputs(c.wallFinishing),
        [`${ROOFING}!E16`]: sum(c.fascia),
        // the typed lines, as the user would retype them (D20 not approved)
        [`${SHEET}!C10`]: c.paint.slatWallArea,
        [`${SHEET}!C11`]: c.paint.mouldings.reduce((s, m) => s + m.girth * m.length, 0),
        [`${SHEET}!C12`]: c.paint.fasciaLength * c.paint.fasciaHeight,
    };
}

function appResult(c: PaintCase): ProjectResult {
    const p = createProject();
    p.calculators.plaster = c.plaster;
    p.calculators.ceiling = c.ceiling;
    p.calculators['wall-finishing'] = c.wallFinishing;
    p.calculators.roofing = roofingInput(c.fascia);
    p.calculators.paint = c.paint;
    return computeProject(p);
}

// ─── Output mapping ─────────────────────────────────────────────────────────
function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    const line = PAINT_LINES.find(l => l.key === key);
    if (line) return o.num(`${SHEET}!${line.cell}`);
    if (PAINT_LINES.some(l => l.boq.includes(key))) return o.num(`${BOQ}!E${key.slice(1)}`);
    return undefined;
}

const BOQ_ROWS = PAINT_LINES.flatMap(l => l.boq.map(k => Number(k.slice(1))));
const SECTIONS: [number, number][] = [[23, 232], [25, 253], [31, 308]];

const sumifF = (o: ExcelOracle, item: string) => {
    const v = o.evaluate(`=SUMIF('${WF_SHEET}'!C:C,"${item}",'${WF_SHEET}'!F:F)`);
    if (typeof v !== 'number') throw new Error(`SUMIF ${item}: ${JSON.stringify(v)}`);
    return v;
};

// ─── Random but plausible projects ──────────────────────────────────────────
const NON_STRUCTURE_PARTS = PLASTER_WALL_PARTS.filter(p => p !== STRUCTURAL_WALL);

function randomPlaster(rng: Random): PlasterInput {
    const rows: PlasterRow[] = Array.from({ length: rng.int(0, PLASTER_SUMIF_ROWS.length) }, () => {
        const p = rng.next();
        // '' = no wall part; ผนังโครงสร้าง without a typed area = 0 on both sides (no brick row has that part)
        const wallPart = p < 0.08 ? '' : p < 0.14 ? STRUCTURAL_WALL : rng.pick(NON_STRUCTURE_PARTS);
        return { wallPart, kind: rng.chance(0.05) ? '' : rng.pick(PLASTER_KINDS), sides: rng.pick(PLASTER_SIDES) };
    });
    if (rng.chance(0.75)) {
        const at = rng.int(0, rows.length);
        rows.splice(at, 0, { wallPart: STRUCTURAL_WALL, kind: rng.pick(PLASTER_KINDS), sides: rng.pick(PLASTER_SIDES), manualArea: STRUCTURAL_WALL_DEFAULT_AREA });
    }
    return { rows };
}

function randomPaint(rng: Random, wf: WallFinishingInput, fascia: number[]): PaintInput {
    const runs = rng.pick([0, 1, 2, 2, 2, 3]);
    return {
        // sometimes taken from the wall-finishing sheet ("ใช้ค่าจาก …"), else typed
        slatWallArea: rng.chance(0.35) ? slatArea(wf) : rng.chance(0.1) ? 0 : rng.step(0, 20, 0.1),
        mouldings: Array.from({ length: runs }, () => {
            const size = rng.pick(['0.3', '0.1']);
            const item = size === '0.3' ? MOULDING_0_3 : MOULDING_0_1;
            return {
                size,
                girth: rng.chance(0.15) ? rng.step(0.1, 0.8, 0.05) : size === '0.3' ? 0.5 : 0.3,
                length: rng.chance(0.4) ? mouldingLength(wf, item) : rng.step(0, 30, 0.5),
            };
        }),
        fasciaLength: rng.chance(0.4) ? sum(fascia) : rng.step(0, 90, 0.1),
        fasciaHeight: rng.pick([0.23, 0.23, 0.2, 0.3, 0]),
    };
}

function randomCase(seed: number): PaintCase {
    const rng = seededRandom(seed);
    const wf = rng.chance(0.25) ? wallFinishing.defaults() : randomWallFinishingInput(rng);
    const fascia = rng.chance(0.25) ? [62.3] : Array.from({ length: rng.int(1, 3) }, () => rng.step(5, 40, 0.1));
    return {
        plaster: rng.chance(0.2) ? plaster.defaults() : randomPlaster(rng),
        ceiling: rng.chance(0.2) ? ceiling.defaults() : randomCeilingInput(rng),
        wallFinishing: wf,
        fascia,
        paint: randomPaint(rng, wf, fascia),
    };
}

const sampleCase = (): PaintCase => ({
    plaster: plaster.defaults(), ceiling: ceiling.defaults(), wallFinishing: wallFinishing.defaults(), fascia: [62.3], paint: paint.defaults(),
});

/** The sample with every "ใช้ค่าจาก …" applied (C10 = WF G7+G8, C11 from the WF lengths, C12 from roofing 62.3 m). */
function suggestionsApplied(): PaintCase {
    const c = sampleCase();
    const res = appResult(c);
    return { ...c, paint: applyPaintSuggestions(c.paint, paintSuggestions({ outputs: id => res.calcOutputs[id] })) };
}

const CASES: [string, PaintCase][] = [
    ['Excel sample', sampleCase()],
    ['sample with every "ใช้ค่าจาก …" applied (C12 = 62.3 × 0.23, O-5)', suggestionsApplied()],
    ['blank paint lines (paint.blank()) on the sample sheets', { ...sampleCase(), paint: paint.blank?.() ?? paint.defaults() }],
    ['no plaster, no ceiling, no wall finishing, no fascia', {
        plaster: { rows: [] }, ceiling: { rows: [] }, wallFinishing: { rows: [] }, fascia: [],
        paint: { slatWallArea: 0, mouldings: [], fasciaLength: 0, fasciaHeight: 0.23 },
    }],
    ['plaster: every part plastered both sides, the structure row inside', {
        ...sampleCase(),
        plaster: {
            rows: [
                ...NON_STRUCTURE_PARTS.map((wallPart): PlasterRow => ({ wallPart, kind: 'ฉาบภายใน', sides: 2 })),
                { wallPart: '', kind: 'ฉาบภายนอก', sides: 2 },
                { wallPart: STRUCTURAL_WALL, kind: 'ฉาบภายใน', sides: 2, manualArea: STRUCTURAL_WALL_DEFAULT_AREA },
            ],
        },
    }],
    ...Array.from({ length: 50 }, (_, k): [string, PaintCase] => [`random #${k} (seed ${19_000 + k})`, randomCase(19_000 + k)]),
];

describe('ทาสี_Paint vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...PAINT_LINES.map(l => `${SHEET}!${l.cell}`),
            ...BOQ_ROWS.flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            ...SECTIONS.flatMap(([, r]) => ['J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!E220`, `${ROOFING}!E16`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover both plaster kinds, 1 and 2 sides, the structure row, every ceiling group and typed vs taken C10–C12', () => {
        const has = (p: (c: PaintCase) => boolean) => CASES.filter(([, c]) => p(c)).length;
        for (const kind of PLASTER_KINDS) {
            for (const sides of PLASTER_SIDES) {
                expect(has(c => c.plaster.rows.some(r => r.kind === kind && r.sides === sides && r.wallPart !== '' && !isStructureRow(r))), `${kind} × ${sides}`).toBeGreaterThan(5);
            }
        }
        expect(has(c => c.plaster.rows.some(isStructureRow))).toBeGreaterThan(20);
        expect(has(c => !c.plaster.rows.some(isStructureRow))).toBeGreaterThan(5);
        expect(has(c => c.plaster.rows.some(r => r.wallPart === STRUCTURAL_WALL && !isStructureRow(r)))).toBeGreaterThan(2);
        expect(has(c => c.plaster.rows.some(r => r.wallPart === '' || r.kind === ''))).toBeGreaterThan(3);
        for (const g of ['ภายใน', 'ภายนอก', 'ไม้ระแนง'] as const) expect(has(c => c.ceiling.rows.some(r => r.paint === g)), g).toBeGreaterThan(10);
        expect(has(c => c.paint.slatWallArea === slatArea(c.wallFinishing))).toBeGreaterThan(5);
        expect(has(c => c.paint.slatWallArea !== slatArea(c.wallFinishing))).toBeGreaterThan(10);
        expect(has(c => c.paint.mouldings.length === 0)).toBeGreaterThan(3);
        expect(has(c => c.paint.mouldings.length >= 2)).toBeGreaterThan(10);
        expect(has(c => c.paint.fasciaLength === sum(c.fascia))).toBeGreaterThan(5);
        expect(has(c => c.paint.fasciaLength !== sum(c.fascia))).toBeGreaterThan(10);
        expect(has(c => c.paint.fasciaHeight === 0)).toBeGreaterThan(2);
    });

    it.each(CASES)('%s', (_name, c) => {
        oracle.replaceInputs(excelInputs(c));
        const res = appResult(c);
        const out = res.calcOutputs.paint ?? {};
        const ctx = { outputs: (id: string) => res.calcOutputs[id] };

        // 1. every output of compute() (unmapped keys fail): the 9 lines C5–C13 and the BOQ quantities
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping`);
            else expectClose(v, excel, `output ${key}`);
        }
        for (const l of PAINT_LINES) expect(l.key in out, l.key).toBe(true);
        // the lines C5–C9 come from the calculators, not from Excel's cached fallback numbers
        expect(Object.values(paintLinkedSources(ctx)).every(Boolean)).toBe(true);
        // the plaster outputs paint reads (Excel C5/C6 = SUMIF of plaster E by kind)
        expectClose(res.calcOutputs.plaster?.exterior, oracle.num(`${SHEET}!C5`), 'plaster exterior = C5');
        expectClose(res.calcOutputs.plaster?.interior, oracle.num(`${SHEET}!C6`), 'plaster interior = C6');

        // 2. the source values offered for the typed lines C10–C12 ("ใช้ค่าจาก …")
        const s = paintSuggestions(ctx);
        expectClose(s.slatWallArea, oracle.num(`${BOQ}!E220`), 'suggested C10 = SUMIF(WF!C, ระแนง, WF!G)');
        expectClose(s.mouldingLength('0.3'), sumifF(oracle, MOULDING_0_3), 'suggested บัว 0.3 length = SUMIF(WF!C, 0.3, WF!F)');
        expectClose(s.mouldingLength('0.1'), sumifF(oracle, MOULDING_0_1), 'suggested บัว 0.1 length = SUMIF(WF!C, 0.1, WF!F)');
        expect(s.mouldingLength(' ')).toBeUndefined();
        expectClose(s.fasciaLength, oracle.num(`${ROOFING}!E16`), 'suggested C12 length = Roofing E16');

        // 3. BOQ (Home): the 25 paint rows and the subtotals of §23, §25, §31
        for (const r of BOQ_ROWS) expectBoqRow(oracle, res.boq, `R${r}`, r);
        for (const [no, row] of SECTIONS) {
            const sec = res.boq.sections.find(x => x.no === no);
            expectClose(sec?.matTotal, oracle.num(`${BOQ}!J${row}`), `section ${no} J${row}`);
            expectClose(sec?.labTotal, oracle.num(`${BOQ}!L${row}`), `section ${no} L${row}`);
            expectClose(sec?.total, oracle.num(`${BOQ}!M${row}`), `section ${no} M${row}`);
        }
    });
});
