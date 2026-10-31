// QA edge tests for "ตารางสรุปวัสดุงานโครงสร้าง" (Excel v5 sheet 24): the read-only overview that adds up the nine
// element calculators. Expected values are hand-computed from the element inputs below (see the other
// <id>.edge.test.ts files for how each element's numbers come out), never by calling the code under test.
import { describe, expect, it } from 'vitest';
import { structureSummary, SUMMARY_COLUMNS, SUMMARY_ELEMENTS } from '.';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const SIZES = ['RB6', 'RB9', 'DB12', 'DB16', 'DB20'] as const;

function item(r: ProjectResult, key: string): BoqItemRow {
    const row = r.boq.sections.flatMap(s => s.rows).find(x => x.key === key);
    if (row?.type !== 'item') throw new Error(`BOQ item ${key} not found`);
    return row;
}
const ctxOf = (outputs: Record<string, Record<string, number>>) => ({ outputs: (id: string) => outputs[id] });
const summarise = (outputs: Record<string, Record<string, number>>) => structureSummary.compute({}, ctxOf(outputs));

/**
 * A small house. Per element (all hand-computed in the element edge tests):
 *  footing A: 2 × 1.0 × 2.0 × 0.5, pit 1.8 × 2.8 → excavation 15.12, sand 1.26, lean 0.504, formwork 6, concrete 2,
 *             RB6 5.328 (ring), DB16 25.28 (short), DB20 44.46 (long); backfill before the pedestal 11.356
 *  pedestal P: 2 × 0.2 × 0.3 × 1.0 on footing A → DB12 13.024, RB6 2.664, formwork 2, concrete 0.12, backfill 11.236
 *  ground beam G: 0.2 × 0.4 × 10 → lean 0.1, DB12 53.28, RB6 10.656, formwork 8, concrete 0.8
 *  slab on grade T: 3 × 4 × 0.1 → backfill 4.8, sand 0.75, plastic 12, RB9 119.76, concrete 1.2
 *  precast Q: 3 × 3 → area 9, wire mesh 9, RB6 3.1968, formwork 0.6, concrete 0.45
 *  column K: 4 × 0.3 × 0.3 × 3 → DB16 151.68, RB9 35.928, formwork 14.4, concrete 1.08
 *  roof beam R: 0.2 × 0.3 × 6 → DB12 21.312, RB6 6.66, props 10, formwork 4.8, concrete 0.36
 *  roof slab W: 2 × 3 × 0.1 → RB9 23.952, props 10, formwork 6, concrete 0.6
 *  stair S: 3-4-5 stair → RB9 32.3352, props 3, formwork 3.78, concrete 0.432
 */
const HOUSE: Record<string, unknown> = {
    footing: { rows: [{
        name: 'F1', count: 2, width: 1, length: 2, depth: 0.5, excavationDepth: 1.5, sandThickness: 0.1, leanThickness: 0.05,
        shortBarSize: 'DB16', shortBarCount: 4, longBarSize: 'DB20', longBarCount: 3, ringBarSize: 'RB6', ringBarCount: 2,
    }] },
    pedestal: { rows: [{
        name: 'C1', footing: 0, count: 2, width: 0.2, length: 0.3, height: 1,
        mainBarSize: 'DB12', mainBarCount: 4, stirrupSize: 'RB6', stirrupSpacing: 0.25,
    }] },
    'ground-beam': { beams: [{
        name: 'B1', width: 0.2, depth: 0.4, length: 10, leanThickness: 0.05, mainSize: 'DB12', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0.25,
    }] },
    'slab-on-grade': { slabs: [{
        name: 'S1', width: 3, length: 4, thickness: 0.1, fillDepth: 0.4, sandThickness: 0.05, barSize: 'RB9', layers: 2, spacing: 0.2,
    }] },
    'precast-slab': { panels: [{ width: 3, length: 3, keySize: 'RB6', keySpacing: 0.35, keyBarLength: 0.8, topping: 0.05 }] },
    column: { columns: [{
        name: 'C1', count: 4, width: 0.3, depth: 0.3, height: 3, mainSize: 'DB16', mainCount: 8, stirrupSize: 'RB9', stirrupSpacing: 0.2,
    }] },
    'roof-beam': { rows: [{
        name: 'B1', width: 0.2, depth: 0.3, length: 6, mainSize: 'DB12', mainCount: 4, stirrupSize: 'RB6', stirrupSpacing: 0.2,
    }] },
    'roof-slab': { rows: [{ name: 'S1', width: 2, length: 3, thickness: 0.1, size: 'RB9', layers: 1, spacing: 0.25 }] },
    stair: { rows: [{
        name: 'บันไดหน้าบ้าน', width: 1.2, waist: 0.15, rise: 0.9, run: 1.2, steps: 6, riser: 0.15, tread: 0.3,
        waistMainSize: 'RB9', waistMainSpacing: 0.15, waistTempSize: 'RB9', waistTempSpacing: 0.15,
        stepMainSize: 'RB9', stepMainSpacing: 0.15, stepTempSize: 'RB9', stepTempSpacing: 0.15,
    }] },
};
const houseProject = (patch: Partial<Project> = {}): Project => ({ ...createProject('blank'), calculators: HOUSE, ...patch });
const house = (patch: Partial<Project> = {}): ProjectResult => computeProject(houseProject(patch));
const sum = (r: ProjectResult) => r.calcOutputs['structure-summary'] ?? {};

