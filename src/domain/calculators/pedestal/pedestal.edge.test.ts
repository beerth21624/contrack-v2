// QA edge tests for "เสาตอม่อ_Footing Column" (Excel v5 sheet 26). Expected values are hand-computed from the
// Excel formulas (docs/excel-spec/02-structure-steps-06-13.md §2.2) and the D1/D13 decisions in the source header.
import { describe, expect, it } from 'vitest';
import { missingRequirements } from '../../journey/requirements';
import {
    footingBackfillKey, newPedestalRow, pedestal, pedestalRow, pedestalsForFootings, remapPedestalFootings,
    type PedestalInput, type PedestalRow,
} from '.';
import { footing, type FootingRow } from '../footing';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const SIZES = ['RB6', 'RB9', 'DB12', 'DB16', 'DB20'] as const;
const KG = { RB6: 0.222, RB9: 0.499, DB12: 0.888, DB16: 1.58, DB20: 2.47 } as const;
const diff = (a: Record<string, number>, b: Record<string, number>, k: string): number => (a[k] ?? NaN) - (b[k] ?? NaN);

function item(r: ProjectResult, key: string): BoqItemRow {
    const row = r.boq.sections.flatMap(s => s.rows).find(x => x.key === key);
    if (row?.type !== 'item') throw new Error(`BOQ item ${key} not found`);
    return row;
}
const hasItem = (r: ProjectResult, key: string) => r.boq.sections.some(s => s.rows.some(x => x.key === key));

/** Footing outputs the pedestal reads, built by hand (row 0: 0.6 wide × 0.6 thick, the Excel sample). */
const sampleFooting = (): Record<string, number> => ({
    rows: 1, backfillGross: 44.3415,
    'row.0.width': 0.6, 'row.0.depth': 0.6, 'row.0.backfillGross': 44.3415,
});
const ctxWith = (fo: Record<string, number> | undefined = sampleFooting()) => ({ outputs: (id: string) => (id === 'footing' ? fo : undefined) });
const noFooting = { outputs: () => undefined };

const base = (): PedestalRow => {
    const r = pedestal.defaults().rows[0];
    if (!r) throw new Error('no default row');
    return { ...r };
};
const withRow = (patch: Partial<PedestalRow>): PedestalRow => ({ ...base(), ...patch });
const out1 = (patch: Partial<PedestalRow>, fo?: Record<string, number>) => pedestal.compute({ rows: [withRow(patch)] }, ctxWith(fo));

/** Hand example P on footing A (1.0 wide, 0.5 thick): see footing.edge.test.ts. */
const P: PedestalRow = {
    name: 'C1', footing: 0, count: 2, width: 0.2, length: 0.3, height: 1,
    mainBarSize: 'DB12', mainBarCount: 4, stirrupSize: 'RB6', stirrupSpacing: 0.25,
};
const FA: FootingRow = {
    name: 'F1', count: 2, width: 1, length: 2, depth: 0.5, excavationDepth: 1.5, sandThickness: 0.1, leanThickness: 0.05,
    shortBarSize: 'DB16', shortBarCount: 4, longBarSize: 'DB20', longBarCount: 3, ringBarSize: 'RB6', ringBarCount: 2,
};
const run = (footings: FootingRow[], pedestals: PedestalRow[], patch: Partial<Project> = {}): ProjectResult =>
    computeProject({ ...createProject('blank'), calculators: { footing: { rows: footings }, pedestal: { rows: pedestals } }, ...patch });

describe('pedestal — blank()', () => {
    it('no rows; with no footing known the outputs are finite and the linked ones 0', () => {
        const b = pedestal.blank?.();
        expect(b).toEqual({ rows: [] });
        if (!b) return;
        const o = pedestal.compute(b, noFooting);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        expect(o.formwork).toBe(0);
        expect(o.concrete).toBe(0);
        expect(o.backfill).toBeUndefined();   // no footing sheet → no backfill figure (the BOQ then shows its own value)
        expect(pedestal.boqSlots?.(b, noFooting)).toEqual({ rebar: [] });
    });
    it('blank + footing known: backfill is the footing backfill', () => {
        const o = pedestal.compute({ rows: [] }, ctxWith());
        expect(o.backfill).toBeCloseTo(44.3415, 9);
    });
    it('blank project: R62, R65, R68 are 0', () => {
        const r = computeProject(createProject('blank'));
        for (const k of ['R62', 'R65', 'R68']) expect(item(r, k).qty, k).toBe(0);
        expect(hasItem(r, 'pedestal:rebar:tie-wire')).toBe(false);
    });
});

