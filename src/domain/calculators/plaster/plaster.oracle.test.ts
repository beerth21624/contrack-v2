// Differential test: plaster compute() + BOQ section 18 + the paint sheet's wall areas vs the real Excel v5 formulas
// (evaluated by the oracle) on ~50 seeded random projects. The whole chain is driven on both sides:
// door/window openings → brick net areas → plaster. Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleCellInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { brickExcelInputs, doorWindowExcelInputs } from '../../../test-utils/oracle-roof-walls';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { BRICK_THICKNESSES, BRICK_TYPES, BRICK_WALL_PARTS, brick, brickOpenings, openingKey, type BrickInput, type BrickWall } from '../brick';
import { ALUMINIUM, OPENING_WALL_TYPES, WOOD, doorWindow, openingRow, type DoorWindowInput } from '../door-window';
import {
    PLASTER_KINDS, PLASTER_SIDES, PLASTER_WALL_PARTS, STRUCTURAL_WALL, STRUCTURAL_WALL_DEFAULT_AREA, plaster, plasterRowArea,
    type PlasterInput, type PlasterRow,
} from '.';

const SHEET = 'ฉาบปูน_Plaster';
const PAINT = 'ทาสี_Paint ';
const BOQ = 'BOQ (Home)';
/** Rows 5–10: E = SUMIF(Brick!B, B, Brick!I) × D. Row 11: the hard-coded structure row ((1*25)+(0.8*2.6*3))*D11. Rows 12–22: no formula. */
const SUMIF_ROWS = [5, 6, 7, 8, 9, 10];
const STRUCTURE_ROW = 11;
const NO_FORMULA_ROWS = Array.from({ length: 11 }, (_, i) => 12 + i);
/** Dropdown C5:C22, verbatim (the inside value has a trailing space; BOQ / paint SUMIF still match it trimmed). */
const KIND_EXCEL: Record<string, string> = { ฉาบภายนอก: 'ฉาบภายนอก', ฉาบภายใน: 'ฉาบภายใน ' };

interface Case { input: PlasterInput; walls: BrickInput; doors: DoorWindowInput }

// ─── Input mapping ──────────────────────────────────────────────────────────
const isStructure = (r: PlasterRow) => r.wallPart.trim() === STRUCTURAL_WALL;

/**
 * Excel row of each plaster row: a brick wall part to the next free SUMIF row (5–10), the first structure row to
 * row 11 (its typed area per side replaces the hard-coded 31.24 in E11), anything else to rows 12–22 (no formula).
 */
function excelRows(input: PlasterInput): number[] {
    let sumif = 0;
    let structure = 0;
    let rest = 0;
    return input.rows.map(r => {
        let row: number | undefined;
        if (isStructure(r) && structure++ === 0) row = STRUCTURE_ROW;
        else if (!isStructure(r) && sumif < SUMIF_ROWS.length) row = SUMIF_ROWS[sumif++];
        else row = NO_FORMULA_ROWS[rest++];
        if (row === undefined) throw new Error('Excel has 18 plaster rows (5–22)');
        return row;
    });
}

function excelInputs({ input, walls, doors }: Case): Record<string, OracleCellInput> {
    const out: Record<string, OracleCellInput> = { ...doorWindowExcelInputs(doors), ...brickExcelInputs(walls) };
    for (const row of [...SUMIF_ROWS, STRUCTURE_ROW, ...NO_FORMULA_ROWS]) for (const col of ['B', 'C', 'D']) out[`${SHEET}!${col}${row}`] = null;
    const rows = excelRows(input);
    input.rows.forEach((r, i) => {
        const row = rows[i] ?? 0;
        out[`${SHEET}!B${row}`] = r.wallPart === '' ? null : r.wallPart;
        out[`${SHEET}!C${row}`] = r.kind === '' ? null : KIND_EXCEL[r.kind.trim()] ?? r.kind;
        out[`${SHEET}!D${row}`] = r.sides;
        // the owner types the structure area per side into E11's formula (Excel: ((1*25)+(0.8*2.6*3))*D11)
        if (row === STRUCTURE_ROW && r.manualArea !== STRUCTURAL_WALL_DEFAULT_AREA) out[`${SHEET}!E11`] = { formula: `=(${r.manualArea ?? 0})*D11` };
    });
    return out;
}

// ─── D1 (brick): Excel deducts a shared opening group from every brick row of the group, the app once ──
/** Per wall part: Excel-style deduction − app deduction (brick.oracle.test.ts, brick/index.ts brickWallResults). */
function brickD1ExcessByPart(walls: BrickInput, openings: Record<string, number>): Map<string, number> {
    const out = new Map<string, number>();
    const seen = new Set<string>();
    for (const w of walls.walls) {
        const k = openingKey(w.wallPart, w.brickType, w.thickness);
        if (seen.has(k)) out.set(w.wallPart.trim(), (out.get(w.wallPart.trim()) ?? 0) + (openings[k] ?? 0));
        seen.add(k);
    }
    return out;
}