describe('structure-summary — shape', () => {
    it('reads the nine elements, has no input and no BOQ link', () => {
        expect(SUMMARY_ELEMENTS.map(e => e.calc)).toEqual([
            'footing', 'pedestal', 'ground-beam', 'slab-on-grade', 'precast-slab', 'column', 'roof-beam', 'roof-slab', 'stair',
        ]);
        expect(structureSummary.deps).toEqual(SUMMARY_ELEMENTS.map(e => e.calc));
        expect(structureSummary.boqLinks).toEqual([]);
        expect(structureSummary.defaults()).toEqual({});
        expect(structureSummary.sections).toEqual([6, 7, 8, 9, 10, 11, 12, 13]);
    });
    it('has the 15 columns of sheet 24 (C–Q): 6 quantities, 5 bar sizes, props, formwork, concrete, backfill', () => {
        expect(SUMMARY_COLUMNS.map(c => c.key)).toEqual([
            'excavation', 'sand', 'lean', 'plastic', 'area', 'wiremesh',
            'rebar.RB6', 'rebar.RB9', 'rebar.DB12', 'rebar.DB16', 'rebar.DB20', 'props', 'formwork', 'concrete', 'backfill',
        ]);
    });
    it('outputs one cell per element × column plus a total per column and the rebar grand total', () => {
        const o = summarise({});
        expect(Object.keys(o)).toHaveLength(9 * 15 + 15 + 1);
        expect(o['total.rebar']).toBe(0);
    });
});

describe('structure-summary — blank and missing sources', () => {
    it('no calculator outputs at all: every cell is 0 and finite', () => {
        const o = summarise({});
        for (const [k, v] of Object.entries(o)) expect(v, k).toBe(0);
    });
    it('blank project: every cell is 0 (no element has any quantity)', () => {
        const o = sum(computeProject(createProject('blank')));
        for (const [k, v] of Object.entries(o)) expect(v, k).toBe(0);
    });
    it('NaN and Infinity from an element are read as 0, never summed', () => {
        const o = summarise({ footing: { excavation: NaN, sand: Infinity, lean: -Infinity, concrete: 2 } });
        expect(o['footing.excavation']).toBe(0);
        expect(o['footing.sand']).toBe(0);
        expect(o['footing.lean']).toBe(0);
        expect(o['total.excavation']).toBe(0);
        expect(o['total.concrete']).toBe(2);
    });
    it('an element that has not run (undefined outputs) contributes 0 to every total', () => {
        const o = summarise({ column: { concrete: 1.5 } });
        expect(o['total.concrete']).toBe(1.5);
        expect(o['footing.concrete']).toBe(0);
    });
});

