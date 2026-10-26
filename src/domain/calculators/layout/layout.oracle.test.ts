// Differential test: layout (วางผัง / ปักหมุด) vs the Excel v5 workbook (evaluated by the oracle) on ~50 seeded
// random inputs + named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
//
// What can and cannot be compared:
//   - The calculator is an external Google Sheet that was not supplied (decision D8); the app rebuilds it from the
//     deck p19 screenshot. The workbook has NO cell for any of its outputs (order quantities, material total,
//     labour, total), so none can be compared with Excel; they are checked against the screenshot in
//     layout.test.ts and listed in NOT_IN_EXCEL here.
//   - The calculator is deliberately not linked to the BOQ yet (layout/index.ts: the deck's sheet has all prices 0
//     while Excel I32 / K32 are typed 4,000 / 1,500). What is compared is that this stays true: for every input,
//     BOQ row 32 and section 4 (J33/L33/M33) equal the Excel workbook exactly.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import { expectBoqRow, expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { layout, type LayoutInput } from '.';

const BOQ = 'BOQ (Home)';

/** Outputs with no Excel cell (D8: the external sheet is not in the workbook). */
const NOT_IN_EXCEL = new Set(['points', 'stakes', 'materialTotal', 'labour', 'total', 'orderBoards', 'orderEucalyptus', 'orderStakes']);

// ─── Random but plausible layouts ───────────────────────────────────────────
function randomInput(seed: number): LayoutInput {
    const rng = seededRandom(seed);
    const base = layout.defaults();
    return {
        points: rng.chance(0.1) ? 0 : rng.int(4, 60),
        stakes: rng.chance(0.1) ? 0 : rng.int(4, 60),
        waste: rng.pick([0.05, 0.05, 0, 0.1]),
        labour: rng.chance(0.5) ? 0 : rng.step(500, 6000, 100),
        materials: base.materials.map(l => (rng.chance(0.5) ? { ...l, unitPrice: rng.step(5, 120, 5) } : l)),
    };
}

const sample = layout.defaults();
const CASES: [string, LayoutInput][] = [
    ['deck p19 sample', sample],
    ['zeros (no points, no stakes)', { ...sample, points: 0, stakes: 0, waste: 0 }],
    ['empty material table', { ...sample, materials: [] }],
    ['large values with prices and labour', { ...sample, points: 400, stakes: 300, labour: 50000, materials: sample.materials.map(l => ({ ...l, unitPrice: 90 })) }],
    ['fractional values', { ...sample, points: 26.5, stakes: 21.5, waste: 0.075, labour: 1234.56 }],
    ...Array.from({ length: 50 }, (_, k): [string, LayoutInput] => [`random #${k} (seed ${4_000 + k})`, randomInput(4_000 + k)]),
];

function appResult(input: LayoutInput): ProjectResult {
    const p = createProject();
    p.calculators.layout = input;
    return computeProject(p);
}

describe('layout vs Excel (oracle) — BOQ section 4 only (D8: the external sheet is not in the workbook)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('BOQ row 32 is typed in Excel and not linked in the app; compared cells are live', () => {
        oracle.reset();
        expect(layout.boqLinks).toEqual([]);
        for (const c of ['E', 'I', 'K']) expect(oracle.formula(`${BOQ}!${c}32`), `${c}32`).toBeUndefined();
        for (const ref of [...['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}32`), `${BOQ}!J33`, `${BOQ}!L33`, `${BOQ}!M33`]) {
            expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
        }
    });

    it('the cases cover priced / unpriced recipes, labour, zero counts and an empty table', () => {
        const has = (p: (i: LayoutInput) => boolean) => CASES.filter(([, i]) => p(i)).length;
        const ctx = { outputs: () => undefined };
        expect(has(i => (layout.compute(i, ctx).total ?? 0) > 0)).toBeGreaterThan(20);
        expect(has(i => (layout.compute(i, ctx).total ?? 0) === 0)).toBeGreaterThan(2);
        expect(has(i => i.points === 0)).toBeGreaterThan(1);
        expect(has(i => i.materials.length === 0)).toBeGreaterThan(0);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.reset();
        const res = appResult(input);
        const out = res.calcOutputs.layout ?? {};
        for (const key of Object.keys(out)) {
            expect(NOT_IN_EXCEL.has(key), `output ${key} has no Excel mapping — map it or list it in NOT_IN_EXCEL`).toBe(true);
        }
        expectBoqRow(oracle, res.boq, 'R32', 32);
        const s4 = res.boq.sections.find(s => s.no === 4);
        expectClose(s4?.matTotal, oracle.num(`${BOQ}!J33`), 'section 4 J33');
        expectClose(s4?.labTotal, oracle.num(`${BOQ}!L33`), 'section 4 L33');
        expectClose(s4?.total, oracle.num(`${BOQ}!M33`), 'section 4 M33');
    });
});
