// Differential test: pedestal (เสาตอม่อ_Footing Column, sheet 26) compute() + BOQ vs the real Excel v5 formulas
// (evaluated by the oracle) on 50 seeded random footing + pedestal schedules and named edge cases. Both sheets are
// driven: the pedestal bar length reads its footing's thickness and width, and the footing backfill (AI) subtracts
// the pedestal concrete. Guide: docs/rebuild/ORACLE_TESTS.md.
// Feeds: sheet 24 row 7 → BOQ 6.6 rebar (rows 47–49), 7.1 formwork (R62–R64), 7.2 concrete (R65); and the
// backfill Footing!AI6 → sheet 24 Q6 → BOQ 8.1 (R68).
//
// Excel pairs pedestal row n with footing row n; the app lets each pedestal pick its footing type (D13). The input
// mapping puts a pedestal on footing f into Excel row f (pedestalLayout), so every D13 choice that has an Excel layout
// is compared exactly. Two pedestals on one footing type have no Excel layout and are not generated.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import {
    BOQ_SHEET as BOQ, expectBoqRowD1, expectNumberOrText, expectRebarBlock, expectSectionTotal, rebarKgOf, rebarLayout,
    sumDeltas, type RebarBlock,
} from '../../../test-utils/oracle-boq-checks';
import { expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import {
    FOOTING_TABLE, PEDESTAL_TABLE, SHEETS, excelKgPerM, footingExcelInputs, pedestalExcelInputs, pedestalLayout,
    pedestalStirrupCounts, pedestalStirrupKgDelta, randomFootingPedestal, randomFootingRow, randomPedestalRow, tableRef,
} from '../../../test-utils/oracle-structure-inputs';
import { REBAR_SIZES } from '../../boq/slots';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { footing, footingRowKey, type FootingInput, type FootingRow } from '../footing';
import { footingRefFor, pedestal, pedestalRow, type PedestalInput, type PedestalRow } from '.';

const SHEET = SHEETS.pedestal;
const FOOTING = SHEETS.footing;
const ped = (col: string, t: number) => tableRef(PEDESTAL_TABLE, col, t);
const foot = (col: string, t: number) => tableRef(FOOTING_TABLE, col, t);

interface Case { footing: FootingInput; pedestal: PedestalInput }

function excelInputs(c: Case): Record<string, OracleInput> {
    return { ...footingExcelInputs(c.footing), ...pedestalExcelInputs(c.pedestal, c.footing.rows.length) };
}

function appResult(c: Case): ProjectResult {
    const p = createProject();
    p.calculators.footing = c.footing;
    p.calculators.pedestal = c.pedestal;
    return computeProject(p);
}

/** BOQ 6.6 เหล็กเสริม - ***เสาตอม่อ: Excel rows 47 (G 6 %) and 48 (G 12 %), tie wire 49. */
const BLOCK: RebarBlock = { slot: 'pedestal:rebar', rows: [47, 48], tieWire: 49 };
const FOOTING_BLOCK: RebarBlock = { slot: 'footing:rebar', rows: [43, 44], tieWire: 45 };
const COLUMN_BLOCK: RebarBlock = { slot: 'column:rebar', rows: [51, 52], tieWire: 53 };
const BEAM_BLOCK: RebarBlock = { slot: 'ground-beam:rebar', rows: [71, 72], tieWire: 73 };
const PS_BLOCK: RebarBlock = { slot: 'precast-slab:shear-key', rows: [75] };

// ─── Cases ──────────────────────────────────────────────────────────────────
const F1 = footing.defaults().rows[0] as FootingRow;
const C1 = pedestal.defaults().rows[0] as PedestalRow;
const F2: FootingRow = {
    name: 'F2', count: 4, width: 1.0, length: 1.2, depth: 0.5, excavationDepth: 1.2, sandThickness: 0.05, leanThickness: 0.05,
    shortBarSize: 'DB16', shortBarCount: 6, longBarSize: 'DB16', longBarCount: 7, ringBarSize: 'RB9', ringBarCount: 2,
};
const C2: PedestalRow = {
    name: 'C2', footing: 1, count: 4, width: 0.3, length: 0.3, height: 0.8,
    mainBarSize: 'DB12', mainBarCount: 8, stirrupSize: 'RB6', stirrupSpacing: 0.15,
};
/** A shallow pit: its own backfill goes negative under a big pedestal. */
const F_SHALLOW: FootingRow = { ...F1, name: 'F4', count: 1, width: 0.5, length: 0.5, depth: 0.25, excavationDepth: 0.3, sandThickness: 0, leanThickness: 0 };
const ZERO_PED: PedestalRow = { name: '', footing: 0, count: 0, width: 0, length: 0, height: 0, mainBarSize: '', mainBarCount: 0, stirrupSize: '', stirrupSpacing: 0 };
const sample: Case = { footing: footing.defaults(), pedestal: pedestal.defaults() };
const full = (): Case => {
    const rng = seededRandom(2611);
    const rows = Array.from({ length: FOOTING_TABLE.rows }, (_, i) => randomFootingRow(rng, i, { sampleBars: true }));
    return { footing: { rows }, pedestal: { rows: Array.from({ length: PEDESTAL_TABLE.rows }, (_, i) => randomPedestalRow(rng, i, rows[i]?.count)) } };
};

const CASES: [string, Case][] = [
    ['Excel sample', sample],
    ['no pedestals', { ...sample, pedestal: { rows: [] } }],
    ['no footing, no pedestals', { footing: { rows: [] }, pedestal: { rows: [] } }],
    ['D1: pedestals but no footing pit (Excel backfill −0.63, the app 0)', { footing: { rows: [] }, pedestal: pedestal.defaults() }],
    ['D1: one footing row goes negative under its pedestal, the total stays positive', {
        footing: { rows: [F1, F_SHALLOW] },
        pedestal: { rows: [C1, { ...C2, count: 10, width: 0.4, length: 0.4, height: 1.5 }] },
    }],
    ['D1 stirrups: pedestal on footing 2 (t 0.5) — Excel uses $F$8 (t 0.6): 10 vs 9 stirrups', {
        footing: { rows: [F1, F2] }, pedestal: { rows: [C1, C2] },
    }],
    ['ROUNDUP boundary (0.75+0.6)/0.15 = 9.000000000000002 → 9', {
        footing: { rows: [{ ...F1, depth: 0.75 }] }, pedestal: { rows: [{ ...C1, height: 0.6 }] },
    }],
    ['D13: pedestals on footings in another order (rows 3, 1, 2)', {
        footing: { rows: [F1, F2, { ...F2, name: 'F4', width: 1.5, length: 1.5 }] },
        pedestal: { rows: [{ ...C2, footing: 2 }, C1, { ...C2, name: 'C3', footing: 1, count: 6 }] },
    }],
    ['a pedestal with no footing (−1) and one on a footing row that does not exist', {
        footing: { rows: [F1, F2] },
        pedestal: { rows: [C1, { ...C2, footing: -1 }, { ...C2, name: 'C3', footing: 5 }] },
    }],
    ['no stirrups (spacing 0 → "-")', { ...sample, pedestal: { rows: [{ ...C1, stirrupSpacing: 0 }] } }],
    ['a pedestal row of zeros and blanks', { ...sample, pedestal: { rows: [ZERO_PED] } }],
    ['one size, RB6 only (Excel row 47 waste)', { ...sample, pedestal: { rows: [{ ...C1, mainBarSize: 'RB6' }] } }],
    ['one size, DB12 only (row 47 keeps 6 %)', { ...sample, pedestal: { rows: [{ ...C1, stirrupSize: 'DB12' }] } }],
    ['two sizes RB9 + DB12 (row 47 keeps 6 %)', { ...sample, pedestal: { rows: [{ ...C1, stirrupSize: 'RB9' }] } }],
    ['every bar size (Excel #SPILL!)', {
        footing: { rows: [F1, F2] },
        pedestal: { rows: [{ ...C1, mainBarSize: 'DB16', stirrupSize: 'RB9' }, { ...C2, mainBarSize: 'DB20' }] },
    }],
    ['fractional values', {
        footing: { rows: [{ ...F1, width: 0.737, length: 0.813, depth: 0.433, excavationDepth: 1.137 }] },
        pedestal: { rows: [{ ...C1, count: 7, width: 0.237, length: 0.183, height: 0.733, mainBarCount: 5, stirrupSpacing: 0.125 }] },
    }],
    ['full Excel tables (11 footings, 10 pedestals)', full()],
    ...Array.from({ length: 50 }, (_, k): [string, Case] => [`random #${k} (seed ${26_000 + k})`, randomFootingPedestal(26_000 + k)]),
];

/** Excel's stirrup rows: count O, total Q, kg R; D1 = Excel reads footing row 1's thickness ($F$8). */
function expectStirrups(oracle: ExcelOracle, c: Case, row: PedestalRow, t: number, app: ReturnType<typeof pedestalRow>, label: string): void {
    const counts = pedestalStirrupCounts(c.footing, row);
    expect(app.stirrupCount, `${label} app O = ROUNDUP((own footing t + F)/N)`).toBe(counts.app);
    expectNumberOrText(oracle, counts.excel, ped('O', t), '-', `${label} Excel O = ROUNDUP(($F$8 + F)/N)`);
    if (counts.app === counts.excel) {
        expectNumberOrText(oracle, app.stirrupTotal, ped('Q', t), '-', `${label} Q`);
        expectClose(app.stirrupKg, oracle.num(ped('R', t)), `${label} R`);
        return;
    }
    // D1 (pedestal/index.ts): the app counts stirrups over its own footing's thickness
    const dCount = (counts.app ?? 0) - (counts.excel ?? 0);
    expectClose((app.stirrupTotal ?? NaN) - oracle.num(ped('Q', t)), row.count * dCount * app.stirrupLength, `${label} Q − Excel Q (D1)`);
    expectClose(app.stirrupKg - oracle.num(ped('R', t)), row.count * dCount * app.stirrupLength * excelKgPerM(row.stirrupSize), `${label} R − Excel R (D1)`);
}

describe('เสาตอม่อ_Footing Column vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...['H6', 'L6', 'M6', 'Q6', 'T6', 'V6', 'J8', 'O8', 'R8', 'J17', 'O17', 'R17'].map(c => `${SHEET}!${c}`),
            `${FOOTING}!AI6`, `${FOOTING}!AI8`, `${FOOTING}!AI18`,
            ...['I7', 'M7', 'O7', 'P7', 'Q6'].map(c => `${SHEETS.summary}!${c}`),
            ...[38, 40, 41, 43, 44, 45, 47, 48, 49, 51, 52, 53, 55, 56, 57, 58, 62, 63, 64, 65, 68]
                .flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!D47`, `${BOQ}!D48`, `${BOQ}!M59`, `${BOQ}!M66`, `${BOQ}!M81`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover every BOQ 6.6 layout, every D13 pairing, both D1 fixes and the full tables', () => {
        oracle.reset();
        const results = CASES.map(([, c]) => ({ c, res: appResult(c) }));
        expect(new Set(results.map(({ res }) => rebarLayout(oracle, BLOCK, rebarKgOf(res.calcOutputs.pedestal ?? {}))))).toEqual(new Set([
            '0 size(s), Excel waste', '1 size(s), Excel waste', '1 size(s), per-size waste differs',
            '2 size(s), Excel waste', '2 size(s), per-size waste differs', '3+ sizes (Excel #SPILL!)',
        ]));
        const has = (p: (c: Case) => boolean) => CASES.filter(([, c]) => p(c)).length;
        const nf = (c: Case) => c.footing.rows.length;
        expect(has(c => c.pedestal.rows.some((r, i) => r.footing === i && i < nf(c))), 'same-row pairing').toBeGreaterThan(20);
        expect(has(c => c.pedestal.rows.some((r, i) => r.footing !== i && r.footing >= 0 && r.footing < nf(c))), 'another footing type (D13)').toBeGreaterThan(3);
        expect(has(c => c.pedestal.rows.some(r => r.footing < 0)), 'no footing (−1)').toBeGreaterThan(3);
        expect(has(c => c.pedestal.rows.some(r => r.footing >= nf(c))), 'a footing row that does not exist').toBeGreaterThan(3);
        expect(has(c => Object.keys(pedestalStirrupKgDelta(c.footing, c.pedestal)).length > 0), 'D1 stirrups ($F$8)').toBeGreaterThan(3);
        expect(has(c => c.pedestal.rows.some(r => r.stirrupSpacing === 0)), 'no stirrups').toBeGreaterThan(5);
        expect(has(c => c.pedestal.rows.length === 0), 'no pedestals').toBeGreaterThan(3);
        expect(has(c => c.pedestal.rows.length === PEDESTAL_TABLE.rows && nf(c) === FOOTING_TABLE.rows), 'full tables').toBeGreaterThan(0);
        const fo = (r: ProjectResult) => r.calcOutputs.footing ?? {};
        const po = (r: ProjectResult) => r.calcOutputs.pedestal ?? {};
        expect(results.filter(({ res }) => (fo(res).backfillGross ?? 0) - (po(res).concrete ?? 0) < 0).length, 'D1 total backfill clamp').toBeGreaterThan(3);
        expect(results.filter(({ c, res }) => c.footing.rows.some((_, i) => {
            const v = c.pedestal.rows.filter(r => r.footing === i).reduce((s, r) => s + pedestalRow(r, footingRefFor(fo(res), i)).concrete, 0);
            return (fo(res)[footingRowKey(i, 'backfillGross')] ?? 0) - v < 0;
        }) && (fo(res).backfillGross ?? 0) - (po(res).concrete ?? 0) > 0).length, 'D1 per-row clamp only').toBeGreaterThan(0);
    });

    it.each(CASES)('%s', (_name, c) => {
        oracle.replaceInputs(excelInputs(c));
        const res = appResult(c);
        const out = res.calcOutputs.pedestal ?? {};
        const fo = res.calcOutputs.footing ?? {};
        const layout = pedestalLayout(c.pedestal, c.footing.rows.length);
        const kgDelta = pedestalStirrupKgDelta(c.footing, c.pedestal);

        // 1. every computed cell of every pedestal, in the Excel row of its footing; unused rows stay 0
        c.pedestal.rows.forEach((row, i) => {
            const t = layout[i] ?? -1;
            const label = `pedestal ${i} (Excel row ${PEDESTAL_TABLE.first + t})`;
            const r = pedestalRow(row, footingRefFor(fo, row.footing));
            expectClose(r.mainLength, oracle.num(ped('J', t)), `${label} J`);
            expectClose(r.mainTotal, oracle.num(ped('K', t)), `${label} K`);
            expectClose(r.mainKg, oracle.num(ped('L', t)), `${label} L`);
            expectClose(r.stirrupLength, oracle.num(ped('P', t)), `${label} P`);
            expectClose(r.formwork, oracle.num(ped('T', t)), `${label} T`);
            expectClose(r.concrete, oracle.num(ped('V', t)), `${label} V`);
            expectStirrups(oracle, c, row, t, r, label);
        });
        for (let t = 0; t < PEDESTAL_TABLE.rows; t++) {
            if (layout.includes(t)) continue;
            for (const col of ['L', 'R', 'T', 'V']) expect(oracle.num(ped(col, t)), `unused ${col}${PEDESTAL_TABLE.first + t}`).toBe(0);
        }

        // 2. every output of compute() (unmapped keys fail), with the documented deltas
        for (const [key, v] of Object.entries(out)) {
            if (key === 'formwork') { expectClose(v, oracle.num(`${SHEET}!T6`), 'formwork T6'); continue; }
            if (key === 'concrete') { expectClose(v, oracle.num(`${SHEET}!V6`), 'concrete V6'); continue; }
            if (key === 'backfill') {
                // D1 (pedestal/index.ts): Excel AI6 can go negative (pedestals with no pit); the app clamps at 0
                const ai6 = oracle.num(`${FOOTING}!AI6`);
                expectClose(oracle.num(`${SHEETS.summary}!Q6`), ai6, 'sheet 24 Q6 = AI6');
                expectClose(v, Math.max(0, ai6), `backfill = MAX(0, Excel AI6 ${ai6})`);
                continue;
            }
            const perRow = /^footingBackfill\.(\d+)$/.exec(key);
            if (perRow?.[1]) {
                const ai = oracle.num(foot('AI', Number(perRow[1])));
                expectClose(v, Math.max(0, ai), `${key} = MAX(0, Excel AI${FOOTING_TABLE.first + Number(perRow[1])} ${ai}) (D1)`);
                continue;
            }
            const m = /^(main|stirrup|rebar)\.(RB6|RB9|DB12|DB16|DB20)$/.exec(key);
            if (!m?.[1] || !m[2]) { expect.fail(`output ${key} has no Excel mapping`); continue; }
            const size = m[2] as typeof REBAR_SIZES[number];
            const k = REBAR_SIZES.indexOf(size);
            if (m[1] === 'main') expectClose(v, oracle.num(`${SHEET}!${'HIJKL'.charAt(k)}6`), `main.${size}`);
            else if (m[1] === 'stirrup') expectClose(v - oracle.num(`${SHEET}!${'MNOPQ'.charAt(k)}6`), kgDelta[size] ?? 0, `stirrup.${size} − Excel (D1 $F$8)`);
            else expectClose(v - oracle.num(`${SHEETS.summary}!${'IJKLM'.charAt(k)}7`), kgDelta[size] ?? 0, `rebar.${size} − sheet 24 row 7 (D1 $F$8)`);
        }
        expect(Object.keys(out).filter(k => k.startsWith('footingBackfill.')).length).toBe(c.footing.rows.length);

        // 3. BOQ section 6: the footing rows and blocks (driven here too), the pedestal block 6.6, the column block (sample)
        const s6 = sumDeltas(
            ...[38, 39, 40, 41, 55, 56, 57].map(r => expectBoqRowD1(oracle, res.boq, `R${r}`, r)),
            // D1 (engine.ts): no concrete → Excel MAX(1, CEILING(0, 0.25)) = 1 m³, the app 0
            expectBoqRowD1(oracle, res.boq, 'R58', 58, { gross: 'concrete' }),
            expectRebarBlock(oracle, res.boq, FOOTING_BLOCK, rebarKgOf(fo)),
            expectRebarBlock(oracle, res.boq, BLOCK, rebarKgOf(out), { kgDelta }),
            expectRebarBlock(oracle, res.boq, COLUMN_BLOCK, rebarKgOf(res.calcOutputs.column ?? {})),
        );
        expectSectionTotal(oracle, res.boq, 6, 59, s6);

        // 4. section 7: R62 formwork (+ R63/R64 = 0.6/0.25 × R62), R65 concrete; subtotal M66
        const s7 = sumDeltas(
            ...[62, 63, 64].map(r => expectBoqRowD1(oracle, res.boq, `R${r}`, r)),
            expectBoqRowD1(oracle, res.boq, 'R65', 65, { gross: 'concrete' }),
        );
        expectSectionTotal(oracle, res.boq, 7, 66, s7);

        // 5. section 8: R68 backfill (D1 clamp: app E = MAX(0, Excel E68)); the rest at the Excel sample; M81
        const e68 = oracle.num(`${BOQ}!E68`);
        const s8 = sumDeltas(
            expectBoqRowD1(oracle, res.boq, 'R68', 68, { qtyDelta: Math.max(0, e68) - e68 }),
            ...[69, 77, 78, 79].map(r => expectBoqRowD1(oracle, res.boq, `R${r}`, r)),
            expectBoqRowD1(oracle, res.boq, 'R80', 80, { gross: 'concrete' }),
            expectRebarBlock(oracle, res.boq, BEAM_BLOCK, rebarKgOf(res.calcOutputs['ground-beam'] ?? {})),
            expectRebarBlock(oracle, res.boq, PS_BLOCK, rebarKgOf(res.calcOutputs['precast-slab'] ?? {})),
        );
        expectSectionTotal(oracle, res.boq, 8, 81, s8);
    });

    it('not comparable: two pedestals on one footing type (D13) have no Excel layout', () => {
        expect(() => pedestalLayout({ rows: [C1, { ...C2, footing: 0 }] }, 1)).toThrow(/no Excel layout/);
    });
});
