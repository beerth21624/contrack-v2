// Differential test: slab on grade (พื้นหล่อในที่_S, sheet 28) compute() + BOQ vs the real Excel v5 formulas
// (evaluated by the oracle) on 50 seeded random slab schedules and named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
// Feeds: sheet 24 row 9 → BOQ 9.2 backfill (R88), 9.3 sand (R89), 9.4 plastic (R90), 9.5 rebar (R92–R93),
// 9.6 concrete (R94).
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    BOQ_SHEET as BOQ, expectBoqRowD1, expectRebarBlock, expectSectionTotal, rebarKgOf, rebarLayout, sumDeltas,
    type RebarBlock,
} from '../../../test-utils/oracle-boq-checks';
import { expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import {
    SHEETS, SLAB_TABLE, randomSlabInput, randomSlabRow, slabExcelInputs, tableRef,
} from '../../../test-utils/oracle-structure-inputs';
import { REBAR_SIZES } from '../../boq/slots';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { slabOnGrade, slabRowCalc, type SlabOnGradeInput, type SlabRow, type SlabRowCalc } from '.';

const SHEET = SHEETS.slab;
const at = (col: string, i: number) => tableRef(SLAB_TABLE, col, i);

/** slabRowCalc() field → computed column of the same Excel row. */
const ROW_OUTPUTS: readonly (readonly [keyof SlabRowCalc, string])[] = [
    ['backfill', 'H'], ['sand', 'J'], ['plastic', 'K'], ['barLength', 'P'], ['weight', 'Q'], ['concrete', 'S'],
];

/** The Excel value an output key stands for (undefined = unmapped: the test fails). */
function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    const direct: Record<string, string> = { backfill: 'G6', sand: 'I6', plastic: 'K6', concrete: 'S6' };
    if (direct[key]) return o.num(`${SHEET}!${direct[key]}`);
    const m = /^rebar\.(RB6|RB9|DB12|DB16|DB20)$/.exec(key);
    if (!m?.[1]) return undefined;
    const k = REBAR_SIZES.indexOf(m[1] as typeof REBAR_SIZES[number]);
    expectClose(o.num(`${SHEETS.summary}!${'IJKLM'.charAt(k)}9`), o.num(`${SHEET}!${'MNOPQ'.charAt(k)}6`), `sheet 24 ${'IJKLM'.charAt(k)}9`);
    return o.num(`${SHEET}!${'MNOPQ'.charAt(k)}6`);
}

/** BOQ 9.5 เหล็กเสริม: one Excel row (92, G 9 %) and the tie wire 93. */
const BLOCK: RebarBlock = { slot: 'slab-on-grade:rebar', rows: [92], tieWire: 93 };

// ─── Cases ──────────────────────────────────────────────────────────────────
const sample = slabOnGrade.defaults();
const s1 = sample.slabs[0] as SlabRow;
const ZERO_ROW: SlabRow = { name: '', width: 0, length: 0, thickness: 0, fillDepth: 0, sandThickness: 0, barSize: '', layers: 0, spacing: 0 };
const fullTable = (): SlabRow[] => {
    const rng = seededRandom(2817);
    return Array.from({ length: SLAB_TABLE.rows }, () => ({ ...randomSlabRow(rng), barSize: 'RB9' }));
};
const CASES: [string, SlabOnGradeInput][] = [
    ['Excel sample (10 panels)', sample],
    ['no panels', { slabs: [] }],
    ['a row of zeros and blanks', { slabs: [ZERO_ROW] }],
    ['no bars (spacing 0 → IFERROR "0" × layers)', { slabs: [{ ...s1, spacing: 0 }] }],
    ['one layer of bars', { slabs: [{ ...s1, layers: 1 }] }],
    ['no fill, no sand', { slabs: [{ ...s1, fillDepth: 0, sandThickness: 0 }] }],
    ['RB6 only (Excel row 92 keeps 9 %)', { slabs: [{ ...s1, barSize: 'RB6' }] }],
    ['DB12 only (row 92 keeps 9 %)', { slabs: [{ ...s1, barSize: 'DB12' }] }],
    ['DB16 only (row 92 keeps 9 %)', { slabs: [{ ...s1, barSize: 'DB16', layers: 1 }] }],
    ['two bar sizes (Excel #SPILL!)', { slabs: [s1, { ...s1, name: 'S2', barSize: 'DB12' }] }],
    ['every bar size of the dropdown (Excel #SPILL!)', { slabs: ['RB6', 'RB9', 'DB12', 'DB16'].map(barSize => ({ ...s1, barSize })) }],
    ['fractional values', {
        slabs: [{ name: 'S2', width: 2.337, length: 3.183, thickness: 0.115, fillDepth: 0.333, sandThickness: 0.037, barSize: 'RB9', layers: 2, spacing: 0.175 }],
    }],
    ['full Excel table (17 rows)', { slabs: fullTable() }],
    ...Array.from({ length: 50 }, (_, k): [string, SlabOnGradeInput] => [`random #${k} (seed ${28_000 + k})`, randomSlabInput(28_000 + k)]),
];