describe('structure-summary — cell routing (hand-built element outputs)', () => {
    it('each element\'s output of the same name lands in its own row; totals add the nine rows', () => {
        const outputs: Record<string, Record<string, number>> = {};
        SUMMARY_ELEMENTS.forEach((el, i) => { outputs[el.calc] = { concrete: i + 1, formwork: 10 * (i + 1), 'rebar.DB12': 100 * (i + 1) }; });
        const o = summarise(outputs);
        SUMMARY_ELEMENTS.forEach((el, i) => {
            expect(o[`${el.calc}.concrete`], el.calc).toBe(i + 1);
            expect(o[`${el.calc}.formwork`], el.calc).toBe(10 * (i + 1));
        });
        expect(o['total.concrete']).toBe(45);        // 1 + … + 9
        expect(o['total.formwork']).toBe(450);
        expect(o['total.rebar.DB12']).toBe(4500);
        expect(o['total.rebar']).toBe(4500);
    });
    it('footing backfill is read from the pedestal calculator (Footing!AI6), the pedestal row itself shows 0', () => {
        const o = summarise({ footing: { backfill: 99, backfillGross: 77 }, pedestal: { backfill: 11.236 } });
        expect(o['footing.backfill']).toBe(11.236);
        expect(o['pedestal.backfill']).toBe(0);
        expect(o['total.backfill']).toBe(11.236);
    });
    it('slab-on-grade backfill is its own; the footing\'s comes from the pedestal; the total counts both (D1: Q18 includes Q6)', () => {
        const o = summarise({ pedestal: { backfill: 5 }, 'slab-on-grade': { backfill: 4.8 } });
        expect(o['total.backfill']).toBeCloseTo(9.8, 12);
    });
    it('total.rebar is the sum of the five size totals', () => {
        const o = summarise({ column: { 'rebar.RB6': 1, 'rebar.RB9': 2, 'rebar.DB12': 3, 'rebar.DB16': 4, 'rebar.DB20': 5 }, stair: { 'rebar.DB20': 10 } });
        expect(o['total.rebar']).toBe(25);
        expect(o['total.rebar.DB20']).toBe(15);
    });
});