// ─── Random but plausible projects ──────────────────────────────────────────
const NON_STRUCTURAL = PLASTER_WALL_PARTS.filter(p => p !== STRUCTURAL_WALL);

function randomWalls(rng: Random): BrickInput {
    const wall = (shape: 'rect' | 'triangle'): BrickWall => {
        const common = rng.chance(0.5);
        return {
            wallPart: rng.pick(BRICK_WALL_PARTS),
            brickType: common ? 'อิฐมอญ' : rng.pick(BRICK_TYPES),
            thickness: common ? 'ครึ่งแผ่น' : rng.pick(BRICK_THICKNESSES),
            length: shape === 'rect' ? rng.step(2, 45, 0.1) : rng.step(3, 10, 0.5),
            height: shape === 'rect' ? rng.step(2.4, 3.6, 0.05) : rng.step(1, 3.5, 0.05),
            shape,
        };
    };
    if (rng.chance(0.05)) return { walls: [] };
    return {
        walls: [
            ...Array.from({ length: rng.int(1, 3) }, () => wall('rect')),
            ...Array.from({ length: rng.pick([0, 0, 1, 2, 3, 5]) }, () => wall('triangle')),
        ],
    };
}

function randomDoors(rng: Random, walls: BrickInput): DoorWindowInput {
    // openings mostly in the walls just drawn, so the brick deduction (and its D1 sharing) reaches plaster
    const opening = (i: number, window: boolean) => {
        const w = rng.chance(0.75) && walls.walls.length > 0 ? rng.pick(walls.walls) : undefined;
        return openingRow({
            name: `${window ? 'W' : 'D'}${i + 1}-ช่องเปิด`, type: rng.pick([ALUMINIUM, ALUMINIUM, WOOD]),
            wallPart: w?.wallPart ?? rng.pick(BRICK_WALL_PARTS), brick: w?.brickType ?? rng.pick(OPENING_WALL_TYPES),
            thickness: w?.thickness ?? rng.pick(BRICK_THICKNESSES),
            count: rng.int(1, 4), width: rng.step(0.5, 2.5, 0.05), height: rng.step(0.5, 2.2, 0.05),
        });
    };
    return {
        doors: Array.from({ length: rng.int(0, 5) }, (_, i) => opening(i, false)),
        windows: Array.from({ length: rng.int(0, 4) }, (_, i) => opening(i, true)),
    };
}

function randomRows(rng: Random): PlasterRow[] {
    const n = rng.chance(0.12) ? rng.int(7, 9) : rng.int(0, 6);
    const rows: PlasterRow[] = Array.from({ length: n }, () => ({
        wallPart: rng.chance(0.04) ? '' : rng.pick(NON_STRUCTURAL),
        kind: rng.chance(0.04) ? '' : rng.pick(PLASTER_KINDS),
        sides: rng.pick(PLASTER_SIDES),
    }));
    const structures = rng.chance(0.1) ? 2 : rng.chance(0.7) ? 1 : 0;
    for (let s = 0; s < structures; s++) {
        const area = rng.chance(0.3) ? STRUCTURAL_WALL_DEFAULT_AREA : rng.step(0, 80, 0.01);
        rows.splice(rng.int(0, rows.length), 0, { wallPart: STRUCTURAL_WALL, kind: rng.pick(PLASTER_KINDS), sides: rng.pick(PLASTER_SIDES), manualArea: area });
    }
    return rows;
}

function randomCase(seed: number): Case {
    const rng = seededRandom(seed);
    const walls = rng.chance(0.15) ? brick.defaults() : randomWalls(rng);
    const doors = rng.chance(0.15) ? doorWindow.defaults() : randomDoors(rng, walls);
    return { input: { rows: randomRows(rng) }, walls, doors };
}

