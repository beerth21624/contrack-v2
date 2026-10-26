// Differential test: roofing compute() + BOQ section 16 vs the real Excel v5 formulas (evaluated by the oracle) on
// ~50 seeded random roof take-offs. The take-off cells E are typed as the owner types them (`=K7`, `=2.4+9.2`,
// `=(…)/COS(RADIANS(40))`, `=E6`). Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { isOracleError, loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import {
    ROOFING_EXCEL_ROWS, ROOFING_FIRST_ROW, ROOFING_SHEET, roofingExcelInputs, roofingExcelOp,
} from '../../../test-utils/oracle-roof-walls';
import { computeProject, createProject, type ProjectResult } from '../../project';
import {
    FASCIA_ROW, ROOFING_BOQ_ROWS, ROOFING_ITEMS, ROOFING_TAKEOFF_UNITS, roofing, roofingOp, roofingTakeoffs,
    type RoofingInput, type RoofingRow, type RoofingTakeoff,
} from '.';

const SHEET = ROOFING_SHEET;
const STRUCTURE = 'โครงสร้างหลังคา Roof Structure';
const BOQ = 'BOQ (Home)';
const at = (col: string, i: number) => `${SHEET}!${col}${ROOFING_FIRST_ROW + i}`;
/** BOQ R162…R174 = G5…G17, R175 = K7, R176 = E16. */
const BOQ_LINES = Array.from({ length: ROOFING_BOQ_ROWS + 2 }, (_, i) => 162 + i);

const MUL_UNITS = ['แผ่น/ตร.ม.', 'แผ่น/ม.', 'แผ่น'] as const;
const DIV_UNITS = ['ม./แผ่น', 'ตร.ม./ม้วน'] as const;
const ITEM_WITH_TRAILING_SPACE_IN_EXCEL = new Set(['ครอบข้างจั่ว', 'ครอบข้างผนัง', 'ครอบสันโค้ง', 'ชุดครอบข้างผนัง',
    'ชุดครอบระบบแห้ง DRYTECH', 'แผ่นปิดกันนก', 'ไม้เชิงชาย', 'รางน้ำตะเข้']);

// ─── Output mapping ─────────────────────────────────────────────────────────
/** The Excel value an output key stands for (undefined = unmapped: the test fails, so new outputs get mapped). */
function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    if (key === 'slopeArea') return o.num(`${SHEET}!K7`);
    if (key === 'fasciaLength') return o.num(at('E', FASCIA_ROW));   // E16 (also BOQ E176, checked below)
    const perRow = /^(takeoff|qty)\.(\d+)$/.exec(key);
    if (perRow?.[1] && perRow[2]) return o.num(at(perRow[1] === 'takeoff' ? 'E' : 'G', Number(perRow[2])));
    const line = /^R(\d+)$/.exec(key);
    if (line?.[1] && BOQ_LINES.includes(Number(line[1]))) return o.num(`${BOQ}!E${line[1]}`);
    return undefined;
}

// ─── Random but plausible roof take-offs ────────────────────────────────────
function randomFactor(rng: Random, unit: string): number {
    switch (unit) {
        case 'แผ่น/ตร.ม.': return rng.step(8, 13, 0.1);
        case 'แผ่น/ม.': return rng.step(2, 4, 0.1);
        case 'แผ่น': return rng.pick([1, 1, 2]);
        case 'ม./แผ่น': return rng.step(0.3, 5, 0.1);
        default: return rng.step(50, 80, 5);   // ตร.ม./ม้วน
    }
}

const randomLengths = (rng: Random, max: number) =>
    Array.from({ length: rng.int(rng.chance(0.1) ? 0 : 1, max) }, () => rng.step(0.5, 15, 0.05));

function randomTakeoff(rng: Random, i: number, keys: string[], slopeDeg: number): RoofingTakeoff {
    const r = rng.next();
    if (r < 0.15) return { kind: 'slope' };
    if (r < 0.3) return { kind: 'rake', lengths: randomLengths(rng, 7), deg: rng.chance(0.5) ? slopeDeg : rng.step(15, 45, 1) };
    if (r < 0.45 && keys.length > 1) {
        // a link to another row's take-off (Excel E12 = E6): earlier or later, never to itself
        const others = keys.filter((_, j) => j !== i);
        return { kind: 'row', ref: rng.pick(others) };
    }
    return { kind: 'lengths', lengths: rng.chance(0.15) ? [rng.int(1, 12)] : randomLengths(rng, 6) };
}

