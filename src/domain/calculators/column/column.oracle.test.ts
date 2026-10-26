// Differential test: column (เสา_Column, sheet 30) compute() + BOQ vs the real Excel v5 formulas (evaluated by the
// oracle) on 50 seeded random column schedules and named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
// Feeds: sheet 24 row 11 → BOQ 6.7 rebar (rows 51–53), 11.2 formwork (R108–R110), 11.3 concrete (R111).
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    BOQ_SHEET as BOQ, expectBoqRowD1, expectNumberOrText, expectRebarBlock, expectSectionTotal, rebarKgOf, rebarLayout,
    sumDeltas, type RebarBlock,
} from '../../../test-utils/oracle-boq-checks';
import { expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import {
    COLUMN_TABLE, SHEETS, firstRow, columnExcelInputs, randomColumnInput, randomColumnRow, tableRef,
} from '../../../test-utils/oracle-structure-inputs';
import { REBAR_SIZES } from '../../boq/slots';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { column, columnRowCalc, type ColumnInput, type ColumnRow, type ColumnRowCalc } from '.';

const SHEET = SHEETS.column;
const at = (col: string, i: number) => tableRef(COLUMN_TABLE, col, i);

/** columnRowCalc() field → computed column of the same Excel row (text = what Excel shows instead of null). */
const ROW_OUTPUTS: readonly (readonly [keyof ColumnRowCalc, string, string?])[] = [
    ['mainBarLength', 'J'], ['mainTotalLength', 'K'], ['mainWeight', 'L'],
    ['stirrupCount', 'O', '_'], ['stirrupLength', 'P'], ['stirrupTotalLength', 'Q', '-'], ['stirrupWeight', 'R'],
    ['formwork', 'T'], ['concrete', 'V'],
];

/** The Excel value an output key stands for (undefined = unmapped: the test fails). */
function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    if (key === 'formwork') return o.num(`${SHEET}!T6`);
    if (key === 'concrete') return o.num(`${SHEET}!V6`);
    const m = /^(main|stirrup|rebar)\.(RB6|RB9|DB12|DB16|DB20)$/.exec(key);
    if (!m?.[1] || !m[2]) return undefined;
    const k = REBAR_SIZES.indexOf(m[2] as typeof REBAR_SIZES[number]);
    if (m[1] === 'main') return o.num(`${SHEET}!${'HIJKL'.charAt(k)}6`);
    if (m[1] === 'stirrup') return o.num(`${SHEET}!${'MNOPQ'.charAt(k)}6`);
    return o.num(`${SHEETS.summary}!${'IJKLM'.charAt(k)}11`);   // sheet 24 row 11 = main + stirrup
}

/** BOQ 6.7 เหล็กเสริม - ***เสาชั้น 1: Excel rows 51 (G 6 %) and 52 (G 12 %), tie wire 53. */
const BLOCK: RebarBlock = { slot: 'column:rebar', rows: [51, 52], tieWire: 53 };

// ─── Cases ──────────────────────────────────────────────────────────────────
const sampleRow = firstRow(column.defaults().columns);
const ZERO_ROW: ColumnRow = { name: '', count: 0, width: 0, depth: 0, height: 0, mainSize: '', mainCount: 0, stirrupSize: '', stirrupSpacing: 0 };
const CASES: [string, ColumnInput][] = [
    ['Excel sample (F8 typed =0.55+3.5)', column.defaults()],
    ['no columns', { columns: [] }],
    ['a row of zeros and blanks', { columns: [ZERO_ROW] }],
    ['no stirrups (spacing 0 → "_" / "-")', { columns: [{ ...sampleRow, stirrupSpacing: 0 }] }],
    ['ROUNDUP boundary (0.75+0.6)/0.15 = 9.000000000000002 → 9', { columns: [{ ...sampleRow, height: 0.75 + 0.6 }] }],
    ['height 0 with spacing (0 stirrups)', { columns: [{ ...sampleRow, height: 0 }] }],
    ['one size, RB6 only (Excel row 51 waste)', { columns: [{ ...sampleRow, mainSize: 'RB6' }] }],
    ['one size, RB9 only (row 51 keeps 6 %)', { columns: [{ ...sampleRow, mainSize: 'RB9', stirrupSize: 'RB9' }] }],
    ['two sizes RB9 + DB12 (row 51 keeps 6 %)', { columns: [{ ...sampleRow, stirrupSize: 'RB9' }] }],
    ['two sizes RB6 + DB16 (DB16 12 % like row 52)', { columns: [{ ...sampleRow, mainSize: 'DB16' }] }],
    ['every bar size (5 sizes → Excel #SPILL!)', {
        columns: [
            { ...sampleRow, mainSize: 'DB16', stirrupSize: 'RB9' },
            { ...sampleRow, name: 'C2', mainSize: 'DB20' },
            { ...sampleRow, name: 'C3' },
        ],
    }],
    ['unknown bar size text (0 kg)', { columns: [{ ...sampleRow, mainSize: 'DB25', stirrupSize: '' }] }],
    ['fractional values', {
        columns: [{ name: 'C2', count: 7, width: 0.237, depth: 0.183, height: 3.333, mainSize: 'DB16', mainCount: 5, stirrupSize: 'RB6', stirrupSpacing: 0.125 }],
    }],
    ['full Excel table (10 rows)', (() => {
        const rng = seededRandom(3010);
        return { columns: Array.from({ length: COLUMN_TABLE.rows }, () => randomColumnRow(rng)) };
    })()],
    ...Array.from({ length: 50 }, (_, k): [string, ColumnInput] => [`random #${k} (seed ${30_000 + k})`, randomColumnInput(30_000 + k)]),
];

