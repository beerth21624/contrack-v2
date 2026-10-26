// Differential test: structure summary (ตารางสรุปวัสดุงานโครงสร้าง, sheet 24) vs the real Excel v5 formulas
// (evaluated by the oracle). The summary has no inputs and no BOQ links: every cell reads an element sheet. So each
// case drives the six element sheets 25–30 together (footing, pedestal, ground beam, slab on grade, precast slab,
// column) with seeded random schedules, and compares every output with its own sheet's cell (rows 6–14, C–Q) and
// totals (row 18, I20). Roof beam, roof slab and stair (rows 12–14) stay at the Excel sample on both sides (their
// own oracle tests vary them). Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import {
    SHEETS, columnExcelInputs, firstRow, footingExcelInputs, groundBeamExcelInputs, groundBeamShortRangeDelta, pedestalExcelInputs,
    pedestalStirrupKgDelta, precastExcelInputs, randomColumnInput, randomFootingPedestal, randomGroundBeamInput,
    randomGroundBeamRow, randomPrecastInput, randomSlabInput, slabExcelInputs,
} from '../../../test-utils/oracle-structure-inputs';
import { REBAR_SIZES } from '../../boq/slots';
import { computeProject, createProject } from '../../project';
import { column, type ColumnInput } from '../column';
import { footing, type FootingInput } from '../footing';
import { groundBeam, type GroundBeamInput } from '../ground-beam';
import { pedestal, type PedestalInput } from '../pedestal';
import { precastSlab, type PrecastSlabInput } from '../precast-slab';
import { roofBeam } from '../roof-beam';
import { slabOnGrade, type SlabOnGradeInput } from '../slab-on-grade';
import { SUMMARY_COLUMNS, SUMMARY_ELEMENTS, structureSummary } from '.';

const SHEET = SHEETS.summary;

/** Sheet 24 row of each element (column A numbering is cosmetic). */
const ROW_OF: Record<string, number> = {
    footing: 6, pedestal: 7, 'ground-beam': 8, 'slab-on-grade': 9, 'precast-slab': 10, column: 11,
    'roof-beam': 12, 'roof-slab': 13, stair: 14,
};
/** Sheet 24 column of each summary column key (C … Q). */
const COL_OF: Record<string, string> = {
    excavation: 'C', sand: 'D', lean: 'E', plastic: 'F', area: 'G', wiremesh: 'H',
    'rebar.RB6': 'I', 'rebar.RB9': 'J', 'rebar.DB12': 'K', 'rebar.DB16': 'L', 'rebar.DB20': 'M',
    props: 'N', formwork: 'O', concrete: 'P', backfill: 'Q',
};

interface Case {
    footing: FootingInput; pedestal: PedestalInput; groundBeam: GroundBeamInput;
    slab: SlabOnGradeInput; precast: PrecastSlabInput; column: ColumnInput;
}

function excelInputs(c: Case): Record<string, OracleInput> {
    return {
        ...footingExcelInputs(c.footing), ...pedestalExcelInputs(c.pedestal, c.footing.rows.length),
        ...groundBeamExcelInputs(c.groundBeam), ...slabExcelInputs(c.slab), ...precastExcelInputs(c.precast),
        ...columnExcelInputs(c.column),
    };
}

function appOutputs(c: Case): Record<string, number> {
    const p = createProject();
    p.calculators.footing = c.footing;
    p.calculators.pedestal = c.pedestal;
    p.calculators['ground-beam'] = c.groundBeam;
    p.calculators['slab-on-grade'] = c.slab;
    p.calculators['precast-slab'] = c.precast;
    p.calculators.column = c.column;
    return computeProject(p).calcOutputs['structure-summary'] ?? {};
}

/**
 * Documented app − Excel of one element cell:
 * - footing backfill (Q6 = Footing!AI6): clamped at 0 in the app (D1, pedestal/index.ts);
 * - pedestal rebar (row 7): stirrups counted over the pedestal's own footing, not Footing!$F$8 (D1);
 * - ground beam lean / formwork / concrete (row 8): Excel's G6, V6, X6 leave out the last table rows (D1);
 * - roof beam formwork (O12): the app's 2·D·E + C·E, not Excel's 2·D·E + C (D1, oddity 2; Excel sample here).
 */
function elementDelta(c: Case, calc: string, col: string, o: ExcelOracle): number {
    if (calc === 'footing' && col === 'backfill') { const q6 = o.num(`${SHEET}!Q6`); return Math.max(0, q6) - q6; }
    if (calc === 'pedestal' && col.startsWith('rebar.')) return pedestalStirrupKgDelta(c.footing, c.pedestal)[col.slice(6) as typeof REBAR_SIZES[number]] ?? 0;
    if (calc === 'ground-beam') {
        const d = groundBeamShortRangeDelta(c.groundBeam);
        if (col === 'lean') return d.lean;
        if (col === 'formwork') return d.formwork;
        if (col === 'concrete') return d.concrete;
    }
    if (calc === 'roof-beam' && col === 'formwork') return roofBeam.defaults().rows.reduce((s, r) => s + r.width * r.length - r.width, 0);
    return 0;
}

