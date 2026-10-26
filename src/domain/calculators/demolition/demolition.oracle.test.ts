// Differential test: งานรื้อถอน_Site Preparation compute() + BOQ row 12 / section 1 vs the Excel v5 workbook
// (evaluated by the oracle) on ~50 seeded random demolition lists + named edge cases.
// Guide: docs/rebuild/ORACLE_TESTS.md.
//
// Sheet 35 has NO formulas: F4:F10 and F11 hold a static 0 (spec 01 §1 b-1, re-checked in the regenerated dump).
// The app builds the intended F = D × E and F11 = SUM(F4:F10) (decision D1, demolition/index.ts). So every case
//   - asserts that Excel F still shows its static 0 and that the app differs by exactly the intended formula,
//     which the oracle evaluates on the typed Excel cells (`=D·E`, `=SUMPRODUCT(D4:D10,E4:E10)`) — this checks the
//     input mapping and the formula against the cells a user types in Excel;
//   - D3: BOQ E12 / K12 are typed 0 in Excel; the app links 1 เหมา × F11 (labour). The delta is asserted, then the
//     values are typed into E12 / K12 like a user would, and the BOQ row must match exactly;
//   - D1: Excel's section 1 sub-total J14/L14/M14 = SUM(row 13) leaves row 12 out; the app sums every item row of
//     the section (spec 01 §A.4 "M_sub = SUM of the item-row M values"; §1 (e) "J14/L14 omit row 12").
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import type { BoqResult } from '../../boq/types';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { DEMOLITION_FIXED_ITEMS, demolition, lineTotal, type DemolitionInput, type DemolitionLine } from '.';

const SHEET = 'งานรื้อถอน_Site Preparation';
const BOQ = 'BOQ (Home)';
/** Excel table rows 4–10 (7 fixed items). */
const FIRST_ROW = 4;
const EXCEL_ROWS = 7;
const at = (col: string, i: number) => `${SHEET}!${col}${FIRST_ROW + i}`;

// ─── Input mapping ──────────────────────────────────────────────────────────
// D ปริมาณ and E Rate are the inputs (light-blue FFD9EAF7; the sheet has no yellow cells). B / C / G are fixed text.
function excelInputs(input: DemolitionInput): Record<string, OracleInput> {
    if (input.items.length > EXCEL_ROWS) throw new Error(`Excel has ${EXCEL_ROWS} demolition rows`);
    const out: Record<string, OracleInput> = {};
    for (let i = 0; i < EXCEL_ROWS; i++) {
        const row = input.items[i];
        out[at('D', i)] = row ? row.qty : null;
        out[at('E', i)] = row ? row.rate : null;
    }
    return out;
}

/** The intended formulas, evaluated by the oracle on the typed cells (Excel itself has static 0s here). */
const intendedRow = (o: ExcelOracle, i: number) => o.evaluate(`='${SHEET}'!D${FIRST_ROW + i}*'${SHEET}'!E${FIRST_ROW + i}`);
const intendedTotal = (o: ExcelOracle) => o.evaluate(`=SUMPRODUCT('${SHEET}'!D4:D10,'${SHEET}'!E4:E10)`);
const asNum = (v: unknown) => (typeof v === 'number' ? v : v === null ? 0 : NaN);

// ─── Random but plausible demolition lists ──────────────────────────────────
/** Plausible qty / rate per fixed item (unit, typical range). */
const RANGES: readonly [number, number, number, number][] = [
    [10, 200, 150, 600],   // รื้อถอนอาคาร ตร.ม.
    [1, 15, 300, 3000],    // รื้อถอนต้นไม้ ต้น
    [5, 80, 80, 300],      // รื้อถอนท่อระบายน้ำ ม.
    [10, 150, 100, 400],   // รื้อรั้ว / กำแพง ตร.ม.
    [10, 300, 100, 350],   // รื้อถนน / พื้นภายนอก ตร.ม.
    [50, 800, 10, 60],     // เคลียร์พื้นที่ ตร.ม.
    [1, 20, 1500, 4000],   // ขนขยะทิ้ง เที่ยว
];

