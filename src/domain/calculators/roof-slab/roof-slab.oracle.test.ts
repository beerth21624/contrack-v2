// Differential test: roof-slab compute() + BOQ section 12 (งานพื้นดาดฟ้า, rows 127–134) vs the real Excel v5
// formulas (evaluated by the oracle) on ~50 seeded random slab schedules. Guide: docs/rebuild/ORACLE_TESTS.md.
//
// Documented differences, asserted exactly (docs/excel-spec/02-structure-steps-06-13.md §6 oddities 3, 4, 10, 13):
// - D1 short ranges: Excel M6/N6 (props, formwork) sum rows 8–17 of the 17-row table; the app sums every row
//   (P6 concrete covers rows 8–24 in Excel too).
// - D1 concrete: with no concrete Excel still orders MAX(1, CEILING(0, 0.25)) = 1 m³ (R134); the app 0.
// - D5/D12: Excel's one rebar row keeps G127 = 9 % (RB9) whatever the size; the app uses the size's own waste.
//   A second size makes the FILTER spill fail (#SPILL!) and the slab rebar drops out of the Excel BOQ.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import {
    addDeltas, expectConcreteRow, expectRebarBlock, expectSectionDelta, expectStdRowQtyDelta, rebarLayout, type BoqDelta,
} from '../../../test-utils/oracle-boq-helpers';
import { expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { REBAR_SIZES } from '../../boq/slots';
import { computeProject, createProject, type ProjectResult } from '../../project';
import {
    roofSlab, roofSlabRow, roofSlabTotals, ROOF_SLAB_BAR_SIZES, ROOF_SLAB_LAYERS, ROOF_SLAB_NAMES, type RoofSlabInput,
    type RoofSlabRow, type RoofSlabRowResult,
} from '.';

const SHEET = 'พื้นดาดฟ้า_RoofSlab';
const SUMMARY = 'ตารางสรุปวัสดุงานโครงสร้าง';
const BOQ = 'BOQ (Home)';
/** Excel table rows 8–24; M6/N6 only sum rows 8–17 (the first 10). */
const FIRST_ROW = 8;
const EXCEL_ROWS = 17;
const TOTALLED_ROWS = 10;
const at = (col: string, i: number) => `${SHEET}!${col}${FIRST_ROW + i}`;

// ─── Input mapping ──────────────────────────────────────────────────────────
const INPUT_COLUMNS: readonly [keyof RoofSlabRow, string][] = [
    ['name', 'B'], ['width', 'C'], ['length', 'D'], ['thickness', 'E'], ['size', 'G'], ['layers', 'H'], ['spacing', 'I'],
];

function excelInputs(input: RoofSlabInput): Record<string, OracleInput> {
    if (input.rows.length > EXCEL_ROWS) throw new Error(`Excel has ${EXCEL_ROWS} roof-slab rows`);
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
const ROW_OUTPUTS: readonly [keyof RoofSlabRowResult, string][] = [
    ['barLength', 'J'], ['kg', 'K'], ['props', 'M'], ['formwork', 'N'], ['concrete', 'P'],
];

/** Σ of an Excel column over the table rows that M6/N6 leave out (rows 18–24). */
const excludedSum = (o: ExcelOracle, col: string) =>
    Array.from({ length: EXCEL_ROWS - TOTALLED_ROWS }, (_, k) => o.num(at(col, TOTALLED_ROWS + k))).reduce((s, v) => s + v, 0);

function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    if (key === 'props') return o.num(`${SHEET}!M6`) + excludedSum(o, 'M');      // D1: every row counts
    if (key === 'formwork') return o.num(`${SHEET}!N6`) + excludedSum(o, 'N');   // D1: every row counts
    if (key === 'concrete') return o.num(`${SHEET}!P6`);                         // rows 8–24 in Excel as well
    const bySize = /^rebar\.(RB6|RB9|DB12|DB16|DB20)$/.exec(key);
    if (bySize?.[1]) {
        const k = REBAR_SIZES.indexOf(bySize[1] as typeof REBAR_SIZES[number]);
        const sheet6 = o.num(`${SHEET}!${'GHIJK'.charAt(k)}6`);                  // SUMIF rows 8–100
        expectClose(o.num(`${SUMMARY}!${'IJKLM'.charAt(k)}13`), sheet6, `sheet 24 ${'IJKLM'.charAt(k)}13 = ${'GHIJK'.charAt(k)}6`);
        return sheet6;
    }
    return undefined;
}

// ─── Random but plausible slab schedules ────────────────────────────────────
function randomRow(rng: Random): RoofSlabRow {
    return {
        name: rng.pick(ROOF_SLAB_NAMES),
        width: rng.step(0.8, 5, 0.05),
        length: rng.step(1, 6, 0.05),
        thickness: rng.chance(0.05) ? 0 : rng.pick([0.1, 0.1, 0.12, 0.15]),
        size: rng.chance(0.03) ? '' : rng.chance(0.8) ? 'RB9' : rng.pick(ROOF_SLAB_BAR_SIZES),
        layers: rng.pick(ROOF_SLAB_LAYERS),
        spacing: rng.chance(0.08) ? 0 : rng.pick([0.15, 0.2, 0.2, 0.25]),
    };
}

function randomInput(seed: number): RoofSlabInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.12) ? rng.int(TOTALLED_ROWS, EXCEL_ROWS) : rng.pick([1, 2, 2, 3, 4, 5, 6]);
    return { rows: Array.from({ length: n }, () => randomRow(rng)) };
}

