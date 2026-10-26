// Differential test: stair compute() + BOQ section 13 (rows 138–145) vs the real Excel v5 formulas (evaluated by
// the oracle) on ~50 seeded random stair schedules. Guide: docs/rebuild/ORACLE_TESTS.md.
//
// The stair formulas are ported as they are (tradesman's rules, D1), and Excel's row-6 totals cover the whole
// 10-row table, so the sheet itself must match exactly. Documented BOQ differences, asserted exactly:
// - D1 concrete: with no concrete Excel still orders MAX(1, CEILING(0, 0.25)) = 1 m³ (R145); the app 0.
// - D5/D12: Excel's one rebar row keeps G138 = 9 % (RB9) whatever the size; the app uses the size's own waste.
//   A second size makes the FILTER spill fail (#SPILL!) and the stair rebar drops out of the Excel BOQ.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import {
    addDeltas, expectConcreteRow, expectRebarBlock, expectSectionDelta, expectStdRowQtyDelta, rebarLayout, type BoqDelta,
} from '../../../test-utils/oracle-boq-helpers';
import { expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { REBAR_SIZES } from '../../boq/slots';
import { computeProject, createProject, type ProjectResult } from '../../project';
import {
    stair, stairRow, stairTotals, STAIR_BAR_SIZES, STAIR_GROUPS, STAIR_NAMES, type StairGroupKey, type StairInput,
    type StairRow, type StairRowResult,
} from '.';

const SHEET = 'บันได_Stair';
const SUMMARY = 'ตารางสรุปวัสดุงานโครงสร้าง';
const BOQ = 'BOQ (Home)';
/** Excel table rows 8–17. */
const FIRST_ROW = 8;
const EXCEL_ROWS = 10;
const at = (col: string, i: number) => `${SHEET}!${col}${FIRST_ROW + i}`;

// ─── Input mapping ──────────────────────────────────────────────────────────
const INPUT_COLUMNS: readonly [keyof StairRow, string][] = [
    ['name', 'B'], ['width', 'C'], ['waist', 'D'], ['rise', 'E'], ['run', 'F'], ['steps', 'H'], ['riser', 'I'], ['tread', 'J'],
    ['waistMainSize', 'L'], ['waistMainSpacing', 'M'], ['waistTempSize', 'Q'], ['waistTempSpacing', 'R'],
    ['stepMainSize', 'V'], ['stepMainSpacing', 'W'], ['stepTempSize', 'AA'], ['stepTempSpacing', 'AB'],
];

function excelInputs(input: StairInput): Record<string, OracleInput> {
    if (input.rows.length > EXCEL_ROWS) throw new Error(`Excel has ${EXCEL_ROWS} stair rows`);
    const out: Record<string, OracleInput> = {};
    for (let i = 0; i < EXCEL_ROWS; i++) {
        const row = input.rows[i];
        for (const [field, col] of INPUT_COLUMNS) {
            const v = row?.[field];
            out[at(col, i)] = v === undefined || v === '' ? null : v;
        }
    }
    return out;
}

// ─── Output mapping ─────────────────────────────────────────────────────────
/** Bar group → Excel columns of จำนวน / ยาวรวม / น้ำหนัก, and the row-6 SUMIF columns RB6…DB20. */
const GROUP_COLUMNS: Record<StairGroupKey, { count: string; length: string; kg: string; totals: string[] }> = {
    waistMain: { count: 'N', length: 'O', kg: 'P', totals: ['L', 'M', 'N', 'O', 'P'] },
    waistTemp: { count: 'S', length: 'T', kg: 'U', totals: ['Q', 'R', 'S', 'T', 'U'] },
    stepMain: { count: 'X', length: 'Y', kg: 'Z', totals: ['V', 'W', 'X', 'Y', 'Z'] },
    stepTemp: { count: 'AC', length: 'AD', kg: 'AE', totals: ['AA', 'AB', 'AC', 'AD', 'AE'] },
};
type PlainField = Exclude<keyof StairRowResult, StairGroupKey>;
const ROW_OUTPUTS: readonly [PlainField, string][] = [
    ['inclined', 'G'], ['props', 'AG'], ['soffit', 'AH'], ['waistSides', 'AI'], ['stepSides', 'AJ'], ['risers', 'AK'],
    ['formwork', 'AL'], ['waistConcrete', 'AN'], ['stepConcrete', 'AO'], ['concrete', 'AP'],
];

function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    const direct: Record<string, string> = { props: `${SHEET}!AG6`, formwork: `${SHEET}!AH6`, concrete: `${SHEET}!AN6` };
    if (direct[key]) return o.num(direct[key]);
    const bySize = /^rebar\.(RB6|RB9|DB12|DB16|DB20)$/.exec(key);
    if (bySize?.[1]) return o.num(`${SUMMARY}!${'IJKLM'.charAt(REBAR_SIZES.indexOf(bySize[1] as typeof REBAR_SIZES[number]))}14`);
    return undefined;
}