// ─── Cases ──────────────────────────────────────────────────────────────────
const F1 = firstRow(footing.defaults().rows);
const C1 = firstRow(pedestal.defaults().rows);
const sample: Case = {
    footing: footing.defaults(), pedestal: pedestal.defaults(), groundBeam: groundBeam.defaults(),
    slab: slabOnGrade.defaults(), precast: precastSlab.defaults(), column: column.defaults(),
};
const empty: Case = {
    footing: { rows: [] }, pedestal: { rows: [] }, groundBeam: { beams: [] }, slab: { slabs: [] }, precast: { panels: [] }, column: { columns: [] },
};
function randomCase(seed: number): Case {
    return {
        ...randomFootingPedestal(seed),
        groundBeam: randomGroundBeamInput(seed + 100),
        slab: randomSlabInput(seed + 200),
        precast: randomPrecastInput(seed + 300),
        column: randomColumnInput(seed + 400),
    };
}
const CASES: [string, Case][] = [
    ['Excel sample', sample],
    ['every element sheet 25–30 empty', empty],
    ['D1: pedestals with no footing pit (Excel Q6 −0.63)', { ...empty, pedestal: pedestal.defaults() }],
    ['D1: pedestal on another footing type (Excel $F$8 stirrups)', {
        ...sample,
        footing: { rows: [F1, { ...F1, name: 'F2', depth: 0.5, width: 1, length: 1.2 }] },
        pedestal: { rows: [C1, { ...C1, name: 'C2', footing: 1, height: 0.8 }] },
    }],
    ['D1: ground beam 14 rows (Excel G6/V6/X6 short)', {
        ...sample,
        groundBeam: (() => {
            const rng = seededRandom(24_014);
            return { beams: Array.from({ length: 14 }, (_, i) => randomGroundBeamRow(rng, i)) };
        })(),
    }],
    ...Array.from({ length: 50 }, (_, k): [string, Case] => [`random #${k} (seed ${24_000 + k})`, randomCase(24_000 + k)]),
];

describe('ตารางสรุปวัสดุงานโครงสร้าง vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...Object.values(ROW_OF).flatMap(r => Object.values(COL_OF).map(c => `${SHEET}!${c}${r}`)),
            ...Object.values(COL_OF).map(c => `${SHEET}!${c}18`), `${SHEET}!I20`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the mapping covers every element row and column of sheet 24', () => {
        expect(SUMMARY_ELEMENTS.map(e => e.calc).sort()).toEqual(Object.keys(ROW_OF).sort());
        expect(SUMMARY_COLUMNS.map(c => c.key).sort()).toEqual(Object.keys(COL_OF).sort());
        expect(structureSummary.boqLinks).toEqual([]);
    });

    it('the cases cover every documented delta and the full tables', () => {
        const has = (p: (c: Case) => boolean) => CASES.filter(([, c]) => p(c)).length;
        expect(has(c => Object.keys(pedestalStirrupKgDelta(c.footing, c.pedestal)).length > 0), 'pedestal $F$8').toBeGreaterThan(3);
        expect(has(c => groundBeamShortRangeDelta(c.groundBeam).formwork > 0), 'ground-beam short ranges').toBeGreaterThan(3);
        expect(has(c => c.footing.rows.length === 0 && c.pedestal.rows.length > 0), 'pedestals with no footing').toBeGreaterThan(2);
        expect(has(c => c.footing.rows.length === 11 || c.slab.slabs.length === 17 || c.column.columns.length === 10)).toBeGreaterThan(3);
    });

    it.each(CASES)('%s', (_name, c) => {
        oracle.replaceInputs(excelInputs(c));
        const out = appOutputs(c);
        const checked = new Set<string>();
        const colDelta: Record<string, number> = {};

        // 1. every element cell (rows 6–14, columns C–Q), exact unless a documented decision applies
        for (const [calc, row] of Object.entries(ROW_OF)) {
            for (const [col, letter] of Object.entries(COL_OF)) {
                const key = `${calc}.${col}`;
                const d = elementDelta(c, calc, col, oracle);
                colDelta[col] = (colDelta[col] ?? 0) + d;
                checked.add(key);
                expectClose((out[key] ?? NaN) - oracle.num(`${SHEET}!${letter}${row}`), d, `${key} − Excel ${letter}${row} (documented Δ ${d})`);
            }
        }

        // 2. totals row 18 = SUM(…6:…17). D1 (structure-summary/index.ts): Excel Q18 = SUM(Q7:Q17) leaves out the
        //    footing backfill Q6; the app sums it, so app − Excel = the element deltas + Excel Q6.
        for (const [col, letter] of Object.entries(COL_OF)) {
            const key = `total.${col}`;
            const d = (colDelta[col] ?? 0) + (col === 'backfill' ? oracle.num(`${SHEET}!Q6`) : 0);
            checked.add(key);
            expectClose((out[key] ?? NaN) - oracle.num(`${SHEET}!${letter}18`), d, `${key} − Excel ${letter}18 (documented Δ ${d})`);
        }
        // row 20: I20 = SUM(I18:M18), the total rebar kg
        const rebarDelta = REBAR_SIZES.reduce((s, size) => s + (colDelta[`rebar.${size}`] ?? 0), 0);
        checked.add('total.rebar');
        expectClose((out['total.rebar'] ?? NaN) - oracle.num(`${SHEET}!I20`), rebarDelta, `total.rebar − Excel I20 (Δ ${rebarDelta})`);

        for (const key of Object.keys(out)) expect(checked.has(key), `output ${key} has no Excel mapping`).toBe(true);
    });
});
