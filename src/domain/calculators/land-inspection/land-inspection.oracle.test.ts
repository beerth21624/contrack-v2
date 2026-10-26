// Differential test: ค่าตรวจสอบที่ดิน compute() + BOQ row 9 / section 0 vs the real Excel v5 formulas (evaluated by
// the oracle) on ~50 seeded random cost lists + named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
//
// Documented deltas asserted here:
//   - D3: Excel retypes F14 into BOQ K9 (7,500, labour, 1 เหมา); the app links it (land-inspection/index.ts). Each
//     case asserts app − Excel = (F14 − K9) × E9 first, then types F14 into K9 like a user and compares exactly.
//   - D2: section 0 is not part of the construction total (Excel M310 skips M10; the app keeps it apart as
//     preConstructionTotal).
//   - D5: Excel has 5 cost rows (8–12, the last one "+ เพิ่ม"); the app allows more.
// Not compared: the 5-question checklist (an external Google Doc linked from G8, no cells) and the row labels
// (column B is fixed text in Excel, not an input).
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import type { BoqResult } from '../../boq/types';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { landInspection, lineTotal, type CostLine, type LandInspectionInput } from '.';

const SHEET = 'ค่าตรวจสอบที่ดิน';
const BOQ = 'BOQ (Home)';
/** Excel cost rows 8–12. */
const FIRST_ROW = 8;
const EXCEL_ROWS = 5;
const at = (col: string, i: number) => `${SHEET}!${col}${FIRST_ROW + i}`;

// ─── Input mapping (yellow cells) ───────────────────────────────────────────
const HEADER_INPUTS: readonly [keyof LandInspectionInput, string][] = [
    ['projectName', 'C4'], ['province', 'F4'], ['surveyDate', 'C5'], ['inspector', 'F5'],
];
const ROW_INPUTS: readonly [keyof CostLine, string][] = [['qty', 'C'], ['unit', 'D'], ['unitPrice', 'E']];

function excelInputs(input: LandInspectionInput): Record<string, OracleInput> {
    if (input.items.length > EXCEL_ROWS) throw new Error(`Excel has ${EXCEL_ROWS} cost rows`);
    const out: Record<string, OracleInput> = {};
    for (const [field, c] of HEADER_INPUTS) {
        const v = input[field];
        out[`${SHEET}!${c}`] = typeof v === 'string' && v !== '' ? v : null;
    }
    for (let i = 0; i < EXCEL_ROWS; i++) {
        const row = input.items[i];
        for (const [field, col] of ROW_INPUTS) {
            const v = row?.[field];
            out[at(col, i)] = v === undefined || v === '' ? null : v;
        }
    }
    return out;
}

/** Every key compute() returns → its Excel cell. */
const OUTPUT_CELLS: Record<string, string> = { total: `${SHEET}!F14` };

// ─── Random but plausible cost lists ────────────────────────────────────────
const LINES: readonly [string, string, number, number][] = [
    ['ค่าแรงตรวจสอบที่ดิน', 'วัน', 1500, 3],
    ['ค่าเดินทาง', 'เที่ยว', 2500, 2],
    ['ค่าที่พัก', 'คืน', 1200, 3],
    ['ค่าอุปกรณ์สำรวจ / เอกสาร', 'งาน', 800, 1],
    ['ค่าทำรังวัด', 'งาน', 3000, 1],
];

function randomLine(rng: Random, i: number): CostLine {
    const [label, unit, price, maxQty] = LINES[i] ?? ['อื่น ๆ', 'งาน', 1000, 2];
    return {
        label,
        qty: rng.chance(0.1) ? 0 : rng.chance(0.2) ? rng.step(0.5, maxQty + 1, 0.5) : rng.int(1, maxQty + 1),
        unit: rng.chance(0.1) ? '' : unit,
        unitPrice: rng.chance(0.1) ? 0 : rng.step(price * 0.5, price * 2, 50),
    };
}

function randomInput(seed: number): LandInspectionInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.25) ? EXCEL_ROWS : rng.pick([0, 1, 2, 3, 4, 4, 4]);
    return {
        ...landInspection.defaults(),
        projectName: rng.chance(0.3) ? 'บ้านทดสอบ' : '',
        province: rng.chance(0.3) ? rng.pick(['เชียงใหม่', 'ขอนแก่น', 'ชลบุรี']) : '',
        items: Array.from({ length: n }, (_, i) => randomLine(rng, i)),
    };
}

const sample = landInspection.defaults();
const fullTable: CostLine[] = LINES.map(([label, unit, unitPrice]) => ({ label, unit, unitPrice, qty: 1 }));
/** D5: more cost rows than Excel's 5. */
const EXTRA: CostLine[] = [
    { label: 'ค่าถ่ายภาพทางอากาศ', qty: 1, unit: 'งาน', unitPrice: 4500 },
    { label: 'ค่าเอกสารโฉนด', qty: 2, unit: 'ชุด', unitPrice: 350 },
];

const CASES: [string, LandInspectionInput][] = [
    ['Excel sample', sample],
    ['empty table (no cost rows)', { ...sample, items: [] }],
    ['zeros (rows with qty 0 / price 0)', { ...sample, items: sample.items.map((l, i) => ({ ...l, qty: i % 2 ? 0 : l.qty, unitPrice: i % 2 ? l.unitPrice : 0 })) }],
    ['all 5 rows used (maximum Excel table, incl. "+ เพิ่ม")', { ...sample, items: fullTable }],
    ['large values (30 days × 25,000)', { ...sample, items: [{ label: 'ค่าแรงตรวจสอบที่ดิน', qty: 30, unit: 'วัน', unitPrice: 25000 }] }],
    ['fractional values (1.5 days × 1,333.33)', { ...sample, items: sample.items.map(l => ({ ...l, qty: l.qty + 0.5, unitPrice: l.unitPrice + 0.33 })) }],
    ['header text filled (no formula reads it)', { ...sample, projectName: 'โครงการ ก', province: 'ระยอง', surveyDate: '2026-01-15', inspector: 'นาย ข' }],
    ...Array.from({ length: 50 }, (_, k): [string, LandInspectionInput] => [`random #${k} (seed ${36_000 + k})`, randomInput(36_000 + k)]),
];