describe('pedestal — hand example P on footing A', () => {
    const f = { width: 1, depth: 0.5 };
    const c = pedestalRow(P, f);
    it('main bars', () => {
        expect(c.mainLength).toBeCloseTo(1 + 0.5 + 1 / 3, 12);   // h + t + w/3
        expect(c.mainTotal).toBeCloseTo(2 * (1 + 0.5 + 1 / 3) * 4, 12);   // 14.6667
        expect(c.mainKg).toBeCloseTo(13.024, 9);
    });
    it('stirrups: ROUNDUP((0.5 + 1)/0.25) = 6, 2 × (0.2 + 0.3) = 1.0 m each', () => {
        expect(c.stirrupCount).toBe(6);
        expect(c.stirrupLength).toBeCloseTo(1, 12);
        expect(c.stirrupTotal).toBeCloseTo(12, 12);
        expect(c.stirrupKg).toBeCloseTo(2.664, 9);
    });
    it('formwork and concrete', () => {
        expect(c.formwork).toBeCloseTo(2, 12);   // 2 × 1.0 × 1
        expect(c.concrete).toBeCloseTo(0.12, 12);
    });
});

describe('pedestal — each input changed alone from the Excel sample (21 × 0.25 × 0.2 × 0.6 on footing 0.6/0.6)', () => {
    it('baseline', () => {
        const o = out1({});
        expect(o['main.DB12']).toBeCloseTo(156.6432, 9);
        expect(o['stirrup.RB6']).toBeCloseTo(33.5664, 9);
        expect(o.formwork).toBeCloseTo(11.34, 9);
        expect(o.concrete).toBeCloseTo(0.63, 9);
        expect(o.backfill).toBeCloseTo(44.3415 - 0.63, 9);
    });
    it('count 42 doubles everything', () => {
        const o = out1({ count: 42 });
        expect(o['main.DB12']).toBeCloseTo(313.2864, 9);
        expect(o['stirrup.RB6']).toBeCloseTo(67.1328, 9);
        expect(o.formwork).toBeCloseTo(22.68, 9);
        expect(o.concrete).toBeCloseTo(1.26, 9);
    });
    it('width 0.3 (stirrup 2 × (0.3 + 0.2) = 1.0 m)', () => {
        const o = out1({ width: 0.3 });
        expect(o['stirrup.RB6']).toBeCloseTo(21 * 8 * 1.0 * 0.222, 9);   // 37.296
        expect(o.formwork).toBeCloseTo(21 * 1.0 * 0.6, 9);               // 12.6
        expect(o.concrete).toBeCloseTo(21 * 0.06 * 0.6, 9);              // 0.756
        expect(o['main.DB12']).toBeCloseTo(156.6432, 9);
    });
    it('length 0.3 (stirrup 2 × (0.25 + 0.3) = 1.1 m)', () => {
        const o = out1({ length: 0.3 });
        expect(o['stirrup.RB6']).toBeCloseTo(21 * 8 * 1.1 * 0.222, 9);   // 41.0256
        expect(o.formwork).toBeCloseTo(21 * 1.1 * 0.6, 9);               // 13.86
        expect(o.concrete).toBeCloseTo(21 * 0.075 * 0.6, 9);             // 0.945
    });
    it('height 0.9: bar 0.9 + 0.6 + 0.2 = 1.7, stirrups ROUNDUP(1.5/0.15) = 10', () => {
        const o = out1({ height: 0.9 });
        expect(o['main.DB12']).toBeCloseTo(21 * 1.7 * 6 * 0.888, 9);   // 190.2096
        expect(o['stirrup.RB6']).toBeCloseTo(21 * 10 * 0.9 * 0.222, 9); // 41.958
        expect(o.formwork).toBeCloseTo(17.01, 9);
        expect(o.concrete).toBeCloseTo(0.945, 9);
    });
    it('main bar count 8', () => {
        expect(out1({ mainBarCount: 8 })['main.DB12']).toBeCloseTo(21 * 1.4 * 8 * 0.888, 9);   // 208.8576
        expect(out1({ mainBarCount: 0 })['main.DB12']).toBe(0);
    });
    it.each([
        [0.1, 12, 21 * 12 * 0.9 * 0.222],   // 1.2/0.1 = 12
        [0.2, 6, 21 * 6 * 0.9 * 0.222],     // 1.2/0.2 = 6 (5.999999999999999 in IEEE)
        [0.25, 5, 21 * 5 * 0.9 * 0.222],    // 4.8 → 5
        [0.3, 4, 21 * 4 * 0.9 * 0.222],
        [1.2, 1, 21 * 1 * 0.9 * 0.222],
        [5, 1, 21 * 1 * 0.9 * 0.222],       // spacing larger than the pier: still 1
    ])('stirrup spacing %s gives %s stirrups', (spacing, count, kg) => {
        const o = out1({ stirrupSpacing: spacing });
        expect(o['stirrup.RB6']).toBeCloseTo(kg, 9);
        expect(pedestalRow(withRow({ stirrupSpacing: spacing }), { width: 0.6, depth: 0.6 }).stirrupCount).toBe(count);
    });
    it.each([0, -0.15, NaN])('spacing %s: no stirrups (Excel "-" → 0 kg), no NaN', (spacing) => {
        const c = pedestalRow(withRow({ stirrupSpacing: spacing }), { width: 0.6, depth: 0.6 });
        expect(c.stirrupCount).toBeNull();
        expect(c.stirrupTotal).toBeNull();
        expect(c.stirrupKg).toBe(0);
        expect(out1({ stirrupSpacing: spacing })['stirrup.RB6']).toBe(0);
    });
});

