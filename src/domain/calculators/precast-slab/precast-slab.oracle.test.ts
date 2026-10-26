// Differential test: precast slab (" พื้นสำเร็จรูป_PS", sheet 29) compute() + BOQ vs the real Excel v5 formulas
// (evaluated by the oracle) on 50 seeded random panel schedules and named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
// Feeds: R97 slab (= PS!E6; R98 props = 0.1 × E97), sheet 24 row 10 → R99 wire mesh, R101–R103 formwork,
// R104 concrete, and the shear key → BOQ 8.4 (row 75, no tie wire).
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    BOQ_SHEET as BOQ, expectBoqRowD1, expectNumberOrText, expectRebarBlock, expectSectionTotal, rebarKgOf, rebarLayout,
    sumDeltas, type RebarBlock,
} from '../../../test-utils/oracle-boq-checks';
import { expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import {
    PRECAST_KEY_WEIGHT_ROWS, PRECAST_TABLE, SHEETS, precastExcelInputs, randomPrecastInput, randomPrecastPanel, tableRef,
} from '../../../test-utils/oracle-structure-inputs';
import { REBAR_SIZES } from '../../boq/slots';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { precastPanel, precastSlab, type PrecastPanelResult, type PrecastPanelRow, type PrecastSlabInput } from '.';

const SHEET = SHEETS.precast;
const at = (col: string, i: number) => tableRef(PRECAST_TABLE, col, i);

/** precastPanel() field → computed column of the same Excel row (text = what Excel shows instead of null). */
const ROW_OUTPUTS: readonly (readonly [keyof PrecastPanelResult, string, string?])[] = [
    ['area', 'E'], ['wiremesh', 'G'], ['keyCount', 'K', '_'], ['keyTotalLength', 'L', '_'], ['keyWeight', 'M'],
    ['perimeter', 'O'], ['formwork', 'P'], ['concrete', 'S'],
];

/** The Excel value an output key stands for (undefined = unmapped: the test fails). */
function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    const direct: Record<string, string> = { area: 'E6', wiremesh: 'G6', formwork: 'O6', concrete: 'R6' };
    if (direct[key]) return o.num(`${SHEET}!${direct[key]}`);
    const m = /^rebar\.(RB6|RB9|DB12|DB16|DB20)$/.exec(key);
    if (!m?.[1]) return undefined;
    const k = REBAR_SIZES.indexOf(m[1] as typeof REBAR_SIZES[number]);
    expectClose(o.num(`${SHEETS.summary}!${'IJKLM'.charAt(k)}10`), o.num(`${SHEET}!${'HIJKL'.charAt(k)}6`), `sheet 24 ${'IJKLM'.charAt(k)}10`);
    return o.num(`${SHEET}!${'HIJKL'.charAt(k)}6`);
}

/** BOQ 8.4 เหล็กล๊อคหัวแผ่นพื้นสำเร็จรูป: one Excel row (75, G 6 %), no tie wire. */
const BLOCK: RebarBlock = { slot: 'precast-slab:shear-key', rows: [75] };
/** BOQ 8.3 (ground beam, at the Excel sample here). */
const BEAM_BLOCK: RebarBlock = { slot: 'ground-beam:rebar', rows: [71, 72], tieWire: 73 };