const sample = roofSlab.defaults();
const sampleRow = sample.rows[0] ?? randomRow(seededRandom(1));
const CASES: [string, RoofSlabInput][] = [
    ['Excel sample', sample],
    ['no slabs (D1: Excel still orders 1 m³)', { rows: [] }],
    ['zero thickness (no concrete, D1)', { rows: [{ ...sampleRow, thickness: 0 }] }],
    ['small slab: 0 < concrete·1.1 < 1 m³ (Excel MAX(1, …) applies on both sides)', { rows: [{ ...sampleRow, width: 1, length: 2 }] }],
    ['RB6 only (G127 9 % vs RB6 6 %)', { rows: [{ ...sampleRow, size: 'RB6' }] }],
    ['two sizes (Excel #SPILL!)', { rows: [sampleRow, { ...sampleRow, size: 'DB12' }] }],
    ['no spacing (Excel IFERROR(…, "0"))', { rows: [{ ...sampleRow, spacing: 0 }] }],
    ['one layer', { rows: [{ ...sampleRow, layers: 1 }] }],
    ['17 rows (Excel M6/N6 stop at row 17, D1)', {
        rows: Array.from({ length: EXCEL_ROWS }, (_, i) => ({ ...sampleRow, width: 1 + i * 0.25, length: 2.5 + (i % 4) })),
    }],
    ...Array.from({ length: 50 }, (_, k): [string, RoofSlabInput] => [`random #${k} (seed ${32_000 + k})`, randomInput(32_000 + k)]),
];

function appResult(input: RoofSlabInput): ProjectResult {
    const p = createProject();
    p.calculators['roof-slab'] = input;
    return computeProject(p);
}

/** Excel G127: the waste typed on the single rebar slot row. */
const SLOT_WASTE = [0.09];