describe('pedestal — ROUNDUP boundaries of the stirrup count (footing thickness + height) / spacing', () => {
    const count = (depth: number, h: number, s: number) =>
        pedestalRow(withRow({ height: h, stirrupSpacing: s }), { width: 0.6, depth }).stirrupCount;
    it.each([
        [0.6, 0.75, 0.15, 9],      // (0.75 + 0.6)/0.15 = 9.000000000000002 in IEEE → must stay 9
        [0.6, 0.9, 0.15, 10],
        [0.6, 0.3, 0.15, 6],       // 0.9/0.15 = 6.000000000000001
        [0.6, 0.751, 0.15, 10],    // 9.0067 → 10
        [0.6, 0.749, 0.15, 9],     // 8.993 → 9
        [0.5, 1, 0.25, 6],
        [0.5, 1.01, 0.25, 7],
        [0.3, 0.3, 0.2, 3],        // 0.6/0.2 = 2.9999999999999996
        [0.45, 0.45, 0.15, 6],     // 0.9/0.15
        [0.6, 0.0001, 0.15, 5],    // 0.6001/0.15 = 4.0007 → 5
        [0, 0, 0.15, 0],           // no height, no footing → 0 stirrups
        [0.6, 0, 0.15, 4],         // zero-height pier: footing thickness alone counts, as Excel
    ])('footing %s + height %s over %s → %s', (depth, h, s, expected) => {
        expect(count(depth, h, s)).toBe(expected);
    });
});

describe('pedestal — every bar size option', () => {
    it.each(SIZES)('main bars %s: 176.4 m × kg/m', (size) => {
        const o = out1({ mainBarSize: size });
        expect(o[`main.${size}`]).toBeCloseTo(176.4 * KG[size], 9);
        expect(o[`rebar.${size}`]).toBeCloseTo(176.4 * KG[size] + (size === 'RB6' ? 33.5664 : 0), 9);
    });
    it.each(SIZES)('stirrups %s: 151.2 m × kg/m', (size) => {
        const o = out1({ stirrupSize: size, mainBarSize: '' });
        expect(o[`stirrup.${size}`]).toBeCloseTo(151.2 * KG[size], 9);
        expect(o[`rebar.${size}`]).toBeCloseTo(151.2 * KG[size], 9);
    });
    it.each(['', 'DB25', 'rb6'])('unknown size "%s" weighs 0 and gets no rebar row', (size) => {
        const rows = [withRow({ mainBarSize: size, stirrupSize: size })];
        const o = pedestal.compute({ rows }, ctxWith());
        for (const s of SIZES) expect(o[`rebar.${s}`], s).toBe(0);
        expect(pedestal.boqSlots?.({ rows }, ctxWith())).toEqual({ rebar: [] });
    });
});