// ─── Random but plausible stairs ────────────────────────────────────────────
const round = (x: number) => Number(x.toFixed(4));

function randomRow(rng: Random): StairRow {
    const steps = rng.int(2, 18);
    const riser = rng.step(0.15, 0.2, 0.01);
    const tread = rng.step(0.22, 0.3, 0.01);
    const size = () => (rng.chance(0.03) ? '' : rng.chance(0.75) ? 'RB9' : rng.pick(STAIR_BAR_SIZES));
    const spacing = () => (rng.chance(0.06) ? 0 : rng.pick([0.1, 0.15, 0.15, 0.2, 0.25]));
    return {
        name: rng.pick(STAIR_NAMES),
        width: rng.step(0.8, 3.5, 0.05),
        waist: rng.pick([0.12, 0.14, 0.15, 0.18]),
        // rise/run usually steps × riser/tread (as in the sample), sometimes typed independently (Excel has no check)
        rise: rng.chance(0.7) ? round(steps * riser) : rng.step(0.3, 3.5, 0.05),
        run: rng.chance(0.7) ? round(steps * tread) : rng.step(0.5, 5, 0.05),
        steps, riser, tread,
        waistMainSize: size(), waistMainSpacing: spacing(),
        waistTempSize: size(), waistTempSpacing: spacing(),
        stepMainSize: size(), stepMainSpacing: spacing(),
        stepTempSize: size(), stepTempSpacing: spacing(),
    };
}

function randomInput(seed: number): StairInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.08) ? EXCEL_ROWS : rng.pick([1, 1, 2, 3, 3, 4]);
    return { rows: Array.from({ length: n }, () => randomRow(rng)) };
}

const sample = stair.defaults();
const sampleRow = sample.rows[0] ?? randomRow(seededRandom(1));
const allSizes = (size: string): Partial<StairRow> =>
    ({ waistMainSize: size, waistTempSize: size, stepMainSize: size, stepTempSize: size });
const CASES: [string, StairInput][] = [
    ['Excel sample', sample],
    ['no stairs (D1: Excel still orders 1 m³)', { rows: [] }],
    ['no spacing anywhere (Excel "_"; step temperature bars ignore AB)', {
        rows: [{ ...sampleRow, waistMainSpacing: 0, waistTempSpacing: 0, stepMainSpacing: 0, stepTempSpacing: 0 }],
    }],
    ['DB12 everywhere (G138 9 % vs DB12 12 %)', { rows: [{ ...sampleRow, ...allSizes('DB12') }] }],
    ['two sizes (Excel #SPILL!)', { rows: [{ ...sampleRow, stepTempSize: 'RB6' }] }],
    ['zero width (no concrete, D1)', { rows: [{ ...sampleRow, width: 0 }] }],
    ['10 rows (the whole Excel table)', {
        rows: Array.from({ length: EXCEL_ROWS }, (_, i) => ({ ...sampleRow, width: 1 + i * 0.2, steps: 3 + i, rise: round((3 + i) * 0.15), run: round((3 + i) * 0.3) })),
    }],
    ...Array.from({ length: 50 }, (_, k): [string, StairInput] => [`random #${k} (seed ${33_000 + k})`, randomInput(33_000 + k)]),
];

function appResult(input: StairInput): ProjectResult {
    const p = createProject();
    p.calculators.stair = input;
    return computeProject(p);
}

/** Excel G138: the waste typed on the single rebar slot row. */
const SLOT_WASTE = [0.09];