// ─── Cases ──────────────────────────────────────────────────────────────────
const sample = precastSlab.defaults();
const p1 = sample.panels[0] as PrecastPanelRow;
const ZERO_ROW: PrecastPanelRow = { width: 0, length: 0, keySize: '', keySpacing: 0, keyBarLength: 0, topping: 0 };
const panels = (n: number, seed: number, noKeyFrom = Infinity): PrecastPanelRow[] => {
    const rng = seededRandom(seed);
    return Array.from({ length: n }, (_, i) => ({ ...randomPrecastPanel(rng), keySize: 'RB6', ...(i >= noKeyFrom ? { keySpacing: 0 } : {}) }));
};
const CASES: [string, PrecastSlabInput][] = [
    ['Excel sample (9 panels)', sample],
    ['no panels', { panels: [] }],
    ['a row of zeros and blanks', { panels: [ZERO_ROW] }],
    ['no shear key (spacing 0 → "_")', { panels: [{ ...p1, keySpacing: 0 }] }],
    ['no topping (0 formwork, 0 concrete)', { panels: [{ ...p1, topping: 0 }] }],
    ['ROUNDUP boundary 2·1.05/0.35 = 6.000000000000001 → 6', { panels: [{ ...p1, width: 1.05 }] }],
    ['RB9 only (Excel row 75 keeps 6 %)', { panels: [{ ...p1, keySize: 'RB9' }] }],
    ['DB12 only (row 75 keeps 6 %)', { panels: [{ ...p1, keySize: 'DB12' }] }],
    ['two bar sizes (Excel #SPILL!)', { panels: [p1, { ...p1, keySize: 'RB9' }] }],
    ['every bar size (Excel #SPILL!)', { panels: (['RB6', 'RB9', 'DB12', 'DB16', 'DB20']).map(keySize => ({ ...p1, keySize })) }],
    ['fractional values', { panels: [{ width: 2.337, length: 3.183, keySize: 'RB6', keySpacing: 0.333, keyBarLength: 0.75, topping: 0.045 }] }],
    ['14 panels (the last Excel row with a shear-key weight formula, M21)', { panels: panels(PRECAST_KEY_WEIGHT_ROWS, 2914) }],
    ['full Excel table (17 rows; rows 22–24 without shear key)', { panels: panels(PRECAST_TABLE.rows, 2917, PRECAST_KEY_WEIGHT_ROWS) }],
    ...Array.from({ length: 50 }, (_, k): [string, PrecastSlabInput] => [`random #${k} (seed ${29_000 + k})`, randomPrecastInput(29_000 + k)]),
];

function appResult(input: PrecastSlabInput): ProjectResult {
    const p = createProject();
    p.calculators['precast-slab'] = input;
    return computeProject(p);
}