function appResult(input: ColumnInput): ProjectResult {
    const p = createProject();
    p.calculators.column = input;
    return computeProject(p);
}

describe('เสา_Column vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...['H6', 'L6', 'M6', 'Q6', 'T6', 'V6', 'O8', 'R8', 'O17', 'R17'].map(c => `${SHEET}!${c}`),
            `${SHEETS.summary}!I11`, `${SHEETS.summary}!M11`,
            ...[51, 52, 53, 108, 109, 110, 111].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!D51`, `${BOQ}!D52`, `${BOQ}!M112`, `${BOQ}!M59`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover every BOQ 6.7 layout, no stirrups, zero concrete and the full 10-row table', () => {
        oracle.reset();
        const outs = CASES.map(([, input]) => column.compute(input, { outputs: () => undefined }));
        expect(new Set(outs.map(o => rebarLayout(oracle, BLOCK, rebarKgOf(o))))).toEqual(new Set([
            '0 size(s), Excel waste', '1 size(s), Excel waste', '1 size(s), per-size waste differs',
            '2 size(s), Excel waste', '2 size(s), per-size waste differs', '3+ sizes (Excel #SPILL!)',
        ]));
        const has = (p: (input: ColumnInput) => boolean) => CASES.filter(([, input]) => p(input)).length;
        expect(has(i => i.columns.some(c => c.stirrupSpacing === 0))).toBeGreaterThan(5);
        expect(has(i => i.columns.length === COLUMN_TABLE.rows)).toBeGreaterThan(1);
        expect(outs.filter(o => o.concrete === 0).length).toBeGreaterThan(1);
        expect(has(i => i.columns.some(c => c.mainSize !== 'DB12'))).toBeGreaterThan(10);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(columnExcelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs.column ?? {};

        // 1. every computed cell of every used row; unused rows stay 0
        input.columns.forEach((row, i) => {
            const r = columnRowCalc(row);
            for (const [field, col, text] of ROW_OUTPUTS) {
                const v = r[field];
                if (text !== undefined) expectNumberOrText(oracle, v, at(col, i), text, `row ${i} ${field}`);
                else expectClose(v ?? NaN, oracle.num(at(col, i)), `row ${i} ${col}${COLUMN_TABLE.first + i} ${field}`);
            }
        });
        for (let i = input.columns.length; i < COLUMN_TABLE.rows; i++) {
            for (const col of ['K', 'L', 'R', 'T', 'V']) expect(oracle.num(at(col, i)), `unused ${col}${COLUMN_TABLE.first + i}`).toBe(0);
        }

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping`);
            else expectClose(v, excel, `output ${key}`);
        }

        // 3. BOQ section 11 (R108 ไม้แบบ, R109/R110 = 0.6/0.25 × R108, R111 concrete) and its subtotal M112
        const s11 = sumDeltas(
            expectBoqRowD1(oracle, res.boq, 'R108', 108),
            expectBoqRowD1(oracle, res.boq, 'R109', 109),
            expectBoqRowD1(oracle, res.boq, 'R110', 110),
            // D1 (engine.ts): no concrete → Excel MAX(1, CEILING(0, 0.25)) = 1 m³, the app 0
            expectBoqRowD1(oracle, res.boq, 'R111', 111, { gross: 'concrete' }),
        );
        expectSectionTotal(oracle, res.boq, 11, 112, s11);

        // 4. rebar slot 6.7 (Excel rows 51–53) and section 6 (M59), which differs by exactly the block delta
        const block = expectRebarBlock(oracle, res.boq, BLOCK, rebarKgOf(out));
        expectSectionTotal(oracle, res.boq, 6, 59, block);
    });
});