function randomLine(rng: Random, i: number): DemolitionLine {
    const fixed = DEMOLITION_FIXED_ITEMS[i] ?? { label: 'อื่น ๆ', unit: 'งาน', check: '' };
    const [qMin, qMax, rMin, rMax] = RANGES[i] ?? [1, 10, 100, 1000];
    // Most rows stay blank as in Excel v5; a used row has a qty and a rate (sometimes one of them missing).
    if (rng.chance(0.45)) return { ...fixed, qty: 0, rate: 0 };
    return {
        ...fixed,
        qty: rng.chance(0.1) ? 0 : rng.step(qMin, qMax, 0.5),
        rate: rng.chance(0.1) ? 0 : rng.step(rMin, rMax, 5),
    };
}

function randomInput(seed: number): DemolitionInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.6) ? EXCEL_ROWS : rng.int(0, EXCEL_ROWS);
    return { items: Array.from({ length: n }, (_, i) => randomLine(rng, i)) };
}

const sample = demolition.defaults();
const full = (qty: number, rate: number): DemolitionInput => ({ items: DEMOLITION_FIXED_ITEMS.map(i => ({ ...i, qty, rate })) });
const line = (i: number, qty: number, rate: number): DemolitionLine => ({ ...(DEMOLITION_FIXED_ITEMS[i] ?? { label: '', unit: '', check: '' }), qty, rate });
/** D5: the app allows rows beyond Excel's 7 (Excel has no free rows). */
const EXTRA: DemolitionLine[] = [
    { label: 'รื้อถังบำบัดเดิม', unit: 'ชุด', qty: 1, rate: 3500, check: '' },
    { label: 'ขุดตอไม้', unit: 'ตอ', qty: 3, rate: 450, check: '' },
];
const D5_CASE: DemolitionInput = { items: [...full(10, 100).items, ...EXTRA] };

const CASES: [string, DemolitionInput][] = [
    ['Excel sample (7 rows, all blank)', sample],
    ['empty table (no rows)', { items: [] }],
    ['qty without rate and rate without qty (total 0)', {
        items: [line(0, 120, 0), line(1, 0, 900)],
    }],
    ['one row used (trees), first row blank', { items: [line(0, 0, 0), line(1, 4, 1200)] }],
    ['all 7 rows used (maximum Excel table)', full(25, 250)],
    ['large values (5,000 ตร.ม. × 1,000)', full(5000, 1000)],
    ['fractional values (12.75 × 333.33)', full(12.75, 333.33)],
    ...Array.from({ length: 50 }, (_, k): [string, DemolitionInput] => [`random #${k} (seed ${35_000 + k})`, randomInput(35_000 + k)]),
];

function appResult(input: DemolitionInput): ProjectResult {
    const p = createProject();
    p.calculators.demolition = input;
    return computeProject(p);
}

function expectSection(oracle: ExcelOracle, boq: BoqResult, no: number, excelRow: number, label = ''): void {
    const s = boq.sections.find(x => x.no === no);
    expectClose(s?.matTotal, oracle.num(`${BOQ}!J${excelRow}`), `${label} section ${no} J${excelRow}`);
    expectClose(s?.labTotal, oracle.num(`${BOQ}!L${excelRow}`), `${label} section ${no} L${excelRow}`);
    expectClose(s?.total, oracle.num(`${BOQ}!M${excelRow}`), `${label} section ${no} M${excelRow}`);
}

/** Output keys → how they are checked (see the header: F has no formula in Excel). */
const OUTPUT_KEYS = ['boqQty', 'total'];