describe('structure-summary — mini house through computeProject', () => {
    const o = sum(house());
    it('footing row', () => {
        expect(o['footing.excavation']).toBeCloseTo(15.12, 9);
        expect(o['footing.sand']).toBeCloseTo(1.26, 9);
        expect(o['footing.lean']).toBeCloseTo(0.504, 9);
        expect(o['footing.rebar.RB6']).toBeCloseTo(5.328, 9);
        expect(o['footing.rebar.DB16']).toBeCloseTo(25.28, 9);
        expect(o['footing.rebar.DB20']).toBeCloseTo(44.46, 9);
        expect(o['footing.formwork']).toBeCloseTo(6, 9);
        expect(o['footing.concrete']).toBeCloseTo(2, 9);
        expect(o['footing.backfill']).toBeCloseTo(11.236, 9);   // 11.356 − pedestal 0.12
    });
    it('pedestal row', () => {
        expect(o['pedestal.rebar.DB12']).toBeCloseTo(13.024, 9);
        expect(o['pedestal.rebar.RB6']).toBeCloseTo(2.664, 9);
        expect(o['pedestal.formwork']).toBeCloseTo(2, 9);
        expect(o['pedestal.concrete']).toBeCloseTo(0.12, 9);
        expect(o['pedestal.backfill']).toBe(0);
    });
    it('ground beam, slab, precast rows', () => {
        expect(o['ground-beam.lean']).toBeCloseTo(0.1, 9);
        expect(o['ground-beam.rebar.DB12']).toBeCloseTo(53.28, 9);
        expect(o['ground-beam.rebar.RB6']).toBeCloseTo(10.656, 9);
        expect(o['ground-beam.formwork']).toBeCloseTo(8, 9);
        expect(o['ground-beam.concrete']).toBeCloseTo(0.8, 9);
        expect(o['slab-on-grade.backfill']).toBeCloseTo(4.8, 9);
        expect(o['slab-on-grade.sand']).toBeCloseTo(0.75, 9);
        expect(o['slab-on-grade.plastic']).toBeCloseTo(12, 9);
        expect(o['slab-on-grade.rebar.RB9']).toBeCloseTo(119.76, 9);
        expect(o['slab-on-grade.concrete']).toBeCloseTo(1.2, 9);
        expect(o['precast-slab.area']).toBeCloseTo(9, 9);
        expect(o['precast-slab.wiremesh']).toBeCloseTo(9, 9);
        expect(o['precast-slab.rebar.RB6']).toBeCloseTo(3.1968, 9);
        expect(o['precast-slab.formwork']).toBeCloseTo(0.6, 9);
        expect(o['precast-slab.concrete']).toBeCloseTo(0.45, 9);
    });
    it('column, roof beam, roof slab, stair rows', () => {
        expect(o['column.rebar.DB16']).toBeCloseTo(151.68, 9);
        expect(o['column.rebar.RB9']).toBeCloseTo(35.928, 9);
        expect(o['column.formwork']).toBeCloseTo(14.4, 9);
        expect(o['column.concrete']).toBeCloseTo(1.08, 9);
        expect(o['roof-beam.rebar.DB12']).toBeCloseTo(21.312, 9);
        expect(o['roof-beam.rebar.RB6']).toBeCloseTo(6.66, 9);
        expect(o['roof-beam.props']).toBe(10);
        expect(o['roof-beam.formwork']).toBeCloseTo(4.8, 9);
        expect(o['roof-beam.concrete']).toBeCloseTo(0.36, 9);
        expect(o['roof-slab.rebar.RB9']).toBeCloseTo(23.952, 9);
        expect(o['roof-slab.props']).toBe(10);
        expect(o['roof-slab.formwork']).toBeCloseTo(6, 9);
        expect(o['roof-slab.concrete']).toBeCloseTo(0.6, 9);
        expect(o['stair.rebar.RB9']).toBeCloseTo(32.3352, 9);
        expect(o['stair.props']).toBe(3);
        expect(o['stair.formwork']).toBeCloseTo(3.78, 9);
        expect(o['stair.concrete']).toBeCloseTo(0.432, 9);
    });
    it('row 18 totals, column by column', () => {
        expect(o['total.excavation']).toBeCloseTo(15.12, 9);
        expect(o['total.sand']).toBeCloseTo(1.26 + 0.75, 9);
        expect(o['total.lean']).toBeCloseTo(0.504 + 0.1, 9);
        expect(o['total.plastic']).toBeCloseTo(12, 9);
        expect(o['total.area']).toBeCloseTo(9, 9);
        expect(o['total.wiremesh']).toBeCloseTo(9, 9);
        expect(o['total.rebar.RB6']).toBeCloseTo(5.328 + 2.664 + 10.656 + 3.1968 + 6.66, 9);   // 28.5048
        expect(o['total.rebar.RB9']).toBeCloseTo(119.76 + 35.928 + 23.952 + 32.3352, 9);       // 211.9752
        expect(o['total.rebar.DB12']).toBeCloseTo(13.024 + 53.28 + 21.312, 9);                 // 87.616
        expect(o['total.rebar.DB16']).toBeCloseTo(25.28 + 151.68, 9);                          // 176.96
        expect(o['total.rebar.DB20']).toBeCloseTo(44.46, 9);
        expect(o['total.props']).toBe(23);
        expect(o['total.formwork']).toBeCloseTo(45.58, 9);
        expect(o['total.concrete']).toBeCloseTo(7.042, 9);
        expect(o['total.backfill']).toBeCloseTo(11.236 + 4.8, 9);
    });
    it('row 20: total rebar = 549.516 kg', () => {
        expect(o['total.rebar']).toBeCloseTo(549.516, 9);
    });
    it('the summary agrees with the BOQ rows the elements feed (concrete, formwork, props)', () => {
        const r = house();
        const q = (k: string) => item(r, k).qty;
        const concrete = ['R58', 'R65', 'R80', 'R94', 'R104', 'R111', 'R124', 'R134', 'R145'].reduce((s, k) => s + q(k), 0);
        const formwork = ['R55', 'R62', 'R77', 'R101', 'R108', 'R121', 'R131', 'R142'].reduce((s, k) => s + q(k), 0);
        const props = ['R119', 'R129', 'R140'].reduce((s, k) => s + q(k), 0);
        expect(sum(r)['total.concrete']).toBeCloseTo(concrete, 9);
        expect(sum(r)['total.formwork']).toBeCloseTo(formwork, 9);
        expect(sum(r)['total.props']).toBe(props);
        expect(q('R68') + q('R88')).toBeCloseTo(sum(r)['total.backfill'] ?? NaN, 9);
    });
    it('the rebar rows on the BOQ add up to the summary\'s total rebar (net kg)', () => {
        const r = house();
        const kg = r.boq.sections.flatMap(s => s.rows)
            .filter((x): x is BoqItemRow => x.type === 'item' && /^[a-z-]+:(rebar|shear-key):(RB6|RB9|DB12|DB16|DB20)$/.test(x.key))
            .reduce((s, x) => s + x.qty, 0);
        expect(kg).toBeCloseTo(549.516, 9);
    });
});