function randomInput(seed: number): RoofingInput {
    const rng = seededRandom(seed);
    const slopeDeg = rng.chance(0.05) ? 0 : rng.step(15, 50, 1);
    const n = rng.chance(0.12) ? ROOFING_EXCEL_ROWS : rng.chance(0.3) ? rng.int(ROOFING_BOQ_ROWS + 1, ROOFING_EXCEL_ROWS) : ROOFING_BOQ_ROWS;
    const keys = Array.from({ length: n }, (_, i) => `r${i}`);
    const rows = keys.map((key, i): RoofingRow => {
        const factorUnit = roofingExcelOp(i) === 'mul' ? rng.pick(MUL_UNITS) : rng.pick(DIV_UNITS);
        return {
            key,
            item: rng.pick(ROOFING_ITEMS),
            // a × row may have no factor (Excel ROUNDUP(E*0) = 0); ÷ rows keep one (÷0: the D1 case below)
            factor: roofingExcelOp(i) === 'mul' && rng.chance(0.05) ? 0 : randomFactor(rng, factorUnit),
            factorUnit,
            takeoff: { kind: 'lengths', lengths: [] },
            takeoffUnit: i === FASCIA_ROW ? 'ม.' : rng.pick(ROOFING_TAKEOFF_UNITS),
            unit: i === ROOFING_BOQ_ROWS - 1 ? 'ม้วน' : 'แผ่น',   // BOQ F162…F174 = H5…H17 (see the it.fails below)
        };
    });
    // links only to rows that are not links themselves (Excel shows a chain fine, but keep it one level)
    const takeoffs = keys.map((_, i) => randomTakeoff(rng, i, keys, slopeDeg));
    takeoffs.forEach((t, i) => {
        const row = rows[i];
        if (!row) return;
        if (t.kind === 'row') {
            const target = keys.indexOf(t.ref);
            row.takeoff = takeoffs[target]?.kind === 'row' ? { kind: 'slope' } : t;
        } else row.takeoff = t;
    });
    return { planArea: rng.chance(0.04) ? 0 : rng.step(20, 400, 0.5), slopeDeg, rows };
}