function appResult(input: LandInspectionInput): ProjectResult {
    const p = createProject();
    p.calculators['land-inspection'] = input;
    return computeProject(p);
}

function expectSection(oracle: ExcelOracle, boq: BoqResult, no: number, excelRow: number, label = ''): void {
    const s = boq.sections.find(x => x.no === no);
    expectClose(s?.matTotal, oracle.num(`${BOQ}!J${excelRow}`), `${label} section ${no} J${excelRow}`);
    expectClose(s?.labTotal, oracle.num(`${BOQ}!L${excelRow}`), `${label} section ${no} L${excelRow}`);
    expectClose(s?.total, oracle.num(`${BOQ}!M${excelRow}`), `${label} section ${no} M${excelRow}`);
}

const SAMPLE_CONSTRUCTION_TOTAL = computeProject(createProject()).boq.constructionTotal;

describe('ค่าตรวจสอบที่ดิน vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    let excelM310: number;
    beforeAll(async () => {
        oracle = await loadV5Oracle();
        oracle.reset();
        excelM310 = oracle.num(`${BOQ}!M310`);
    }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...Array.from({ length: EXCEL_ROWS }, (_, i) => at('F', i)), `${SHEET}!F14`,
            ...['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}9`), `${BOQ}!J10`, `${BOQ}!L10`, `${BOQ}!M10`, `${BOQ}!M310`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
        expect(oracle.formula(`${BOQ}!K9`)).toBeUndefined();   // D3: typed, not linked
    });

    it('the cases cover empty / partial / full tables, zero and fractional values, blank units', () => {
        const has = (p: (i: LandInspectionInput) => boolean) => CASES.filter(([, i]) => p(i)).length;
        expect(has(i => i.items.length === 0)).toBeGreaterThan(1);
        expect(has(i => i.items.length === EXCEL_ROWS)).toBeGreaterThan(5);
        expect(has(i => i.items.length > 0 && i.items.length < EXCEL_ROWS)).toBeGreaterThan(20);
        expect(has(i => i.items.some(l => l.qty === 0 || l.unitPrice === 0))).toBeGreaterThan(5);
        expect(has(i => i.items.some(l => !Number.isInteger(l.qty)))).toBeGreaterThan(5);
        expect(has(i => i.items.some(l => l.unit === ''))).toBeGreaterThan(2);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['land-inspection'] ?? {};

        // 1. per row F = C × E, unused rows 0
        input.items.forEach((row, i) => expectClose(lineTotal(row), oracle.num(at('F', i)), `row ${i} ${at('F', i)}`));
        for (let i = input.items.length; i < EXCEL_ROWS; i++) expect(oracle.num(at('F', i)), `unused ${at('F', i)}`).toBe(0);

        // 2. every output of compute()
        for (const [key, v] of Object.entries(out)) {
            const ref = OUTPUT_CELLS[key];
            if (ref === undefined) expect.fail(`output ${key} has no Excel mapping — add it to OUTPUT_CELLS`);
            else expectClose(v, oracle.num(ref), `output ${key} (${ref})`);
        }
        expect(Object.keys(out).sort()).toEqual(Object.keys(OUTPUT_CELLS).sort());

        // 3. D3: Excel K9 is a typed 7,500; the app links F14 → row 9 differs by exactly (F14 − K9) × E9
        const f14 = oracle.num(`${SHEET}!F14`);
        const r9 = boqItem(res.boq, 'R9');
        expectClose(r9?.labUnit, f14, 'app K9 = F14');
        const delta = (f14 - oracle.num(`${BOQ}!K9`)) * oracle.num(`${BOQ}!E9`);
        expectClose((r9?.labTotal ?? NaN) - oracle.num(`${BOQ}!L9`), delta, 'L9 − D3 delta');
        expectClose((r9?.total ?? NaN) - oracle.num(`${BOQ}!M9`), delta, 'M9 − D3 delta');

        // 4. F14 typed into K9 like a user → row 9 and section 0 exact
        oracle.setInputs({ [`${BOQ}!K9`]: f14 });
        expectBoqRow(oracle, res.boq, 'R9', 9);
        expectSection(oracle, res.boq, 0, 10);

        // 5. D2: section 0 stays out of the construction total, in Excel (M310) and in the app
        expectClose(oracle.num(`${BOQ}!M310`), excelM310, 'Excel M310 does not move with M10');
        expectClose(res.boq.constructionTotal, SAMPLE_CONSTRUCTION_TOTAL, 'app construction total does not move');
        expectClose(res.boq.preConstructionTotal, oracle.num(`${BOQ}!M10`), 'app pre-construction total = M10');
    });

    it('D5: cost rows beyond Excel\'s 5 — Excel holds the first 5, the app adds the extra rows on top', () => {
        const input: LandInspectionInput = { ...sample, items: [...fullTable, ...EXTRA] };
        oracle.replaceInputs(excelInputs({ ...input, items: input.items.slice(0, EXCEL_ROWS) }));
        const out = appResult(input).calcOutputs['land-inspection'] ?? {};
        const extra = EXTRA.reduce((s, l) => s + l.qty * l.unitPrice, 0);
        expectClose((out.total ?? NaN) - oracle.num(`${SHEET}!F14`), extra, 'total − Excel F14 = extra rows');
    });
});