describe('งานรื้อถอน_Site Preparation vs Excel (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('Excel column F and F11 are static 0 (no formula) — the documented D1 gap', () => {
        oracle.reset();
        for (let i = 0; i <= EXCEL_ROWS; i++) {
            expect(oracle.formula(at('F', i)), at('F', i)).toBeUndefined();
            expect(oracle.num(at('F', i))).toBe(0);
        }
        const refs = [...['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}12`), `${BOQ}!J14`, `${BOQ}!L14`, `${BOQ}!M14`];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
        // E12 / K12 are typed inputs (D3: not linked to the sheet); J14/L14/M14 sum row 13 only (D1)
        expect(oracle.formula(`${BOQ}!E12`)).toBeUndefined();
        expect(oracle.formula(`${BOQ}!K12`)).toBeUndefined();
        expect(oracle.formula(`${BOQ}!M14`)).toBe('SUM(M13)');
    });

    it('the cases cover both BOQ branches (no work → 0 เหมา, work → 1 เหมา), the full table and partial rows', () => {
        const total = (i: DemolitionInput) => demolition.compute(i, { outputs: () => undefined }).total ?? 0;
        const has = (p: (i: DemolitionInput) => boolean) => CASES.filter(([, i]) => p(i)).length;
        expect(has(i => total(i) === 0)).toBeGreaterThan(3);
        expect(has(i => total(i) > 0)).toBeGreaterThan(30);
        expect(has(i => total(i) === 0 && i.items.some(l => l.qty > 0 || l.rate > 0))).toBeGreaterThan(0);
        expect(has(i => i.items.length === EXCEL_ROWS)).toBeGreaterThan(10);
        expect(has(i => i.items.length > 0 && i.items.length < EXCEL_ROWS)).toBeGreaterThan(5);
        expect(has(i => i.items.length === 0)).toBeGreaterThan(0);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs.demolition ?? {};
        expect(Object.keys(out).sort()).toEqual([...OUTPUT_KEYS].sort());

        // 1. per row: Excel F is a static 0; the app's F = D × E equals the intended formula on the typed cells
        input.items.forEach((row, i) => {
            expect(oracle.num(at('F', i)), `Excel ${at('F', i)} static`).toBe(0);
            expectClose(lineTotal(row), asNum(intendedRow(oracle, i)), `row ${i}: app F = D×E (D1)`);
        });
        for (let i = input.items.length; i < EXCEL_ROWS; i++) {
            expect(oracle.get(at('D', i)), `unused row ${FIRST_ROW + i}`).toBeNull();
        }

        // 2. outputs: total = intended F11 (Excel F11 static 0 → D1 delta = the whole total); boqQty = 1 เหมา if any work
        const excelF11 = oracle.num(`${SHEET}!F11`);
        const intended = asNum(intendedTotal(oracle));
        expect(excelF11).toBe(0);
        expectClose((out.total ?? NaN) - excelF11, intended, 'total − Excel F11 = SUMPRODUCT(D,E) (D1)');
        expect(out.boqQty).toBe(intended > 0 ? 1 : 0);

        // 3. D3: before retyping, Excel row 12 is 0 เหมา; the app row 12 is 1 × F11 labour (+ 0 material)
        const r12 = boqItem(res.boq, 'R12');
        expectClose((r12?.total ?? NaN) - oracle.num(`${BOQ}!M12`), (intended > 0 ? 1 : 0) * intended, 'M12 − D3 delta');
        expectClose((r12?.qty ?? NaN) - oracle.num(`${BOQ}!E12`), intended > 0 ? 1 : 0, 'E12 − D3 delta');

        // 4. typed like a user (E12 = 1 เหมา when there is work, K12 = F11 as intended) → row 12 exact
        oracle.setInputs({ [`${BOQ}!E12`]: intended > 0 ? 1 : 0, [`${BOQ}!K12`]: intended });
        expectBoqRow(oracle, res.boq, 'R12', 12);
        expectBoqRow(oracle, res.boq, 'R13', 13);

        // 5. D1: Excel section 1 (J14/L14/M14 = SUM of row 13) leaves row 12 out; the app's section 1 includes it.
        const s1 = res.boq.sections.find(s => s.no === 1);
        expectClose((s1?.matTotal ?? NaN) - oracle.num(`${BOQ}!J14`), oracle.num(`${BOQ}!J12`), 'J14 − D1 (row 12)');
        expectClose((s1?.labTotal ?? NaN) - oracle.num(`${BOQ}!L14`), oracle.num(`${BOQ}!L12`), 'L14 − D1 (row 12)');
        expectClose((s1?.total ?? NaN) - oracle.num(`${BOQ}!M14`), oracle.num(`${BOQ}!M12`), 'M14 − D1 (row 12)');
        if (intended === 0) expectSection(oracle, res.boq, 1, 14, 'no demolition');
    });

    it('D5: rows beyond Excel\'s 7 — Excel holds the first 7, the app adds the extra rows on top', () => {
        oracle.replaceInputs(excelInputs({ items: D5_CASE.items.slice(0, EXCEL_ROWS) }));
        const out = appResult(D5_CASE).calcOutputs.demolition ?? {};
        const extra = EXTRA.reduce((s, l) => s + l.qty * l.rate, 0);
        expectClose((out.total ?? NaN) - asNum(intendedTotal(oracle)), extra, 'total − Excel 7 rows = extra rows');
    });
});