const sample = roofing.defaults();
const withRow = (input: RoofingInput, i: number, patch: Partial<RoofingRow>): RoofingInput =>
    ({ ...input, rows: input.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
const extraRow = (key: string, takeoff: RoofingTakeoff): RoofingRow =>
    ({ key, item: 'ครอบโค้ง 3 ทาง', factor: 1, factorUnit: 'แผ่น', takeoff, takeoffUnit: 'จุด', unit: 'แผ่น' });

const CASES: [string, RoofingInput][] = [
    ['Excel sample', sample],
    ['blank project (no size, pitch or lengths)', roofing.blank?.() ?? sample],
    ['pitch 0° (slope area = plan area)', { ...sample, slopeDeg: 0 }],
    ['pitch 30°, rake keeps its own 40°', { ...sample, slopeDeg: 30 }],
    ['all 17 Excel rows (rows 18–21 do not reach the BOQ)', {
        ...sample,
        rows: [...sample.rows, extraRow('x1', { kind: 'lengths', lengths: [3] }), extraRow('x2', { kind: 'slope' }),
            extraRow('x3', { kind: 'row', ref: 'ridge' }), extraRow('x4', { kind: 'rake', lengths: [2.5, 4], deg: 35 })],
    }],
    ['links forward and backward (E5 = E16, E12 = E17)', withRow(withRow(sample, 0, { takeoff: { kind: 'row', ref: 'fascia' } }), 7, { takeoff: { kind: 'row', ref: 'foil' } })],
    ['factor 0 on a × row', withRow(sample, 1, { factor: 0 })],
    ...Array.from({ length: 50 }, (_, k): [string, RoofingInput] => [`random #${k} (seed ${23_000 + k})`, randomInput(23_000 + k)]),
];

function appResult(input: RoofingInput): ProjectResult {
    const p = createProject();
    p.calculators.roofing = input;
    return computeProject(p);
}

/** The exact comparison of one case: every row, every output, the BOQ section 16 rows and the cross-sheet links. */
function compareCase(oracle: ExcelOracle, input: RoofingInput): void {
    oracle.replaceInputs(roofingExcelInputs(input));
    const res = appResult(input);
    const out = res.calcOutputs.roofing ?? {};
    const takeoffs = roofingTakeoffs(input);

    // 1. every row: E ปริมาณถอดแบบ and G ปริมาณ BOQ; unused rows stay 0
    input.rows.forEach((_, i) => {
        expectClose(takeoffs[i], oracle.num(at('E', i)), `row ${i} E${ROOFING_FIRST_ROW + i}`);
        expectClose(out[`qty.${i}`], oracle.num(at('G', i)), `row ${i} G${ROOFING_FIRST_ROW + i}`);
    });
    for (let i = input.rows.length; i < ROOFING_EXCEL_ROWS; i++) expect(oracle.num(at('G', i)), `unused G${ROOFING_FIRST_ROW + i}`).toBe(0);

    // 2. every output of compute() (unmapped keys fail)
    for (const [key, v] of Object.entries(out)) {
        const excel = excelValueOf(key, oracle);
        if (excel === undefined) expect.fail(`output ${key} has no Excel mapping — add it to excelValueOf`);
        else expectClose(v, excel, `output ${key}`);
    }
    expect(Object.keys(out).filter(k => k.startsWith('qty.')).length).toBe(input.rows.length);
    // cross-sheet: Roof Structure E14/E15 read K7 (slopeArea); the fascia length is BOQ E176
    expectClose(out.slopeArea, oracle.num(`${STRUCTURE}!E14`), 'slopeArea = Roof Structure E14');
    expectClose(out.slopeArea, oracle.num(`${STRUCTURE}!E15`), 'slopeArea = Roof Structure E15');
    expectClose(out.fasciaLength, oracle.num(`${BOQ}!E176`), 'fasciaLength = BOQ E176');

    // 3. BOQ (Home) section 16: E, H, J, L, M of R162–R176, the text links D162…D174 = B, F = H (F176 = F16), J177/L177/M177
    for (const r of BOQ_LINES) expectBoqRow(oracle, res.boq, `R${r}`, r);
    input.rows.slice(0, ROOFING_BOQ_ROWS).forEach((row, i) => {
        const line = boqItem(res.boq, `R${162 + i}`);
        expect(line?.desc, `D${162 + i}`).toBe(oracle.get(`${BOQ}!D${162 + i}`));
        expect(line?.unit, `F${162 + i}`).toBe(oracle.get(`${BOQ}!F${162 + i}`));
        expect(row.item.trim()).toBe(line?.desc);
    });
    if (input.rows.length > FASCIA_ROW) expect(boqItem(res.boq, 'R176')?.unit, 'F176').toBe(oracle.get(`${BOQ}!F176`));
    const s16 = res.boq.sections.find(s => s.no === 16);
    expectClose(s16?.matTotal, oracle.num(`${BOQ}!J177`), 'section 16 J177');
    expectClose(s16?.labTotal, oracle.num(`${BOQ}!L177`), 'section 16 L177');
    expectClose(s16?.total, oracle.num(`${BOQ}!M177`), 'section 16 M177');
}

describe('มุงหลังคา_Roofing vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            `${SHEET}!K7`,
            ...Array.from({ length: ROOFING_EXCEL_ROWS }, (_, i) => [at('E', i), at('G', i)]).flat(),
            ...BOQ_LINES.flatMap(r => ['D', 'E', 'F', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!J177`, `${BOQ}!L177`, `${BOQ}!M177`, `${STRUCTURE}!E14`, `${STRUCTURE}!E15`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover every take-off kind on × and ÷ rows, every unit, links, empty take-offs and full tables', () => {
        const rows = CASES.flatMap(([, input]) => input.rows.map((r, i) => ({ r, i, input })));
        const has = (p: (x: typeof rows[number]) => boolean) => rows.filter(p).length;
        for (const op of ['mul', 'div'] as const) {
            for (const kind of ['slope', 'lengths', 'rake', 'row'] as const) {
                expect(has(x => roofingExcelOp(x.i) === op && x.r.takeoff.kind === kind), `${kind} on a ${op} row`).toBeGreaterThan(3);
            }
        }
        for (const u of [...MUL_UNITS, ...DIV_UNITS]) expect(has(x => x.r.factorUnit === u), u).toBeGreaterThan(5);
        expect(has(x => x.r.takeoff.kind === 'row' && x.input.rows.findIndex(r => r.key === (x.r.takeoff as { ref: string }).ref) > x.i)).toBeGreaterThan(3);
        expect(has(x => x.r.takeoff.kind === 'lengths' && x.r.takeoff.lengths.length === 0)).toBeGreaterThan(3);
        expect(has(x => x.r.takeoff.kind === 'lengths' && x.r.takeoff.lengths.length > 1)).toBeGreaterThan(20);
        expect(has(x => x.r.takeoff.kind === 'rake' && x.r.takeoff.deg !== x.input.slopeDeg)).toBeGreaterThan(3);
        expect(has(x => x.r.factor === 0)).toBeGreaterThan(1);
        expect(has(x => x.i >= ROOFING_BOQ_ROWS)).toBeGreaterThan(10);
        expect(has(x => ITEM_WITH_TRAILING_SPACE_IN_EXCEL.has(x.r.item))).toBeGreaterThan(50);
        expect(CASES.filter(([, i]) => i.rows.length === ROOFING_EXCEL_ROWS).length).toBeGreaterThan(3);
        expect(CASES.filter(([, i]) => i.slopeDeg === 0).length).toBeGreaterThan(1);
        expect(CASES.filter(([, i]) => i.planArea === 0).length).toBeGreaterThan(1);
        // every row's own maths (D unit) agrees with Excel's fixed G formula in these cases — the disagreement is the it.fails below
        expect(has(x => roofingOp(x.r.factorUnit) !== roofingExcelOp(x.i))).toBe(0);
    });

    it.each(CASES)('%s', (_name, input) => { compareCase(oracle, input); });

    it('D1: a ÷ row with no factor — Excel G12 = ROUNDUP(E12/0) is #DIV/0! (and so the BOQ section), the app 0', () => {
        // roofingQty: "A divide by an empty factor gives 0 (Excel: #DIV/0!)".
        const input = withRow(sample, 7, { factor: 0 });
        oracle.replaceInputs(roofingExcelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs.roofing ?? {};
        const g12 = oracle.get(at('G', 7));
        expect(isOracleError(g12) && g12.error).toBe('#DIV/0!');
        const e169 = oracle.get(`${BOQ}!E169`);
        expect(isOracleError(e169) && e169.error).toBe('#DIV/0!');
        expect(out['qty.7']).toBe(0);
        expect(boqItem(res.boq, 'R169')?.total).toBe(0);
        for (const r of BOQ_LINES.filter(x => x !== 169)) expectBoqRow(oracle, res.boq, `R${r}`, r, 'D1 ÷0');
        const m177 = oracle.get(`${BOQ}!M177`);
        expect(isOracleError(m177) && m177.error).toBe('#DIV/0!');
        const others = BOQ_LINES.filter(x => x !== 169).reduce((s, r) => s + oracle.num(`${BOQ}!M${r}`), 0);
        expectClose(res.boq.sections.find(s => s.no === 16)?.total, others, 'app section 16 = Excel rows without R169');
    });

    // ── Real mismatches (not a documented D1–D7 decision): kept as exact comparisons, reported ──

    // roofingOp() derives × / ÷ from the factor unit D (spec 03 §3 "for the rebuild, derive it from D", oddity 16 —
    // not one of the approved decisions D1–D7). Excel's G formula is fixed per row: G8 always multiplies.
    // Inputs: Excel sample, row 4 (Excel row 8) = ไม้เชิงชาย, factor 4, unit ม./แผ่น, take-off 62.3 m.
    // Excel G8 = ROUNDUP(62.3*4) = 250 → BOQ E165 250; app ROUNDUP(62.3/4) = 16.
    it.fails('mismatch: a ÷ unit (ม./แผ่น) on a × row (G8) — Excel E165 250, app 16', () => {
        compareCase(oracle, withRow(sample, 3, { item: 'ไม้เชิงชาย', factor: 4, factorUnit: 'ม./แผ่น', takeoff: { kind: 'lengths', lengths: [62.3] } }));
    });

    // BOQ F162…F174 = 'มุงหลังคา_Roofing'!H5…H17 (the purchase unit typed on the sheet); the app's BOQ unit is the
    // template's and ignores RoofingRow.unit. Inputs: Excel sample, H5 = ม้วน. Excel F162 "ม้วน", app "แผ่น".
    it.fails('mismatch: BOQ unit F162 follows Roofing H5 — Excel "ม้วน", app "แผ่น"', () => {
        compareCase(oracle, withRow(sample, 0, { unit: 'ม้วน' }));
    });

    // BOQ D162…D174 = B5…B17. With fewer than 13 rows Excel shows a blank description (and qty 0) on the missing
    // rows; the app keeps the template text. Inputs: the first 4 sample rows. Excel D166 blank, app "ครอบปิดชาย".
    it.fails('mismatch: fewer than 13 rows — Excel D166 blank, app keeps "ครอบปิดชาย"', () => {
        const input = { ...sample, rows: sample.rows.slice(0, 4) };
        oracle.replaceInputs(roofingExcelInputs(input));
        const res = appResult(input);
        for (let r = 166; r <= 174; r++) expect(boqItem(res.boq, `R${r}`)?.desc ?? '', `D${r}`).toBe(oracle.get(`${BOQ}!D${r}`) ?? '');
    });
});
