// Differential test: roof-beam compute() + BOQ section 12 (งานคานดาดฟ้า, rows 116–124) vs the real Excel v5
// formulas (evaluated by the oracle) on ~50 seeded random beam schedules. Guide: docs/rebuild/ORACLE_TESTS.md.
//
// Documented differences, asserted exactly (KNOWN_DELTAS[12] in src/domain/__tests__/project-golden.test.ts,
// docs/excel-spec/02-structure-steps-06-13.md §6 oddities 1–3, 10, 13):
// - D1 formwork: app 2·D·E + C·E (soffit) per row, Excel T = 2·D·E + C  → Δ = Σ C·(E − 1).
// - D1 short ranges: Excel S6/T6/V6 sum rows 8–17 of the 14-row table; the app sums every row.
// - D1 rebar waste: Excel G116 12 % / G117 6 % (RB6/DB12 swapped, attached to the slot); app per size (RB6 6 %, DB12 12 %).
// - D5: a third bar size makes Excel's two-row FILTER spill fail (#SPILL!); the app adds one BOQ row per size.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import {
    addDeltas, expectRebarBlock, expectSectionDelta, expectStdRowQtyDelta, rebarLayout, type BoqDelta,
} from '../../../test-utils/oracle-boq-helpers';
import { expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { REBAR_SIZES } from '../../boq/slots';
import { computeProject, createProject, type ProjectResult } from '../../project';
import {
    roofBeam, roofBeamRow, roofBeamTotals, ROOF_BEAM_BAR_SIZES, ROOF_BEAM_NAMES, type RoofBeamInput, type RoofBeamRow,
    type RoofBeamRowResult,
} from '.';

const SHEET = 'คานดาดฟ้า_RoofBeam';
const SUMMARY = 'ตารางสรุปวัสดุงานโครงสร้าง';
const BOQ = 'BOQ (Home)';
/** Excel table rows 8–21; S6/T6/V6 only sum rows 8–17 (the first 10). */
const FIRST_ROW = 8;
const EXCEL_ROWS = 14;
const TOTALLED_ROWS = 10;
const at = (col: string, i: number) => `${SHEET}!${col}${FIRST_ROW + i}`;

// ─── Input mapping: RoofBeamRow field → yellow input column ─────────────────
const INPUT_COLUMNS: readonly [keyof RoofBeamRow, string][] = [
    ['name', 'B'], ['width', 'C'], ['depth', 'D'], ['length', 'E'], ['mainSize', 'G'], ['mainCount', 'H'],
    ['stirrupSize', 'L'], ['stirrupSpacing', 'M'],
];

function excelInputs(input: RoofBeamInput): Record<string, OracleInput> {
    if (input.rows.length > EXCEL_ROWS) throw new Error(`Excel has ${EXCEL_ROWS} roof-beam rows`);
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
/** roofBeamRow() field → computed column of the same Excel row (null ↔ Excel "_"). */
const ROW_OUTPUTS: readonly [keyof RoofBeamRowResult, string][] = [
    ['mainLength', 'I'], ['mainKg', 'J'], ['stirrupCount', 'N'], ['stirrupPerimeter', 'O'], ['stirrupLength', 'P'],
    ['stirrupKg', 'Q'], ['props', 'S'], ['formworkExcel', 'T'], ['concrete', 'V'],
];
const MAIN_COLUMNS = ['G', 'H', 'I', 'J', 'K'];      // G6..K6 by size (RB6…DB20)
const STIRRUP_COLUMNS = ['L', 'M', 'N', 'O', 'P'];   // L6..P6

/** Σ of an Excel column over the table rows that S6/T6/V6 leave out (rows 18–21). */
const excludedSum = (o: ExcelOracle, col: string) =>
    Array.from({ length: EXCEL_ROWS - TOTALLED_ROWS }, (_, k) => o.num(at(col, TOTALLED_ROWS + k))).reduce((s, v) => s + v, 0);
/** D1 formwork fix from first principles: app C·E − Excel C per row, over every row. */
const formworkFix = (input: RoofBeamInput) => input.rows.reduce((s, r) => s + r.width * (r.length - 1), 0);

/** The Excel value of an output key, with the documented D1 delta added (undefined = unmapped → the test fails). */
function excelValueOf(key: string, o: ExcelOracle, input: RoofBeamInput): number | undefined {
    if (key === 'props') return o.num(`${SHEET}!S6`) + excludedSum(o, 'S');
    if (key === 'formworkExcel') return o.num(`${SHEET}!T6`) + excludedSum(o, 'T');
    if (key === 'formwork') return o.num(`${SHEET}!T6`) + excludedSum(o, 'T') + formworkFix(input);
    if (key === 'concrete') return o.num(`${SHEET}!V6`) + excludedSum(o, 'V');
    const bySize = /^(main|stirrup|rebar)\.(RB6|RB9|DB12|DB16|DB20)$/.exec(key);
    if (bySize?.[1] && bySize[2]) {
        const k = REBAR_SIZES.indexOf(bySize[2] as typeof REBAR_SIZES[number]);
        if (bySize[1] === 'main') return o.num(`${SHEET}!${MAIN_COLUMNS[k] ?? ''}6`);           // SUMIF rows 8–100
        if (bySize[1] === 'stirrup') return o.num(`${SHEET}!${STIRRUP_COLUMNS[k] ?? ''}6`);
        return o.num(`${SUMMARY}!${'IJKLM'.charAt(k)}12`);                                       // sheet 24 row 12
    }
    return undefined;
}

// ─── Random but plausible beam schedules ────────────────────────────────────
function randomRow(rng: Random): RoofBeamRow {
    return {
        name: rng.pick(ROOF_BEAM_NAMES),
        width: rng.step(0.15, 0.4, 0.05),
        depth: rng.step(0.2, 0.8, 0.05),
        // length 1 m: Excel's 2·D·E + C equals the fixed 2·D·E + C·E (the D1 branch that gives no delta)
        length: rng.chance(0.1) ? 1 : rng.step(0.5, 30, 0.05),
        mainSize: rng.chance(0.03) ? '' : rng.chance(0.7) ? 'DB12' : rng.pick(ROOF_BEAM_BAR_SIZES),
        mainCount: rng.int(2, 10),
        stirrupSize: rng.chance(0.03) ? '' : rng.chance(0.7) ? 'RB6' : rng.pick(ROOF_BEAM_BAR_SIZES),
        stirrupSpacing: rng.chance(0.08) ? 0 : rng.pick([0.1, 0.15, 0.15, 0.2, 0.25]),
    };
}

function randomInput(seed: number): RoofBeamInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.12) ? rng.int(TOTALLED_ROWS, EXCEL_ROWS) : rng.pick([1, 1, 2, 2, 3, 4, 5]);
    return { rows: Array.from({ length: n }, () => randomRow(rng)) };
}