const sample: Case = { input: plaster.defaults(), walls: brick.defaults(), doors: doorWindow.defaults() };
const sharedGroup: BrickInput = {
    walls: [
        { wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 30, height: 3.5, shape: 'rect' },
        { wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 12.5, height: 3.5, shape: 'rect' },
        { wallPart: 'ผนังภายในบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 26.7, height: 3.5, shape: 'rect' },
        { wallPart: 'ผนังภายในบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 6, height: 2.65, shape: 'triangle' },
    ],
};
const sampleRows = plaster.defaults().rows;
const CASES: [string, Case][] = [
    ['Excel sample', sample],
    ['blank plaster rules (structure area 0)', { ...sample, input: plaster.blank?.() ?? sample.input }],
    ['no plaster rows', { ...sample, input: { rows: [] } }],
    ['no brick walls', { ...sample, walls: { walls: [] } }],
    ['typed structure area 42.5 × 2 faces', { ...sample, input: { rows: sampleRows.map(r => (isStructure(r) ? { ...r, manualArea: 42.5, sides: 2 } : r)) } }],
    ['structure row only, inside plaster', { ...sample, input: { rows: [{ wallPart: STRUCTURAL_WALL, kind: 'ฉาบภายใน', sides: 1, manualArea: STRUCTURAL_WALL_DEFAULT_AREA }] } }],
    ['rows with no wall part / no kind', { ...sample, input: { rows: [...sampleRows.slice(0, 4), { wallPart: '', kind: 'ฉาบภายนอก', sides: 2 }, { wallPart: 'ผนังรอบบ้าน', kind: '', sides: 2 }] } }],
    ['the Excel value "ฉาบภายใน " (trailing space) in the app too', { ...sample, input: { rows: sampleRows.map(r => (r.kind === 'ฉาบภายใน' ? { ...r, kind: 'ฉาบภายใน ' } : r)) } }],
    ['D1: two brick rows share an opening group (ผนังรอบบ้าน and ผนังภายในบ้าน)', { ...sample, walls: sharedGroup }],
    ['D5: 8 brick-wall plaster rows (Excel computes rows 5–10 only)', {
        ...sample,
        input: { rows: [...sampleRows.filter(r => !isStructure(r)), { wallPart: 'ผนังภายในบ้าน', kind: 'ฉาบภายนอก', sides: 1 }, { wallPart: 'ผนังรอบบ้าน', kind: 'ฉาบภายใน', sides: 2 }] },
    }],
    ['D5: a second structure row (Excel row 12, no formula)', {
        ...sample,
        input: { rows: [...sampleRows, { wallPart: STRUCTURAL_WALL, kind: 'ฉาบภายใน', sides: 1, manualArea: 12 }] },
    }],
    ...Array.from({ length: 50 }, (_, k): [string, Case] => [`random #${k} (seed ${14_000 + k})`, randomCase(14_000 + k)]),
];

function appResult({ input, walls, doors }: Case): ProjectResult {
    const p = createProject();
    p.calculators['door-window'] = doors;
    p.calculators.brick = walls;
    p.calculators.plaster = input;
    return computeProject(p);
}

/** Documented difference (app − Excel) of each plaster row's E: D1 brick excess × faces on SUMIF rows, the whole area on rows 12–22 (D5). */
function rowDeltas(c: Case, res: ProjectResult): { row: number; area: number; delta: number; kind: string }[] {
    const ctx = { outputs: (id: string) => res.calcOutputs[id] };
    const excess = brickD1ExcessByPart(c.walls, brickOpenings(ctx));
    const rows = excelRows(c.input);
    return c.input.rows.map((r, i) => {
        const row = rows[i] ?? 0;
        const area = plasterRowArea(r, ctx);
        const delta = NO_FORMULA_ROWS.includes(row) ? area : row === STRUCTURE_ROW ? 0 : (excess.get(r.wallPart.trim()) ?? 0) * r.sides;
        return { row, area, delta, kind: r.kind.trim() };
    });
}

describe('ฉาบปูน_Plaster vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...[...SUMIF_ROWS, STRUCTURE_ROW].map(r => `${SHEET}!E${r}`),
            ...[189, 190, 191].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!J197`, `${BOQ}!L197`, `${BOQ}!M197`, `${PAINT}!C5`, `${PAINT}!C6`, `${PAINT}!C13`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover every wall part × kind × faces, the structure row, blank rows, overflow rows (D5) and shared brick groups (D1)', () => {
        const rows = CASES.flatMap(([, c]) => c.input.rows);
        const has = (p: (r: PlasterRow) => boolean) => rows.filter(p).length;
        for (const part of PLASTER_WALL_PARTS) for (const kind of PLASTER_KINDS) for (const sides of PLASTER_SIDES) {
            expect(has(r => r.wallPart === part && r.kind.trim() === kind && r.sides === sides), `${part}/${kind}/${sides}`).toBeGreaterThan(0);
        }
        expect(has(r => isStructure(r) && r.manualArea !== STRUCTURAL_WALL_DEFAULT_AREA)).toBeGreaterThan(10);
        expect(has(r => r.wallPart === '')).toBeGreaterThan(2);
        expect(has(r => r.kind === '')).toBeGreaterThan(2);
        const deltas = CASES.map(([, c]) => rowDeltas(c, appResult(c)));
        expect(deltas.filter(d => d.some(x => NO_FORMULA_ROWS.includes(x.row))).length, 'D5 overflow cases').toBeGreaterThan(4);
        expect(deltas.filter(d => d.some(x => x.delta > 0 && SUMIF_ROWS.includes(x.row))).length, 'D1 brick cases').toBeGreaterThan(4);
        expect(deltas.filter(d => d.every(x => x.delta === 0) && d.length > 0).length, 'exact cases').toBeGreaterThan(20);
        expect(CASES.filter(([, c]) => c.doors.doors.length + c.doors.windows.length > 0 && c.walls.walls.length > 0).length).toBeGreaterThan(40);
    });

    it.each(CASES)('%s', (_name, c) => {
        oracle.replaceInputs(excelInputs(c));
        const res = appResult(c);
        const out = res.calcOutputs.plaster ?? {};
        const rows = rowDeltas(c, res);

        // 1. every row's E (exact unless D1 / D5 applies, then app − Excel = the documented delta); unused rows 0
        for (const r of rows) {
            expectClose(r.area - oracle.num(`${SHEET}!E${r.row}`), r.delta, `E${r.row} (app − Excel = ${r.delta})`);
            if (NO_FORMULA_ROWS.includes(r.row)) expect(oracle.get(`${SHEET}!E${r.row}`), `E${r.row} has no formula`).toBeNull();
        }
        for (const er of [...SUMIF_ROWS, STRUCTURE_ROW].filter(x => !rows.some(r => r.row === x))) expect(oracle.num(`${SHEET}!E${er}`), `unused E${er}`).toBe(0);

        // 2. every output of compute() — and the paint sheet's C5 / C6 / C13 read the same SUMIFs
        const delta = (kind: string) => rows.filter(r => r.kind === kind).reduce((s, r) => s + r.delta, 0);
        const dExt = delta('ฉาบภายนอก');
        const dInt = delta('ฉาบภายใน');
        const excel: Record<string, [number, number]> = {
            exterior: [oracle.num(`${BOQ}!E189`), dExt], R189: [oracle.num(`${BOQ}!E189`), dExt],
            interior: [oracle.num(`${BOQ}!E190`), dInt], R190: [oracle.num(`${BOQ}!E190`), dInt],
            total: [oracle.num(`${PAINT}!C13`), dExt + dInt],
        };
        for (const [key, v] of Object.entries(out)) {
            const e = excel[key];
            if (!e) expect.fail(`output ${key} has no Excel mapping`);
            else expectClose(v - e[0], e[1], `output ${key} − Excel = ${e[1]}`);
        }
        expectClose((out.exterior ?? NaN) - oracle.num(`${PAINT}!C5`), dExt, 'exterior = paint C5 (+ delta)');
        expectClose((out.interior ?? NaN) - oracle.num(`${PAINT}!C6`), dInt, 'interior = paint C6 (+ delta)');

        // 3. BOQ (Home) section 18: R189 / R190 (exact, or the delta at Excel's prices), R191 (door-window), subtotal row 197
        let rowDelta = 0;
        for (const [er, d] of [[189, dExt], [190, dInt]] as const) {
            if (d === 0) { expectBoqRow(oracle, res.boq, `R${er}`, er); continue; }
            const line = boqItem(res.boq, `R${er}`);
            const qty = line?.qty ?? NaN;
            expectClose(qty - oracle.num(`${BOQ}!E${er}`), d, `E${er} − delta`);
            expectClose(line?.grossQty ?? NaN, qty * (1 + oracle.num(`${BOQ}!G${er}`)), `H${er}`);
            // J189 = I×H, J190 = I×E (spec oddity 12), L = K×E
            expectClose(line?.matTotal, oracle.num(`${BOQ}!I${er}`) * (er === 190 ? qty : (line?.grossQty ?? NaN)), `J${er}`);
            expectClose(line?.labTotal, oracle.num(`${BOQ}!K${er}`) * qty, `L${er}`);
            rowDelta += (line?.total ?? NaN) - oracle.num(`${BOQ}!M${er}`);
        }
        expectBoqRow(oracle, res.boq, 'R191', 191);
        const s18 = res.boq.sections.find(s => s.no === 18);
        expectClose((s18?.total ?? NaN) - oracle.num(`${BOQ}!M197`), rowDelta, 'section 18 M197 − row deltas');
        if (dExt === 0 && dInt === 0) {
            expectClose(s18?.matTotal, oracle.num(`${BOQ}!J197`), 'J197');
            expectClose(s18?.labTotal, oracle.num(`${BOQ}!L197`), 'L197');
        }
    });
});