describe('พื้นดาดฟ้า_RoofSlab vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...['G6', 'K6', 'M6', 'N6', 'P6'].map(c => `${SHEET}!${c}`),
            ...ROW_OUTPUTS.map(([, col]) => at(col, EXCEL_ROWS - 1)),
            ...'IJKLMNOP'.split('').map(c => `${SUMMARY}!${c}13`),
            ...[127, 128, 129, 131, 132, 133, 134].flatMap(r => ['D', 'E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!M135`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
        expect(oracle.num(`${BOQ}!G127`)).toBe(SLOT_WASTE[0]);
    });

    it('the cases cover every branch: rebar layouts, no spacing, zero/small/normal concrete, rows beyond row 17, every size', () => {
        const layouts = new Set(CASES.map(([, input]) => rebarLayout(roofSlabTotals(input).rebar, SLOT_WASTE)));
        expect([...layouts].sort()).toEqual(['Excel waste', 'more sizes than Excel rows (#SPILL!)', 'no rebar', 'per-size waste differs']);
        const rows = CASES.flatMap(([, input]) => input.rows);
        const has = (p: (input: RoofSlabInput) => boolean) => CASES.filter(([, input]) => p(input)).length;
        const concrete = (i: RoofSlabInput) => roofSlabTotals(i).concrete;
        expect(has(i => i.rows.length > TOTALLED_ROWS)).toBeGreaterThan(3);
        expect(has(i => i.rows.length === EXCEL_ROWS)).toBeGreaterThan(1);
        expect(has(i => concrete(i) === 0)).toBeGreaterThan(1);
        expect(has(i => concrete(i) > 0 && concrete(i) * 1.1 < 1)).toBeGreaterThan(0);
        expect(has(i => concrete(i) * 1.1 > 1)).toBeGreaterThan(20);
        expect(rows.filter(r => r.spacing === 0).length).toBeGreaterThan(3);
        expect(rows.filter(r => r.size === '').length).toBeGreaterThan(0);
        for (const l of ROOF_SLAB_LAYERS) expect(rows.some(r => r.layers === l), `layers ${l}`).toBe(true);
        for (const s of ROOF_SLAB_BAR_SIZES) expect(rows.some(r => r.size === s), s).toBe(true);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['roof-slab'] ?? {};

        // 1. every computed cell of every used row; unused rows stay 0
        input.rows.forEach((row, i) => {
            const r = roofSlabRow(row);
            for (const [field, col] of ROW_OUTPUTS) expectClose(r[field], oracle.num(at(col, i)), `row ${i} ${col}${FIRST_ROW + i} ${field}`);
        });
        for (let i = input.rows.length; i < EXCEL_ROWS; i++) {
            for (const [, col] of ROW_OUTPUTS) expect(oracle.num(at(col, i)), `unused row ${col}${FIRST_ROW + i}`).toBe(0);
        }

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping — add it to excelValueOf`);
            else expectClose(v, excel, `output ${key}`);
        }

        // 3. BOQ (Home) rows 129–134 (E = sheet 24 N13/O13/P13 = M6/N6/P6) with the D1 deltas
        const dProps = excludedSum(oracle, 'M');
        const dFormwork = excludedSum(oracle, 'N');
        const deltas: BoqDelta[] = [
            expectStdRowQtyDelta(oracle, res.boq, 'R129', 129, dProps, 'props'),
            expectStdRowQtyDelta(oracle, res.boq, 'R131', 131, dFormwork, 'formwork'),
            expectStdRowQtyDelta(oracle, res.boq, 'R132', 132, 0.6 * dFormwork, 'ไม้คร่าว'),
            expectStdRowQtyDelta(oracle, res.boq, 'R133', 133, 0.25 * dFormwork, 'ตะปู'),
            expectConcreteRow(oracle, res.boq, 'R134', 134, 'concrete'),
        ];

        // 4. rebar slot (Excel R127–R128) and the section 12 subtotal (the roof beam stays at the sample: its own
        //    D1 deltas, asserted in roof-beam.oracle.test.ts, are the same on both runs, so compare the difference)
        const weights = Object.fromEntries(REBAR_SIZES.map(s => [s, out[`rebar.${s}`] ?? 0]));
        deltas.push(expectRebarBlock(oracle, res.boq, { calc: 'roof-slab', firstRow: 127, excelSlots: 1, weights }));
        const base = roofBeamBaseDelta(oracle, res);
        expectSectionDelta(oracle, res.boq, 12, 135, addDeltas(base, ...deltas));
    });
});

/**
 * Section 12 also holds the roof-beam block (rows 116–124), at its sample input in these cases. Its documented D1
 * delta (KNOWN_DELTAS[12]: +4,191.90522 at the sample) is asserted in roof-beam.oracle.test.ts; here it is read
 * row by row (app − Excel) so the roof-slab part of the subtotal is compared exactly.
 */
function roofBeamBaseDelta(oracle: ExcelOracle, res: ProjectResult): BoqDelta {
    const s12 = res.boq.sections.find(s => s.no === 12);
    const beamRows = (s12?.rows ?? []).filter(r => r.type === 'item' && (r.key.startsWith('roof-beam:') || ['R119', 'R121', 'R122', 'R123', 'R124'].includes(r.key)));
    const app = (f: 'matTotal' | 'labTotal' | 'total') => beamRows.reduce((s, r) => s + (r.type === 'item' ? r[f] : 0), 0);
    const excel = (col: string) => [116, 117, 118, 119, 121, 122, 123, 124].reduce((s, r) => s + oracle.num(`${BOQ}!${col}${r}`), 0);
    const d = { J: app('matTotal') - excel('J'), L: app('labTotal') - excel('L'), M: app('total') - excel('M') };
    expectClose(d.M, 4191.90522, 'roof-beam sample delta (KNOWN_DELTAS[12])');
    return d;
}