const sample = roofBeam.defaults();
const sampleRow = sample.rows[0] ?? randomRow(seededRandom(1));
const CASES: [string, RoofBeamInput][] = [
    ['Excel sample', sample],
    ['no beams', { rows: [] }],
    ['every beam 1 m long (2·D·E + C = 2·D·E + C·E, no D1 formwork delta)', {
        rows: [{ ...sampleRow, length: 1 }, { ...sampleRow, length: 1, width: 0.3, depth: 0.5 }],
    }],
    ['one bar size only: DB12 main + DB12 stirrups (Excel G116 12 % = DB12 waste)', {
        rows: [{ ...sampleRow, stirrupSize: 'DB12' }],
    }],
    ['three bar sizes (Excel #SPILL!)', { rows: [sampleRow, { ...sampleRow, mainSize: 'DB16', stirrupSize: 'RB9' }] }],
    ['no stirrup spacing (Excel "_")', { rows: [{ ...sampleRow, stirrupSpacing: 0 }] }],
    ['14 rows (Excel S6/T6/V6 stop at row 17, D1)', {
        rows: Array.from({ length: EXCEL_ROWS }, (_, i) => ({ ...sampleRow, length: 2 + i * 0.75 })),
    }],
    ...Array.from({ length: 50 }, (_, k): [string, RoofBeamInput] => [`random #${k} (seed ${31_000 + k})`, randomInput(31_000 + k)]),
];

function appResult(input: RoofBeamInput): ProjectResult {
    const p = createProject();
    p.calculators['roof-beam'] = input;
    return computeProject(p);
}

/** Excel G116 / G117: the waste typed on the two rebar slot rows. */
const SLOT_WASTE = [0.12, 0.06];