describe('structure-summary — follows its inputs', () => {
    it('doubling the footing count doubles the footing cells and moves only the footing-dependent totals', () => {
        const base = HOUSE.footing as { rows: Record<string, unknown>[] };
        const doubled = house({ calculators: { ...HOUSE, footing: { rows: base.rows.map(r => ({ ...r, count: 4 })) } } });
        const o = sum(doubled);
        expect(o['footing.excavation']).toBeCloseTo(30.24, 9);
        expect(o['footing.concrete']).toBeCloseTo(4, 9);
        expect(o['total.concrete']).toBeCloseTo(7.042 + 2, 9);
        expect(o['total.formwork']).toBeCloseTo(45.58 + 6, 9);
        expect(o['column.concrete']).toBeCloseTo(1.08, 9);   // others untouched
    });
    it('removing the pedestal gives the footing its full backfill back (11.356)', () => {
        const o = sum(house({ calculators: { ...HOUSE, pedestal: { rows: [] } } }));
        expect(o['footing.backfill']).toBeCloseTo(11.356, 9);
        expect(o['pedestal.concrete']).toBe(0);
    });
    it('a bigger pedestal can never make the backfill negative', () => {
        const ped = (HOUSE.pedestal as { rows: Record<string, unknown>[] }).rows;
        const o = sum(house({ calculators: { ...HOUSE, pedestal: { rows: ped.map(r => ({ ...r, count: 5000 })) } } }));
        expect(o['footing.backfill']).toBe(0);
        expect(o['total.backfill']).toBeCloseTo(4.8, 9);
    });
    it.each([
        'ground-beam', 'slab-on-grade', 'precast-slab', 'column', 'roof-beam', 'roof-slab', 'stair',
    ] as const)('%s skipped ("ไม่มีในโครงการนี้"): its row is all 0 and the totals lose exactly that row', (calc) => {
        const full = sum(house());
        const skipped = sum(house({ journey: { [calc]: 'skipped' } }));
        for (const col of SUMMARY_COLUMNS) {
            expect(skipped[`${calc}.${col.key}`], `${calc}.${col.key}`).toBe(0);
            expect(skipped[`total.${col.key}`] ?? NaN, `total.${col.key}`)
                .toBeCloseTo((full[`total.${col.key}`] ?? NaN) - (full[`${calc}.${col.key}`] ?? 0), 9);
        }
    });
    it('footing skipped: its row is 0 (incl. backfill); the pedestal still stands on thickness 0 (bars = height only, 4 stirrups)', () => {
        const o = sum(house({ journey: { footing: 'skipped' } }));
        for (const col of SUMMARY_COLUMNS.filter(c => c.key !== 'backfill')) expect(o[`footing.${col.key}`], col.key).toBe(0);
        expect(o['pedestal.rebar.DB12']).toBeCloseTo(2 * 1 * 4 * 0.888, 9);
        expect(o['pedestal.rebar.RB6']).toBeCloseTo(2 * 4 * 1 * 0.222, 9);   // ROUNDUP((0 + 1) / 0.25) = 4
        expect(o['footing.backfill']).toBe(0);                                 // nothing left to backfill after the pedestal
    });
    it('pedestal skipped: pedestal row is 0; the footing backfill (read from the pedestal calculator) goes with it', () => {
        const o = sum(house({ journey: { pedestal: 'skipped' } }));
        for (const col of SUMMARY_COLUMNS) expect(o[`pedestal.${col.key}`], col.key).toBe(0);
        expect(o['total.concrete']).toBeCloseTo(7.042 - 0.12, 9);
    });
    it('every level skipped: the whole summary is 0', () => {
        const journey: Record<string, 'skipped'> = {};
        for (const el of SUMMARY_ELEMENTS) journey[el.calc] = 'skipped';
        const o = sum(house({ journey }));
        for (const [k, v] of Object.entries(o)) expect(v, k).toBe(0);
    });
    it('the Excel sample project still shows every bar size total finite and non-negative', () => {
        const o = sum(computeProject(createProject()));
        for (const s of SIZES) expect(o[`total.rebar.${s}`] ?? NaN).toBeGreaterThanOrEqual(0);
        expect(Object.values(o).every(Number.isFinite)).toBe(true);
    });
});