describe('pedestal — reads the footing it sits on (D13 row pairing)', () => {
    const two = (): Record<string, number> => ({
        rows: 2, backfillGross: 20,
        'row.0.width': 0.6, 'row.0.depth': 0.6, 'row.0.backfillGross': 12,
        'row.1.width': 1.2, 'row.1.depth': 0.9, 'row.1.backfillGross': 8,
    });
    it('footing 1 gives bar length h + 0.9 + 1.2/3 = 0.6 + 0.9 + 0.4 = 1.9', () => {
        const o = out1({ footing: 1, count: 1, mainBarCount: 1 }, two());
        expect(o['main.DB12']).toBeCloseTo(1.9 * 0.888, 9);
    });
    it('footing 1: stirrups ROUNDUP((0.9 + 0.6)/0.15) = 10', () => {
        const o = out1({ footing: 1, count: 1 }, two());
        expect(o['stirrup.RB6']).toBeCloseTo(10 * 0.9 * 0.222, 9);
    });
    it.each([-1, 2, 99, 1.5])('footing index %s (no such row): width and thickness read as 0, finite', (idx) => {
        const o = out1({ footing: idx, count: 1, mainBarCount: 1 }, two());
        expect(o['main.DB12']).toBeCloseTo(0.6 * 0.888, 9);   // bar length = height only
        for (const v of Object.values(o)) expect(Number.isFinite(v)).toBe(true);
    });
    it('no footing sheet output at all: same as footing 0/0', () => {
        const o = pedestal.compute({ rows: [withRow({ count: 1, mainBarCount: 1 })] }, noFooting);
        expect(o['main.DB12']).toBeCloseTo(0.6 * 0.888, 9);
        expect(o.backfill).toBeUndefined();
    });
    it('each pedestal row subtracts its concrete from its own footing backfill only', () => {
        const rows: PedestalRow[] = [withRow({ footing: 1, count: 10 }), withRow({ footing: 0, count: 1 })];
        // concrete: 10 × 0.25 × 0.2 × 0.6 = 0.3 on footing 1; 1 × … = 0.03 on footing 0
        const o = pedestal.compute({ rows }, ctxWith(two()));
        expect(o[footingBackfillKey(0)]).toBeCloseTo(12 - 0.03, 9);
        expect(o[footingBackfillKey(1)]).toBeCloseTo(8 - 0.3, 9);
        expect(o.backfill).toBeCloseTo(20 - 0.33, 9);
    });
    it('backfill never goes negative, per footing and in total (D1)', () => {
        const o = out1({ count: 5000 }, sampleFooting());
        expect(o.backfill).toBe(0);
        expect(o[footingBackfillKey(0)]).toBe(0);
    });
    it('a pedestal on a missing footing row still lowers the total backfill (Excel pairs every row)', () => {
        const o = out1({ footing: 7, count: 100 }, sampleFooting());   // concrete 100 × 0.03 = 3
        expect(o.backfill).toBeCloseTo(44.3415 - 3, 9);
        expect(o[footingBackfillKey(0)]).toBeCloseTo(44.3415, 9);
    });
});

describe('pedestal — zero, negative, decimal and huge values', () => {
    const FIELDS = ['count', 'width', 'length', 'height', 'mainBarCount', 'stirrupSpacing', 'footing'] as const;
    it.each(FIELDS)('%s = 0 / -1 / NaN / Infinity / 1e9 / 0.0001 never gives NaN or Infinity', (field) => {
        for (const v of [0, -1, NaN, Infinity, -Infinity, 1e9, 0.0001, 2.718]) {
            const o = out1({ [field]: v });
            for (const [k, x] of Object.entries(o)) expect(Number.isFinite(x), `${field}=${v} ${k}`).toBe(true);
        }
    });
    it('count 0 gives all zero quantities', () => {
        const o = out1({ count: 0 });
        expect(o.formwork).toBe(0);
        expect(o.concrete).toBe(0);
        expect(o['rebar.DB12']).toBe(0);
        expect(o.backfill).toBeCloseTo(44.3415, 9);
    });
});