describe(' พื้นสำเร็จรูป_PS vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    /** The full comparison of one case (also used by the it.fails case below). */
    function compare(input: PrecastSlabInput): void {
        oracle.replaceInputs(precastExcelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['precast-slab'] ?? {};

        // 1. every computed cell of every used row; unused rows stay 0
        input.panels.forEach((row, i) => {
            const r = precastPanel(row);
            for (const [field, col, text] of ROW_OUTPUTS) {
                const v = r[field];
                if (text !== undefined) expectNumberOrText(oracle, v, at(col, i), text, `row ${i} ${field}`);
                else expectClose(v ?? NaN, oracle.num(at(col, i)), `row ${i} ${col}${PRECAST_TABLE.first + i} ${field}`);
            }
        });
        for (let i = input.panels.length; i < PRECAST_TABLE.rows; i++) {
            for (const col of ['E', 'M', 'P', 'S']) expect(oracle.num(at(col, i)), `unused ${col}${PRECAST_TABLE.first + i}`).toBe(0);
        }

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping`);
            else expectClose(v, excel, `output ${key}`);
        }

        // 3. BOQ section 10: R97 slab, R98 props, R99 wire mesh, R101–R103 formwork, R104 concrete; subtotal M105
        const s10 = sumDeltas(
            ...[97, 98, 99, 101, 102, 103].map(r => expectBoqRowD1(oracle, res.boq, `R${r}`, r)),
            // D1 (engine.ts): no concrete → Excel MAX(1, CEILING(0, 0.25)) = 1 m³, the app 0
            expectBoqRowD1(oracle, res.boq, 'R104', 104, { gross: 'concrete' }),
        );
        expectSectionTotal(oracle, res.boq, 10, 105, s10);

        // 4. shear key 8.4 (row 75) and section 8 (M81): the other rows stay at the Excel sample, so section 8
        //    differs by exactly the shear-key block delta
        const s8 = sumDeltas(
            ...[68, 69, 77, 78, 79].map(r => expectBoqRowD1(oracle, res.boq, `R${r}`, r)),
            expectBoqRowD1(oracle, res.boq, 'R80', 80, { gross: 'concrete' }),
            expectRebarBlock(oracle, res.boq, BEAM_BLOCK, rebarKgOf(res.calcOutputs['ground-beam'] ?? {})),
            expectRebarBlock(oracle, res.boq, BLOCK, rebarKgOf(out)),
        );
        expectSectionTotal(oracle, res.boq, 8, 81, s8);
    }

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...['E6', 'G6', 'H6', 'L6', 'O6', 'R6', 'K8', 'M8', 'M21', 'P24', 'S24'].map(c => `${SHEET}!${c}`),
            ...['G10', 'H10', 'I10', 'M10', 'O10', 'P10'].map(c => `${SHEETS.summary}!${c}`),
            ...[75, 97, 98, 99, 101, 102, 103, 104].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!D75`, `${BOQ}!M81`, `${BOQ}!M105`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover every BOQ 8.4 layout, no shear key, zero concrete, 14 and 17 panels', () => {
        oracle.reset();
        const outs = CASES.map(([, input]) => precastSlab.compute(input, { outputs: () => undefined }));
        expect(new Set(outs.map(o => rebarLayout(oracle, BLOCK, rebarKgOf(o))))).toEqual(new Set([
            '0 size(s), Excel waste', '1 size(s), Excel waste', '1 size(s), per-size waste differs', '2+ sizes (Excel #SPILL!)',
        ]));
        const has = (p: (input: PrecastSlabInput) => boolean) => CASES.filter(([, input]) => p(input)).length;
        expect(has(i => i.panels.some(s => s.keySpacing === 0))).toBeGreaterThan(5);
        expect(has(i => i.panels.length === PRECAST_KEY_WEIGHT_ROWS)).toBeGreaterThan(1);
        expect(has(i => i.panels.length === PRECAST_TABLE.rows)).toBe(1);
        expect(outs.filter(o => o.concrete === 0).length).toBeGreaterThan(1);
        // the random sets stay within Excel's shear-key formula rows (see the it.fails case)
        expect(CASES.every(([, i]) => i.panels.every((p, k) => k < PRECAST_KEY_WEIGHT_ROWS || p.keySpacing === 0))).toBe(true);
    });

    it.each(CASES)('%s', (_name, input) => { compare(input); });

    // REAL MISMATCH (not a documented decision; reported to the coordinator, domain code unchanged):
    // Excel's shear-key weight column M has its formula on rows 8–21 only — M22:M24 are empty although the table
    // (and its K/L columns, and the H6:L6 SUMIFs over rows 8–100) run to row 24. A 15th–17th panel's shear key is
    // therefore never weighed in Excel; the app weighs every panel.
    // Inputs: 17 panels 3 × 3 m, RB6 @ 0.35 m, 0.80 m a bar, topping 0.05 → per panel ROUNDUP(6/0.35) = 18 bars,
    // 14.4 m, 3.1968 kg. Excel H6 (sheet 24 I10, BOQ E75) = 14 × 3.1968 = 44.7552 kg; app rebar.RB6 = 17 × 3.1968
    // = 54.3456 kg (row 22 M: Excel empty, app 3.1968).
    it.fails('PS rows 22–24 shear key: Excel H6 44.7552 kg (M22:M24 have no formula), app 54.3456 kg — 17 panels 3×3, RB6 @0.35, 0.8 m; see report', () => {
        compare({ panels: Array.from({ length: PRECAST_TABLE.rows }, () => ({ width: 3, length: 3, keySize: 'RB6', keySpacing: 0.35, keyBarLength: 0.8, topping: 0.05 })) });
    });
});