describe('บันได_Stair vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...['L6', 'P6', 'Q6', 'U6', 'V6', 'Z6', 'AA6', 'AE6', 'AG6', 'AH6', 'AN6'].map(c => `${SHEET}!${c}`),
            ...ROW_OUTPUTS.map(([, col]) => at(col, EXCEL_ROWS - 1)),
            ...'IJKLMNOP'.split('').map(c => `${SUMMARY}!${c}14`),
            ...[138, 139, 140, 142, 143, 144, 145].flatMap(r => ['D', 'E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!M146`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
        expect(oracle.num(`${BOQ}!G138`)).toBe(SLOT_WASTE[0]);
    });

    it('the cases cover every branch: rebar layouts, "_" spacings, zero/small/normal concrete, a full table, every size per group', () => {
        const layouts = new Set(CASES.map(([, input]) => rebarLayout(stairTotals(input).rebar, SLOT_WASTE)));
        expect([...layouts].sort()).toEqual(['Excel waste', 'more sizes than Excel rows (#SPILL!)', 'no rebar', 'per-size waste differs']);
        const rows = CASES.flatMap(([, input]) => input.rows);
        const has = (p: (input: StairInput) => boolean) => CASES.filter(([, input]) => p(input)).length;
        const concrete = (i: StairInput) => stairTotals(i).concrete;
        expect(has(i => i.rows.length === EXCEL_ROWS)).toBeGreaterThan(1);
        expect(has(i => concrete(i) === 0)).toBeGreaterThan(1);
        expect(has(i => concrete(i) > 0 && concrete(i) * 1.1 < 1)).toBeGreaterThan(3);
        expect(has(i => concrete(i) * 1.1 > 1)).toBeGreaterThan(10);
        expect(rows.filter(r => r.rise !== round(r.steps * r.riser)).length).toBeGreaterThan(5);
        for (const g of STAIR_GROUPS) {
            expect(rows.filter(r => r[g.spacing] === 0).length, `${g.key} no spacing`).toBeGreaterThan(1);
            expect(rows.some(r => r[g.size] === ''), `${g.key} blank size`).toBe(true);
            for (const s of STAIR_BAR_SIZES) expect(rows.some(r => r[g.size] === s), `${g.key} ${s}`).toBe(true);
        }
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs.stair ?? {};

        // 1. every computed cell of every used row (null = Excel "_"); unused rows stay 0
        input.rows.forEach((row, i) => {
            const r = stairRow(row);
            for (const [field, col] of ROW_OUTPUTS) expectClose(r[field], oracle.num(at(col, i)), `row ${i} ${col}${FIRST_ROW + i} ${field}`);
            for (const g of STAIR_GROUPS) {
                const cols = GROUP_COLUMNS[g.key];
                for (const part of ['count', 'length', 'kg'] as const) {
                    const v = r[g.key][part];
                    const ref = at(cols[part], i);
                    if (v === null) expect(oracle.get(ref), `row ${i} ${ref} ${g.key}.${part}`).toBe('_');
                    else expectClose(v, oracle.num(ref), `row ${i} ${ref} ${g.key}.${part}`);
                }
            }
        });
        for (let i = input.rows.length; i < EXCEL_ROWS; i++) {
            for (const [, col] of ROW_OUTPUTS) expect(oracle.num(at(col, i)), `unused row ${col}${FIRST_ROW + i}`).toBe(0);
        }

        // 2. every output of compute() (unmapped keys fail), and the row-6 SUMIF per group and size
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping — add it to excelValueOf`);
            else expectClose(v, excel, `output ${key}`);
        }
        const totals = stairTotals(input);
        for (const g of STAIR_GROUPS) {
            REBAR_SIZES.forEach((s, k) => expectClose(totals.groups[g.key][s], oracle.num(`${SHEET}!${GROUP_COLUMNS[g.key].totals[k] ?? ''}6`), `${g.key} ${s} row 6`));
        }

        // 3. BOQ (Home) rows 140–145 (E = sheet 24 N14/O14/P14 = AG6/AH6/AN6), rebar slot R138–R139, section 13
        const deltas: BoqDelta[] = [
            expectStdRowQtyDelta(oracle, res.boq, 'R140', 140, 0, 'props'),
            expectStdRowQtyDelta(oracle, res.boq, 'R142', 142, 0, 'formwork'),
            expectStdRowQtyDelta(oracle, res.boq, 'R143', 143, 0, 'ไม้คร่าว'),
            expectStdRowQtyDelta(oracle, res.boq, 'R144', 144, 0, 'ตะปู'),
            expectConcreteRow(oracle, res.boq, 'R145', 145, 'concrete'),
        ];
        const weights = Object.fromEntries(REBAR_SIZES.map(s => [s, out[`rebar.${s}`] ?? 0]));
        deltas.push(expectRebarBlock(oracle, res.boq, { calc: 'stair', firstRow: 138, excelSlots: 1, weights }));
        expectSectionDelta(oracle, res.boq, 13, 146, addDeltas(...deltas));
    });
});