describe('pedestal — table size and journey helpers', () => {
    it('25 rows (more than Excel): totals are the sum, none dropped', () => {
        const rows = Array.from({ length: 25 }, base);
        const o = pedestal.compute({ rows }, ctxWith());
        expect(o.concrete).toBeCloseTo(25 * 0.63, 9);
        expect(o.formwork).toBeCloseTo(25 * 11.34, 9);
        expect(o['main.DB12']).toBeCloseTo(25 * 156.6432, 9);
    });
    it('delete a row removes its share', () => {
        const rows = [base(), withRow({ count: 2 }), withRow({ count: 4 })];
        const a = pedestal.compute({ rows }, ctxWith());
        const b = pedestal.compute({ rows: [rows[0] ?? base(), rows[2] ?? base()] }, ctxWith());
        expect(diff(a, b, 'concrete')).toBeCloseTo(2 * 0.03, 9);
    });
    it('newPedestalRow: first free footing, its count, standard bars, next free name', () => {
        const footings = [{ count: 4 }, { count: 9 }];
        const first = newPedestalRow([], footings);
        expect(first).toEqual({
            name: 'C1', footing: 0, count: 4, width: 0, length: 0, height: 0,
            mainBarSize: 'DB12', mainBarCount: 0, stirrupSize: 'RB6', stirrupSpacing: 0.15,
        });
        const second = newPedestalRow([first], footings);
        expect(second.footing).toBe(1);
        expect(second.count).toBe(9);
        expect(second.name).toBe('C2');
        const third = newPedestalRow([first, second], footings);   // all footings used → first footing again
        expect(third.footing).toBe(0);
        expect(third.name).toBe('C3');
        expect(newPedestalRow([first, second, third], footings).name).toBe('');   // Excel list has only C1–C3
        expect(newPedestalRow([], []).count).toBe(0);
    });
    it('pedestalsForFootings: one pedestal per footing type', () => {
        const rows = pedestalsForFootings([{ count: 4 }, { count: 9 }, { count: 1 }]);
        expect(rows.map(r => [r.name, r.footing, r.count])).toEqual([['C1', 0, 4], ['C2', 1, 9], ['C3', 2, 1]]);
        expect(pedestalsForFootings([])).toEqual([]);
    });
    it('remapPedestalFootings: deleting footing row 1 of 3 re-points the pedestals', () => {
        const f = ['a', 'b', 'c'];
        const input: PedestalInput = { rows: [withRow({ footing: 0 }), withRow({ footing: 1 }), withRow({ footing: 2 })] };
        const next = remapPedestalFootings(input, f, ['a', 'c']);
        expect(next?.rows.map(r => r.footing)).toEqual([0, -1, 1]);
    });
    it('remapPedestalFootings: nothing deleted or nothing to change returns undefined', () => {
        const f = ['a', 'b'];
        const input: PedestalInput = { rows: [withRow({ footing: 0 })] };
        expect(remapPedestalFootings(input, f, f)).toBeUndefined();
        expect(remapPedestalFootings(input, f, ['a'])).toBeUndefined();   // row 0 survives at index 0
        expect(remapPedestalFootings(input, f, [])?.rows[0]?.footing).toBe(-1);
    });
});

