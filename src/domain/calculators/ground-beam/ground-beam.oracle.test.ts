// Differential test: ground beam (คานคอดิน_Beam, sheet 27) compute() + BOQ vs the real Excel v5 formulas (evaluated
// by the oracle) on 50 seeded random beam schedules and named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
// Feeds: sheet 24 row 8 → BOQ 8.2 lean (R69), 8.3 rebar (rows 71–73), 8.5 formwork (R77–R79), 8.6 concrete (R80).
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    BOQ_SHEET as BOQ, expectBoqRowD1, expectNumberOrText, expectRebarBlock, expectSectionTotal, rebarKgOf, rebarLayout,
    sumDeltas, type RebarBlock,
} from '../../../test-utils/oracle-boq-checks';
import { expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import {
    GROUND_BEAM_TABLE, SHEETS, groundBeamExcelInputs, groundBeamShortRangeDelta, randomGroundBeamInput,
    randomGroundBeamRow, tableRef,
} from '../../../test-utils/oracle-structure-inputs';
import { REBAR_SIZES } from '../../boq/slots';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { groundBeam, groundBeamRow, type GroundBeamInput, type GroundBeamRow, type GroundBeamRowResult } from '.';

const SHEET = SHEETS.groundBeam;
const at = (col: string, i: number) => tableRef(GROUND_BEAM_TABLE, col, i);

/** groundBeamRow() field → computed column of the same Excel row (text = what Excel shows instead of null). */
const ROW_OUTPUTS: readonly (readonly [keyof GroundBeamRowResult, string, string?])[] = [
    ['lean', 'H'], ['mainLength', 'L'], ['mainWeight', 'M'],
    ['stirrupCount', 'Q', '_'], ['stirrupLength', 'R'], ['stirrupTotalLength', 'S', '_'], ['stirrupWeight', 'T'],
    ['formwork', 'V'], ['concrete', 'X'],
];

/**
 * The Excel value an output key stands for, plus the documented D1 delta (app − Excel): Excel G6 = SUM(H8:H18),
 * V6/X6 = SUM(…8:…17) leave out the last table rows; the app sums every row (ground-beam/index.ts).
 */
function excelValueOf(key: string, o: ExcelOracle, input: GroundBeamInput): { excel: number; delta: number } | undefined {
    const d = groundBeamShortRangeDelta(input);
    if (key === 'lean') return { excel: o.num(`${SHEET}!G6`), delta: d.lean };
    if (key === 'formwork') return { excel: o.num(`${SHEET}!V6`), delta: d.formwork };
    if (key === 'concrete') return { excel: o.num(`${SHEET}!X6`), delta: d.concrete };
    const m = /^(main|stirrup|rebar)\.(RB6|RB9|DB12|DB16|DB20)$/.exec(key);
    if (!m?.[1] || !m[2]) return undefined;
    const k = REBAR_SIZES.indexOf(m[2] as typeof REBAR_SIZES[number]);
    // SUMIF ranges run to row 100, so every row counts on both sides
    if (m[1] === 'main') return { excel: o.num(`${SHEET}!${'JKLMN'.charAt(k)}6`), delta: 0 };
    if (m[1] === 'stirrup') return { excel: o.num(`${SHEET}!${'OPQRS'.charAt(k)}6`), delta: 0 };
    return { excel: o.num(`${SHEETS.summary}!${'IJKLM'.charAt(k)}8`), delta: 0 };   // sheet 24 row 8
}

/** BOQ 8.3 เหล็กเสริม: Excel rows 71 (G 6 %) and 72 (G 12 %), tie wire 73. */
const BLOCK: RebarBlock = { slot: 'ground-beam:rebar', rows: [71, 72], tieWire: 73 };
/** BOQ 8.4 (precast shear key, at the Excel sample here): row 75, no tie wire. */
const PS_BLOCK: RebarBlock = { slot: 'precast-slab:shear-key', rows: [75] };

// ─── Cases ──────────────────────────────────────────────────────────────────
const sample = groundBeam.defaults();
const b1 = sample.beams[0] as GroundBeamRow;
const ZERO_ROW: GroundBeamRow = { name: '', width: 0, depth: 0, length: 0, leanThickness: 0, mainSize: '', mainCount: 0, stirrupSize: '', stirrupSpacing: 0 };
const rows = (n: number, seed: number): GroundBeamRow[] => {
    const rng = seededRandom(seed);
    return Array.from({ length: n }, (_, i) => randomGroundBeamRow(rng, i));
};
const CASES: [string, GroundBeamInput][] = [
    ['Excel sample (E11 typed =14+2)', sample],
    ['no beams', { beams: [] }],
    ['a row of zeros and blanks', { beams: [ZERO_ROW] }],
    ['no stirrups (spacing 0 → "_")', { beams: [{ ...b1, stirrupSpacing: 0 }] }],
    ['ROUNDUP boundary 1.35/0.15 = 9.000000000000002 → 9', { beams: [{ ...b1, length: 0.75 + 0.6 }] }],
    ['ROUNDUP boundary 0.3/0.1 = 2.9999999999999996 → 3', { beams: [{ ...b1, length: 0.3, stirrupSpacing: 0.1 }] }],
    ['no lean concrete (thickness 0)', { beams: [{ ...b1, leanThickness: 0 }] }],
    ['one size, RB6 only (Excel row 71 waste)', { beams: [{ ...b1, mainSize: 'RB6' }] }],
    ['one size, DB12 only (row 71 keeps 6 %)', { beams: [{ ...b1, stirrupSize: 'DB12' }] }],
    ['two sizes RB9 + DB16 (row 71 keeps 6 %)', { beams: [{ ...b1, mainSize: 'DB16', stirrupSize: 'RB9' }] }],
    ['every bar size (5 sizes → Excel #SPILL!)', {
        beams: [{ ...b1, mainSize: 'DB16', stirrupSize: 'RB9' }, { ...b1, name: 'B2', mainSize: 'DB20' }, { ...b1, name: 'B3' }],
    }],
    ['fractional values', {
        beams: [{ name: 'B5', width: 0.237, depth: 0.418, length: 7.333, leanThickness: 0.037, mainSize: 'DB16', mainCount: 5, stirrupSize: 'RB6', stirrupSpacing: 0.125 }],
    }],
    ['10 rows (Excel V6/X6 still cover all)', { beams: rows(10, 2710) }],
    ['D1: 11 rows (row 18 left out of Excel V6/X6)', { beams: rows(11, 2711) }],
    ['D1: full Excel table, 14 rows (rows 19–21 also left out of G6)', { beams: rows(GROUND_BEAM_TABLE.rows, 2714) }],
    ...Array.from({ length: 50 }, (_, k): [string, GroundBeamInput] => [`random #${k} (seed ${27_000 + k})`, randomGroundBeamInput(27_000 + k)]),
];

function appResult(input: GroundBeamInput): ProjectResult {
    const p = createProject();
    p.calculators['ground-beam'] = input;
    return computeProject(p);
}

describe('คานคอดิน_Beam vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...['G6', 'J6', 'N6', 'O6', 'S6', 'V6', 'X6', 'Q8', 'T8', 'Q21', 'T21'].map(c => `${SHEET}!${c}`),
            `${SHEETS.summary}!E8`, `${SHEETS.summary}!I8`, `${SHEETS.summary}!M8`,
            ...[68, 69, 71, 72, 73, 75, 77, 78, 79, 80].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!D71`, `${BOQ}!D72`, `${BOQ}!M81`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover every BOQ 8.3 layout, both D1 short ranges, no stirrups and zero concrete', () => {
        oracle.reset();
        const outs = CASES.map(([, input]) => groundBeam.compute(input, { outputs: () => undefined }));
        expect(new Set(outs.map(o => rebarLayout(oracle, BLOCK, rebarKgOf(o))))).toEqual(new Set([
            '0 size(s), Excel waste', '1 size(s), Excel waste', '1 size(s), per-size waste differs',
            '2 size(s), Excel waste', '2 size(s), per-size waste differs', '3+ sizes (Excel #SPILL!)',
        ]));
        const has = (p: (input: GroundBeamInput) => boolean) => CASES.filter(([, input]) => p(input)).length;
        expect(has(i => groundBeamShortRangeDelta(i).formwork > 0)).toBeGreaterThan(3);
        expect(has(i => groundBeamShortRangeDelta(i).lean > 0)).toBeGreaterThan(2);
        expect(has(i => i.beams.length === GROUND_BEAM_TABLE.rows)).toBeGreaterThan(1);
        expect(has(i => i.beams.some(b => b.stirrupSpacing === 0))).toBeGreaterThan(5);
        expect(outs.filter(o => o.concrete === 0).length).toBeGreaterThan(1);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(groundBeamExcelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['ground-beam'] ?? {};

        // 1. every computed cell of every used row (all 14 Excel rows have the formulas); unused rows stay 0
        input.beams.forEach((row, i) => {
            const r = groundBeamRow(row);
            for (const [field, col, text] of ROW_OUTPUTS) {
                const v = r[field];
                if (text !== undefined) expectNumberOrText(oracle, v, at(col, i), text, `row ${i} ${field}`);
                else expectClose(v ?? NaN, oracle.num(at(col, i)), `row ${i} ${col}${GROUND_BEAM_TABLE.first + i} ${field}`);
            }
        });
        for (let i = input.beams.length; i < GROUND_BEAM_TABLE.rows; i++) {
            for (const col of ['H', 'M', 'T', 'V', 'X']) expect(oracle.num(at(col, i)), `unused ${col}${GROUND_BEAM_TABLE.first + i}`).toBe(0);
        }

        // 2. every output of compute() (unmapped keys fail); D1 short ranges asserted as the exact left-out rows
        for (const [key, v] of Object.entries(out)) {
            const m = excelValueOf(key, oracle, input);
            if (m === undefined) expect.fail(`output ${key} has no Excel mapping`);
            else expectClose(v - m.excel, m.delta, `output ${key} − Excel (D1 delta ${m.delta})`);
        }
        const d = groundBeamShortRangeDelta(input);
        expectClose(oracle.num(`${SHEETS.summary}!E8`), oracle.num(`${SHEET}!G6`), 'sheet 24 E8 = G6');
        expectClose(oracle.num(`${SHEETS.summary}!O8`), oracle.num(`${SHEET}!V6`), 'sheet 24 O8 = V6');
        expectClose(oracle.num(`${SHEETS.summary}!P8`), oracle.num(`${SHEET}!X6`), 'sheet 24 P8 = X6');

        // 3. BOQ section 8 rows fed by this sheet (+ R68 backfill and R75 PS shear key at the Excel sample), M81
        const s8 = sumDeltas(
            expectBoqRowD1(oracle, res.boq, 'R68', 68),
            expectBoqRowD1(oracle, res.boq, 'R69', 69, { qtyDelta: d.lean }),
            expectBoqRowD1(oracle, res.boq, 'R77', 77, { qtyDelta: d.formwork }),
            expectBoqRowD1(oracle, res.boq, 'R78', 78, { qtyDelta: 0.6 * d.formwork }),
            expectBoqRowD1(oracle, res.boq, 'R79', 79, { qtyDelta: 0.25 * d.formwork }),
            // D1 (engine.ts): no concrete → Excel MAX(1, CEILING(0, 0.25)) = 1 m³, the app 0
            expectBoqRowD1(oracle, res.boq, 'R80', 80, { qtyDelta: d.concrete, gross: 'concrete' }),
            expectRebarBlock(oracle, res.boq, BLOCK, rebarKgOf(out)),
            expectRebarBlock(oracle, res.boq, PS_BLOCK, rebarKgOf(res.calcOutputs['precast-slab'] ?? {})),
        );
        expectSectionTotal(oracle, res.boq, 8, 81, s8);
    });
});