function appResult(input: SlabOnGradeInput): ProjectResult {
    const p = createProject();
    p.calculators['slab-on-grade'] = input;
    return computeProject(p);
}

describe('พื้นหล่อในที่_S vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...['G6', 'I6', 'K6', 'M6', 'N6', 'Q6', 'S6', 'P8', 'Q8', 'P24', 'Q24'].map(c => `${SHEET}!${c}`),
            ...['D9', 'F9', 'I9', 'J9', 'M9', 'P9', 'Q9'].map(c => `${SHEETS.summary}!${c}`),
            ...[84, 85, 86, 87, 88, 89, 90, 92, 93, 94].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!D92`, `${BOQ}!J95`, `${BOQ}!L95`, `${BOQ}!M95`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover every BOQ 9.5 layout, no bars, one layer, zero concrete and the full 17-row table', () => {
        oracle.reset();
        const outs = CASES.map(([, input]) => slabOnGrade.compute(input, { outputs: () => undefined }));
        expect(new Set(outs.map(o => rebarLayout(oracle, BLOCK, rebarKgOf(o))))).toEqual(new Set([
            '0 size(s), Excel waste', '1 size(s), Excel waste', '1 size(s), per-size waste differs', '2+ sizes (Excel #SPILL!)',
        ]));
        const has = (p: (input: SlabOnGradeInput) => boolean) => CASES.filter(([, input]) => p(input)).length;
        expect(has(i => i.slabs.some(s => s.spacing === 0))).toBeGreaterThan(5);
        expect(has(i => i.slabs.some(s => s.layers === 1))).toBeGreaterThan(5);
        expect(has(i => i.slabs.length === SLAB_TABLE.rows)).toBeGreaterThan(1);
        expect(outs.filter(o => o.concrete === 0).length).toBeGreaterThan(1);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(slabExcelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['slab-on-grade'] ?? {};

        // 1. every computed cell of every used row; unused rows stay 0
        input.slabs.forEach((row, i) => {
            const r = slabRowCalc(row);
            for (const [field, col] of ROW_OUTPUTS) expectClose(r[field], oracle.num(at(col, i)), `row ${i} ${col}${SLAB_TABLE.first + i} ${field}`);
        });
        for (let i = input.slabs.length; i < SLAB_TABLE.rows; i++) {
            for (const col of ['H', 'J', 'K', 'Q', 'S']) expect(oracle.num(at(col, i)), `unused ${col}${SLAB_TABLE.first + i}`).toBe(0);
        }

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping`);
            else expectClose(v, excel, `output ${key}`);
        }

        // 3. BOQ section 9: the pipe rows (Excel sample), R88–R90, rebar 9.5, R94 concrete
        const pipes = sumDeltas(...[84, 85, 86, 87].map(r => expectBoqRowD1(oracle, res.boq, `R${r}`, r)));
        const s9 = sumDeltas(
            pipes,
            expectBoqRowD1(oracle, res.boq, 'R88', 88),
            expectBoqRowD1(oracle, res.boq, 'R89', 89),
            expectBoqRowD1(oracle, res.boq, 'R90', 90),
            expectRebarBlock(oracle, res.boq, BLOCK, rebarKgOf(out)),
            // D1 (engine.ts): no concrete → Excel MAX(1, CEILING(0, 0.25)) = 1 m³, the app 0
            expectBoqRowD1(oracle, res.boq, 'R94', 94, { gross: 'concrete' }),
        );
        // D1 (engine.ts): Excel J95/L95 = SUM(J88:J94)/SUM(L88:L94) leave out the pipe rows 84–87 (M95 includes them);
        // the app's subtotal sums every row, so app J/L − Excel J95/L95 = the pipe rows' J/L.
        const pipeJ = [84, 85, 86, 87].reduce((s, r) => s + oracle.num(`${BOQ}!J${r}`), 0);
        const pipeL = [84, 85, 86, 87].reduce((s, r) => s + oracle.num(`${BOQ}!L${r}`), 0);
        expectSectionTotal(oracle, res.boq, 9, 95, { mat: s9.mat + pipeJ, lab: s9.lab + pipeL, total: s9.total });
    });
});