describe('pedestal — through computeProject (footing → pedestal dependency, slots, BOQ)', () => {
    const r = run([FA], [P]);
    it('pedestal bars use the real footing thickness and width', () => {
        expect(r.calcOutputs.pedestal?.['main.DB12']).toBeCloseTo(13.024, 9);
        expect(r.calcOutputs.pedestal?.['stirrup.RB6']).toBeCloseTo(2.664, 9);
    });
    it('changing the footing thickness lengthens the pedestal bars (0.5 → 0.8: bar 1 + 0.8 + 1/3)', () => {
        const x = run([{ ...FA, depth: 0.8 }], [P]);
        expect(x.calcOutputs.pedestal?.['main.DB12']).toBeCloseTo(2 * (1 + 0.8 + 1 / 3) * 4 * 0.888, 9);
        expect(x.calcOutputs.pedestal?.['stirrup.RB6']).toBeCloseTo(2 * Math.ceil((0.8 + 1) / 0.25 - 1e-9) * 1 * 0.222, 9);   // (1.8/0.25 = 7.2 → 8)
    });
    it('R68 backfill = 11.356 − 0.12 = 11.236 at 125 labour', () => {
        expect(item(r, 'R68').qty).toBeCloseTo(11.236, 9);
        expect(item(r, 'R68').total).toBeCloseTo(1404.5, 9);
        expect(r.calcOutputs.pedestal?.backfill).toBeCloseTo(11.236, 9);
    });
    it('R62 formwork 2 m² and R65 concrete 0.12 m³ (ordered as MAX(1, …) = 1 m³)', () => {
        expect(item(r, 'R62').total).toBeCloseTo(2 * 250 + 2 * 150, 9);
        expect(item(r, 'R63').qty).toBeCloseTo(1.2, 9);
        expect(item(r, 'R64').qty).toBeCloseTo(0.5, 9);
        expect(item(r, 'R65').grossQty).toBe(1);
        expect(item(r, 'R65').total).toBeCloseTo(2500 * 1 + 1000 * 0.12, 9);
    });
    it('rebar rows RB6 + DB12 + tie wire with waste 6 % / 12 % / 3 %', () => {
        const rb6 = item(r, 'pedestal:rebar:RB6');
        const db12 = item(r, 'pedestal:rebar:DB12');
        expect(rb6.qty).toBeCloseTo(2.664, 9);
        expect(rb6.grossQty).toBeCloseTo(2.664 * 1.06, 9);
        expect(db12.grossQty).toBeCloseTo(13.024 * 1.12, 9);
        expect(db12.labTotal).toBeCloseTo(15 * 13.024, 9);
        expect(item(r, 'pedestal:rebar:tie-wire').grossQty).toBeCloseTo(0.03 * (2.664 * 1.06 + 13.024 * 1.12), 9);
        expect(hasItem(r, 'pedestal:rebar:DB16')).toBe(false);
    });
    it('pedestal level skipped: R62, R65, R68 and the rebar rows are 0', () => {
        const s = run([FA], [P], { journey: { pedestal: 'skipped' }, boqOverrides: { R65: { qty: 3 } } });
        for (const k of ['R62', 'R63', 'R64', 'R65', 'R68']) expect(item(s, k).qty, k).toBe(0);
        expect(hasItem(s, 'pedestal:rebar:DB12')).toBe(false);
        expect(item(s, 'R38').qty).toBeCloseTo(15.12, 9);   // footing untouched
    });
    it('footing level skipped but pedestal kept: finite outputs, no negative backfill, pedestal bars use thickness 0', () => {
        const s = run([FA], [P], { journey: { footing: 'skipped' } });
        const o = s.calcOutputs.pedestal ?? {};
        for (const v of Object.values(o)) expect(Number.isFinite(v)).toBe(true);
        expect(item(s, 'R68').qty).toBe(0);
        expect(o['main.DB12']).toBeCloseTo(2 * 1 * 4 * 0.888, 9);   // bar = height only
    });
    it('footing.compute output is what the pedestal reads (dependency list)', () => {
        expect(pedestal.deps).toEqual(['footing']);
        expect(footing.compute({ rows: [FA] }, noFooting)['row.0.depth']).toBe(0.5);
    });
});

describe('pedestal — required fields (REQUIRED_FIELDS decision table)', () => {
    const missing = (rows: PedestalRow[], footings: FootingRow[] = [FA], patch: Partial<Project> = {}) =>
        missingRequirements('pedestal', {
            ...createProject('blank'), calculators: { footing: { rows: footings }, pedestal: { rows } }, ...patch,
        });
    const keys = (rows: PedestalRow[], footings: FootingRow[] = [FA]) => missing(rows, footings).map(m => m.fieldKey ?? m.label);

    it('a complete pedestal on an existing footing meets every requirement', () => {
        expect(keys([P])).toEqual([]);
    });
    it('no pedestal rows: nothing is asked (no "at least one" on this step)', () => {
        expect(keys([])).toEqual([]);
    });
    it.each(['count', 'width', 'length', 'height'] as const)('%s empty (0 / negative / NaN / Infinity) is reported; a tiny positive value is accepted', (field) => {
        for (const v of [0, -1, NaN, Infinity]) expect(keys([{ ...P, [field]: v }]), `${field}=${v}`).toEqual([field]);
        expect(keys([{ ...P, [field]: 0.0001 }])).toEqual([]);
    });
    it.each([-1, 1, 5, 0.5, NaN])('footing index %s with one footing row is reported as not sitting on a footing', (idx) => {
        expect(keys([{ ...P, footing: idx }])).toEqual(['footing']);
    });
    it('footing index 1 is valid once there are two footings', () => {
        expect(keys([{ ...P, footing: 1 }], [FA, FA])).toEqual([]);
        expect(keys([{ ...P, footing: 1 }], [FA])).toEqual(['footing']);
    });
    it('no footing at all: every started pedestal is reported against the missing footing', () => {
        expect(keys([P], [])).toEqual(['footing']);
    });
    it('a row with only a copied count (no size, no bars) is not started and is ignored', () => {
        expect(keys([{ ...P, width: 0, length: 0, height: 0, mainBarCount: 0 }])).toEqual([]);
    });
    it('marked "ไม่มีในโครงการนี้" there is nothing to complete', () => {
        expect(missing([{ ...P, width: 0 }], [FA], { journey: { pedestal: 'skipped' } })).toEqual([]);
    });
});