describe('คานดาดฟ้า_RoofBeam vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...['G6', 'K6', 'L6', 'P6', 'S6', 'T6', 'V6'].map(c => `${SHEET}!${c}`),
            ...ROW_OUTPUTS.map(([, col]) => at(col, EXCEL_ROWS - 1)),
            ...'IJKLMNOP'.split('').map(c => `${SUMMARY}!${c}12`),
            ...[116, 117, 118, 119, 121, 122, 123, 124].flatMap(r => ['D', 'E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!M135`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
        expect(oracle.num(`${BOQ}!G116`)).toBe(SLOT_WASTE[0]);
        expect(oracle.num(`${BOQ}!G117`)).toBe(SLOT_WASTE[1]);
    });

    it('the cases cover every branch: rebar layouts, "_" spacing, 1 m beams, rows beyond row 17, blank sizes, every size', () => {
        const ctx = { outputs: () => undefined };
        const layouts = new Set(CASES.map(([, input]) => rebarLayout(roofBeamTotals(input).rebar, SLOT_WASTE)));
        expect([...layouts].sort()).toEqual(['Excel waste', 'more sizes than Excel rows (#SPILL!)', 'no rebar', 'per-size waste differs']);
        const rows = CASES.flatMap(([, input]) => input.rows);
        const has = (p: (input: RoofBeamInput) => boolean) => CASES.filter(([, input]) => p(input)).length;
        expect(has(i => i.rows.length > TOTALLED_ROWS)).toBeGreaterThan(3);
        expect(has(i => i.rows.length === EXCEL_ROWS)).toBeGreaterThan(1);
        expect(rows.filter(r => r.stirrupSpacing === 0).length).toBeGreaterThan(3);
        expect(rows.filter(r => r.length === 1).length).toBeGreaterThan(3);
        expect(rows.filter(r => r.mainSize === '' || r.stirrupSize === '').length).toBeGreaterThan(1);
        for (const s of ROOF_BEAM_BAR_SIZES) {
            expect(rows.some(r => r.mainSize === s), `main ${s}`).toBe(true);
            expect(rows.some(r => r.stirrupSize === s), `stirrup ${s}`).toBe(true);
        }
        expect(has(i => (roofBeam.compute(i, ctx).props ?? 0) === 0)).toBeGreaterThan(0);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['roof-beam'] ?? {};

        // 1. every computed cell of every used row (null = Excel "_"); unused rows stay 0
        input.rows.forEach((row, i) => {
            const r = roofBeamRow(row);
            for (const [field, col] of ROW_OUTPUTS) {
                const v = r[field];
                if (v === null) expect(oracle.get(at(col, i)), `row ${i} ${col}${FIRST_ROW + i} ${field}`).toBe('_');
                else expectClose(v, oracle.num(at(col, i)), `row ${i} ${col}${FIRST_ROW + i} ${field}`);
            }
            // D1: the app's formwork adds the soffit C·E where Excel T adds C
            expectClose(r.formwork - oracle.num(at('T', i)), row.width * (row.length - 1), `row ${i} formwork − T = C·(E − 1)`);
        });
        for (let i = input.rows.length; i < EXCEL_ROWS; i++) {
            for (const col of ['I', 'J', 'Q', 'S', 'T', 'V']) expect(oracle.num(at(col, i)), `unused row ${col}${FIRST_ROW + i}`).toBe(0);
        }

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle, input);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping — add it to excelValueOf`);
            else expectClose(v, excel, `output ${key}`);
        }

        // 3. BOQ (Home) rows 119–124: E = sheet 24 N12/O12/P12 (= S6/T6/V6), app − Excel = the D1 deltas above
        const dProps = excludedSum(oracle, 'S');
        const dFormwork = excludedSum(oracle, 'T') + formworkFix(input);
        const dConcrete = excludedSum(oracle, 'V');
        const deltas: BoqDelta[] = [
            expectStdRowQtyDelta(oracle, res.boq, 'R119', 119, dProps, 'props'),
            expectStdRowQtyDelta(oracle, res.boq, 'R121', 121, dFormwork, 'formwork'),
            expectStdRowQtyDelta(oracle, res.boq, 'R122', 122, 0.6 * dFormwork, 'ไม้คร่าว'),
            expectStdRowQtyDelta(oracle, res.boq, 'R123', 123, 0.25 * dFormwork, 'ตะปู'),
            // Excel row 124 is plain E·(1+G) (no MAX/CEILING) and so is the app
            expectStdRowQtyDelta(oracle, res.boq, 'R124', 124, dConcrete, 'concrete'),
        ];

        // 4. rebar slot (Excel R116–R118) and the section 12 subtotal (J/L/M135; the roof slab stays at the sample)
        const weights = Object.fromEntries(REBAR_SIZES.map(s => [s, out[`rebar.${s}`] ?? 0]));
        deltas.push(expectRebarBlock(oracle, res.boq, { calc: 'roof-beam', firstRow: 116, excelSlots: 2, weights }));
        expectSectionDelta(oracle, res.boq, 12, 135, addDeltas(...deltas));
    });

    it('D1 at the Excel sample: section 12 = Excel + 4,191.90522 (KNOWN_DELTAS[12])', () => {
        oracle.replaceInputs(excelInputs(sample));
        const res = appResult(sample);
        const s12 = res.boq.sections.find(s => s.no === 12);
        expectClose((s12?.total ?? NaN) - oracle.num(`${BOQ}!M135`), 4191.90522, 'section 12 − M135');
        oracle.reset();
    });
});
