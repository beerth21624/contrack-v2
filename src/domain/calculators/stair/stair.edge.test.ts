// QA edge tests for "บันได_Stair" (Excel v5 sheet 33). Expected values are hand-computed from the Excel formulas
// (docs/excel-spec/02-structure-steps-06-13.md §2.9). The hand examples use a 1.2 / 0.9 / 1.5 (3-4-5) triangle so
// the inclined length is exact.
import { describe, expect, it } from 'vitest';
import { missingRequirements } from '../../journey/requirements';
import {
    newStairRow, stair, stairRow, stairTotals, STAIR_ANCHORAGE, STAIR_BAR_SIZES, STAIR_NAMES, withStepChange,
    type StairInput, type StairRow,
} from '.';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const diff = (a: Record<string, number>, b: Record<string, number>, k: string): number => (a[k] ?? NaN) - (b[k] ?? NaN);
const SIZES = ['RB6', 'RB9', 'DB12', 'DB16', 'DB20'] as const;
const KG = { RB6: 0.222, RB9: 0.499, DB12: 0.888, DB16: 1.58, DB20: 2.47 } as const;
const WASTE = { RB6: 1.06, RB9: 1.09, DB12: 1.12, DB16: 1.12, DB20: 1.12 } as const;

function item(r: ProjectResult, key: string): BoqItemRow {
    const row = r.boq.sections.flatMap(s => s.rows).find(x => x.key === key);
    if (row?.type !== 'item') throw new Error(`BOQ item ${key} not found`);
    return row;
}
const hasItem = (r: ProjectResult, key: string) => r.boq.sections.some(s => s.rows.some(x => x.key === key));
const run = (rows: StairRow[], patch: Partial<Project> = {}): ProjectResult =>
    computeProject({ ...createProject('blank'), calculators: { stair: { rows } }, ...patch });
const slotRows = (input: StairInput) => stair.boqSlots?.(input, ctx).rebar ?? [];

/** S: width 1.2, waist 0.15, rise 0.9, run 1.2 (incline 1.5), 6 steps of 0.15 × 0.30, RB9 @0.15 in all four groups. */
const S: StairRow = {
    name: 'บันไดหน้าบ้าน', width: 1.2, waist: 0.15, rise: 0.9, run: 1.2, steps: 6, riser: 0.15, tread: 0.3,
    waistMainSize: 'RB9', waistMainSpacing: 0.15, waistTempSize: 'RB9', waistTempSpacing: 0.15,
    stepMainSize: 'RB9', stepMainSpacing: 0.15, stepTempSize: 'RB9', stepTempSpacing: 0.15,
};
const withS = (patch: Partial<StairRow>): StairRow => ({ ...S, ...patch });
const out1 = (patch: Partial<StairRow>) => stair.compute({ rows: [withS(patch)] }, ctx);
const NO_BARS = { waistMainSize: '', waistTempSize: '', stepMainSize: '', stepTempSize: '' } as const;

describe('stair — blank()', () => {
    it('no stairs; outputs finite; linked outputs and rebar 0; no slot rows', () => {
        const b = stair.blank?.();
        expect(b).toEqual({ rows: [] });
        if (!b) return;
        const o = stair.compute(b, ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const l of stair.boqLinks) expect(o[l.output], l.output).toBe(0);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(stair.boqSlots?.(b, ctx)).toEqual({ rebar: [] });
    });
    it('blank project: R140–R145 are 0', () => {
        const r = computeProject(createProject('blank'));
        for (const k of ['R140', 'R142', 'R143', 'R144', 'R145']) expect(item(r, k).qty, k).toBe(0);
        expect(hasItem(r, 'stair:rebar:tie-wire')).toBe(false);
    });
});

describe('stair — hand example S (every cell)', () => {
    const c = stairRow(S);
    it('inclined length √(1.2² + 0.9²) = 1.5', () => {
        expect(c.inclined).toBeCloseTo(1.5, 12);
    });
    it('waist main bars: ROUNDUP(1.2/0.15) = 8, each (1.5 + 1.2 anchorage) = 2.7 m → 21.6 m', () => {
        expect(STAIR_ANCHORAGE).toBe(1.2);
        expect(c.waistMain.count).toBe(8);
        expect(c.waistMain.length).toBeCloseTo(21.6, 9);
        expect(c.waistMain.kg).toBeCloseTo(21.6 * 0.499, 9);   // 10.7784
    });
    it('waist temperature bars: ROUNDUP(1.5/0.15) = 10, each as long as the width → 12 m', () => {
        expect(c.waistTemp.count).toBe(10);
        expect(c.waistTemp.length).toBeCloseTo(12, 9);
        expect(c.waistTemp.kg).toBeCloseTo(5.988, 9);
    });
    it('step main bars: 8 × (run 1.2 + rise 0.9) = 16.8 m', () => {
        expect(c.stepMain.count).toBe(8);
        expect(c.stepMain.length).toBeCloseTo(16.8, 9);
        expect(c.stepMain.kg).toBeCloseTo(8.3832, 9);
    });
    it('step temperature bars: 2 per step = 12 bars × width 1.2 = 14.4 m (spacing unused)', () => {
        expect(c.stepTemp.count).toBe(12);
        expect(c.stepTemp.length).toBeCloseTo(14.4, 9);
        expect(c.stepTemp.kg).toBeCloseTo(7.1856, 9);
    });
    it('formwork parts: soffit 1.8, waist sides 0.45, step sides 0.45, risers 1.08 → 3.78', () => {
        expect(c.soffit).toBeCloseTo(1.8, 12);
        expect(c.waistSides).toBeCloseTo(0.45, 12);
        expect(c.stepSides).toBeCloseTo(0.45, 12);
        expect(c.risers).toBeCloseTo(1.08, 12);
        expect(c.formwork).toBeCloseTo(3.78, 12);
    });
    it('props ROUNDUP(1.8 / 0.6) = 3; concrete waist 0.27 + steps 0.162 = 0.432', () => {
        expect(c.props).toBe(3);
        expect(c.waistConcrete).toBeCloseTo(0.27, 12);
        expect(c.stepConcrete).toBeCloseTo(0.162, 12);
        expect(c.concrete).toBeCloseTo(0.432, 12);
    });
    it('compute() totals: rebar RB9 = 64.8 m × 0.499 = 32.3352', () => {
        const o = stair.compute({ rows: [S] }, ctx);
        expect(o['rebar.RB9']).toBeCloseTo(32.3352, 9);
        expect(o.props).toBe(3);
        expect(o.formwork).toBeCloseTo(3.78, 9);
        expect(o.concrete).toBeCloseTo(0.432, 9);
    });
});

describe('stair — each input changed alone from S', () => {
    it('width 2.4 (all four bar groups follow the width)', () => {
        const o = out1({ width: 2.4 });
        // waist main 16 × 2.7 = 43.2; waist temp 10 × 2.4 = 24; step main 16 × 2.1 = 33.6; step temp 12 × 2.4 = 28.8
        expect(o['rebar.RB9']).toBeCloseTo((43.2 + 24 + 33.6 + 28.8) * 0.499, 9);   // 64.6704
        expect(o.formwork).toBeCloseTo(3.6 + 0.45 + 0.45 + 2.16, 9);                // 6.66
        expect(o.props).toBe(6);
        expect(o.concrete).toBeCloseTo(0.54 + 0.324, 9);
    });
    it('waist thickness 0.2: waist sides and waist concrete only', () => {
        const o = out1({ waist: 0.2 });
        expect(o.formwork).toBeCloseTo(1.8 + 0.6 + 0.45 + 1.08, 9);   // 3.93
        expect(o.concrete).toBeCloseTo(0.36 + 0.162, 9);
        expect(o['rebar.RB9']).toBeCloseTo(32.3352, 9);
    });
    it('rise 0 (flat): incline = run 1.2', () => {
        const o = out1({ rise: 0 });
        // waist main 8 × (1.2 + 1.2) = 19.2; waist temp ROUNDUP(1.2/0.15) = 8 × 1.2 = 9.6; step main 8 × 1.2 = 9.6; step temp 14.4
        expect(o['rebar.RB9']).toBeCloseTo(52.8 * 0.499, 9);
        expect(o.formwork).toBeCloseTo(1.44 + 0.36 + 0.36 + 1.08, 9);   // 3.24
        expect(o.props).toBe(3);                                         // ROUNDUP(1.44/0.6 = 2.4)
        expect(o.concrete).toBeCloseTo(0.216 + 0.162, 9);
    });
    it('run 0 (vertical): incline = rise 0.9', () => {
        const o = out1({ run: 0 });
        // waist main 8 × 2.1 = 16.8; waist temp ROUNDUP(0.9/0.15 = 6) = 6 × 1.2 = 7.2; step main 8 × 0.9 = 7.2; step temp 14.4
        expect(o['rebar.RB9']).toBeCloseTo(45.6 * 0.499, 9);
        expect(o.props).toBe(2);   // soffit 1.08 / 0.6 = 1.8
    });
    it('8 steps: 16 step-temp bars, risers 1.44, step concrete 0.216', () => {
        const o = out1({ steps: 8 });
        expect(o['rebar.RB9']).toBeCloseTo((21.6 + 12 + 16.8 + 19.2) * 0.499, 9);   // 69.6 m
        expect(o.formwork).toBeCloseTo(1.8 + 0.45 + 0.45 + 1.44, 9);
        expect(o.concrete).toBeCloseTo(0.27 + 0.216, 9);
    });
    it('riser 0.2: step sides 0.6, risers 1.44, step concrete 0.216', () => {
        const o = out1({ riser: 0.2 });
        expect(o.formwork).toBeCloseTo(1.8 + 0.45 + 0.6 + 1.44, 9);   // 4.29
        expect(o.concrete).toBeCloseTo(0.27 + 0.216, 9);
    });
    it('tread 0.4: only the step concrete (0.216)', () => {
        const o = out1({ tread: 0.4 });
        expect(o.concrete).toBeCloseTo(0.27 + 0.216, 9);
        expect(o.formwork).toBeCloseTo(3.78, 9);
    });
    it('waist main spacing 0.2 → 6 bars × 2.7; 0.3 → 4 bars', () => {
        expect(out1({ ...NO_BARS, waistMainSize: 'RB9', waistMainSpacing: 0.2 })['rebar.RB9']).toBeCloseTo(16.2 * 0.499, 9);
        expect(out1({ ...NO_BARS, waistMainSize: 'RB9', waistMainSpacing: 0.3 })['rebar.RB9']).toBeCloseTo(10.8 * 0.499, 9);
    });
    it('waist temp spacing 0.3 → ROUNDUP(5) = 5 bars × 1.2 m = 6 m', () => {
        expect(out1({ ...NO_BARS, waistTempSize: 'RB9', waistTempSpacing: 0.3 })['rebar.RB9']).toBeCloseTo(6 * 0.499, 9);
    });
    it('step main spacing 0.3 → 4 bars × 2.1 m = 8.4 m', () => {
        expect(out1({ ...NO_BARS, stepMainSize: 'RB9', stepMainSpacing: 0.3 })['rebar.RB9']).toBeCloseTo(8.4 * 0.499, 9);
    });
    it('step temp spacing is NOT used by any Excel formula (AB unused): changing or zeroing it changes nothing', () => {
        const base = out1({});
        for (const v of [0, 0.05, 0.5, 5, NaN, -1]) {
            expect(out1({ stepTempSpacing: v }), `spacing ${v}`).toEqual(base);
        }
    });
    it.each(['waistMain', 'waistTemp', 'stepMain'] as const)('%s spacing 0 / negative / NaN: the group has no bars (Excel "_")', (group) => {
        for (const v of [0, -0.15, NaN]) {
            const c = stairRow(withS({ [`${group}Spacing`]: v }));
            expect(c[group].count).toBeNull();
            expect(c[group].length).toBeNull();
            expect(c[group].kg).toBe(0);
        }
    });
});

describe('stair — ROUNDUP boundaries of the bar counts', () => {
    it.each([
        // width, spacing, waistMain count = ROUNDUP(width / spacing)
        [1.2, 0.15, 8], [1.35, 0.15, 9], [1.5, 0.15, 10], [1.51, 0.15, 11], [0.3, 0.1, 3], [3.3, 0.15, 22], [0.9, 0.3, 3],
        [2, 0.15, 14], [2.9, 0.15, 20], [0, 0.15, 0], [0.0001, 0.15, 1], [0.6, 0.2, 3],
    ])('width %s over spacing %s → %s bars', (width, spacing, n) => {
        expect(stairRow(withS({ width, waistMainSpacing: spacing })).waistMain.count).toBe(n);
        expect(stairRow(withS({ width, stepMainSpacing: spacing })).stepMain.count).toBe(n);
    });
    it.each([
        // run, rise → incline; waist temp count = ROUNDUP(incline / 0.15)
        [1.2, 0.9, 10], [0.9, 0, 6], [0.45, 0, 3], [0.46, 0, 4], [0, 0, 0], [0.3, 0.4, 4], [1.5, 2, 17],
    ])('run %s rise %s → %s waist temperature bars', (run, rise, n) => {
        expect(stairRow(withS({ run, rise })).waistTemp.count).toBe(n);
    });
    it.each([
        // C (width) with run 1.2 rise 0 → incline 1.2 → soffit = 1.2 × C; props = ROUNDUP(soffit / 0.6)
        [0.5, 1], [1, 2], [1.5, 3], [0.51, 2], [3, 6], [0, 0], [0.0001, 1], [2.5, 5], [2.51, 6],
    ])('soffit with width %s needs %s props', (width, props) => {
        expect(stairRow(withS({ width, rise: 0 })).props).toBe(props);
    });
    it('props are rounded per stair, then added', () => {
        const rows = [withS({ width: 0.5, rise: 0 }), withS({ width: 0.5, rise: 0 })];   // soffit 0.6 each → 1 + 1
        expect(stair.compute({ rows }, ctx).props).toBe(2);
        const rows2 = [withS({ width: 0.7, rise: 0 }), withS({ width: 0.7, rise: 0 })];  // 0.84 → 2 each → 4 (not ROUNDUP(1.68/0.6)=3)
        expect(stair.compute({ rows: rows2 }, ctx).props).toBe(4);
    });
});

describe('stair — every bar size option in every group', () => {
    const GROUPS = [
        ['waistMainSize', 21.6], ['waistTempSize', 12], ['stepMainSize', 16.8], ['stepTempSize', 14.4],
    ] as const;
    it('dropdowns', () => {
        expect([...STAIR_BAR_SIZES]).toEqual([...SIZES]);
        expect([...STAIR_NAMES]).toEqual(['บันไดข้างบ้าน', 'บันไดหน้าบ้าน', 'บันไดหลังบ้าน']);
    });
    for (const [field, metres] of GROUPS) {
        it.each(SIZES)(`${field} = %s: ${metres} m × kg/m`, (size) => {
            const o = out1({ ...NO_BARS, [field]: size });
            expect(o[`rebar.${size}`]).toBeCloseTo(metres * KG[size], 9);
            for (const other of SIZES.filter(s => s !== size)) expect(o[`rebar.${other}`], other).toBe(0);
        });
    }
    it.each(['', 'DB25', 'rb9'])('unknown size "%s" in all groups: 0 kg, no slot row, concrete kept', (size) => {
        const row = withS({ waistMainSize: size, waistTempSize: size, stepMainSize: size, stepTempSize: size });
        const o = stair.compute({ rows: [row] }, ctx);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(slotRows({ rows: [row] })).toEqual([]);
        expect(o.concrete).toBeCloseTo(0.432, 9);
    });
    it('the four groups of different sizes add into their own size totals', () => {
        const row = withS({ waistMainSize: 'DB12', waistTempSize: 'RB6', stepMainSize: 'DB12', stepTempSize: 'RB9' });
        const o = stair.compute({ rows: [row] }, ctx);
        expect(o['rebar.DB12']).toBeCloseTo((21.6 + 16.8) * 0.888, 9);
        expect(o['rebar.RB6']).toBeCloseTo(12 * 0.222, 9);
        expect(o['rebar.RB9']).toBeCloseTo(14.4 * 0.499, 9);
    });
});

describe('stair — zero, negative, decimal and huge values', () => {
    const FIELDS = ['width', 'waist', 'rise', 'run', 'steps', 'riser', 'tread', 'waistMainSpacing', 'waistTempSpacing', 'stepMainSpacing'] as const;
    it.each(FIELDS)('%s = 0 / -1 / NaN / Infinity / 1e9 / 0.0001 never gives NaN or Infinity', (field) => {
        for (const v of [0, -1, NaN, Infinity, -Infinity, 1e9, 0.0001, 1.2345]) {
            for (const [k, x] of Object.entries(out1({ [field]: v }))) expect(Number.isFinite(x), `${field}=${v} ${k}`).toBe(true);
        }
    });
    it('width 0: no bars, no concrete, no props; only the side forms (2·D·G, 2·I·G) remain, as in Excel', () => {
        const o = out1({ width: 0 });
        for (const k of ['props', 'concrete']) expect(o[k], k).toBe(0);
        expect(o.formwork).toBeCloseTo(0.9, 9);
        expect(o['rebar.RB9']).toBe(0);
    });
    it('a 3 m × 4 m flat stair (rise 0, run 4): incline 4', () => {
        expect(stairRow(withS({ rise: 0, run: 4 })).inclined).toBe(4);
    });
    it('a negative rise has the same incline as the positive one (squared)', () => {
        expect(stairRow(withS({ rise: -0.9 })).inclined).toBeCloseTo(1.5, 12);
    });
    it('NaN behaves like 0', () => {
        expect(out1({ steps: NaN })).toEqual(out1({ steps: 0 }));
    });
    it('huge stair 1e5 m wide stays finite', () => {
        const o = out1({ width: 1e5 });
        expect(Number.isFinite(o['rebar.RB9'])).toBe(true);
        expect(o.concrete).toBeCloseTo(0.432e5 / 1.2, 0);
    });
});

describe('stair — table size', () => {
    const many = (n: number): StairRow[] => Array.from({ length: n }, () => ({ ...S }));
    it('Excel sample (3 stairs): props 15, formwork 13.69193206, concrete 1.708652717', () => {
        const t = stairTotals(stair.defaults());
        expect(t.props).toBe(15);
        expect(t.formwork).toBeCloseTo(13.69193206, 6);
        expect(t.concrete).toBeCloseTo(1.708652717, 6);
    });
    it.each([1, 10, 11, 30])('%s identical stairs scale linearly (Excel rows 8–17 = 10; none dropped)', (n) => {
        const o = stair.compute({ rows: many(n) }, ctx);
        expect(o.props).toBe(3 * n);
        expect(o.formwork).toBeCloseTo(3.78 * n, 9);
        expect(o.concrete).toBeCloseTo(0.432 * n, 9);
        expect(o['rebar.RB9']).toBeCloseTo(32.3352 * n, 9);
    });
    it('delete a stair removes its share', () => {
        const all = stair.compute({ rows: [S, withS({ width: 2.4 }), withS({ width: 0.6 })] }, ctx);
        const rest = stair.compute({ rows: [S, withS({ width: 0.6 })] }, ctx);
        expect(diff(all, rest, 'props')).toBe(6);
        expect(diff(all, rest, 'concrete')).toBeCloseTo(0.864, 9);
    });
    it('newStairRow copies the four bar groups of the previous stair, never the sizes', () => {
        const prev = withS({ waistMainSize: 'DB12', waistMainSpacing: 0.2, stepTempSize: 'RB6' });
        expect(newStairRow(prev)).toEqual({
            name: '', width: 0, waist: 0, rise: 0, run: 0, steps: 0, riser: 0, tread: 0,
            waistMainSize: 'DB12', waistMainSpacing: 0.2, waistTempSize: 'RB9', waistTempSpacing: 0.15,
            stepMainSize: 'RB9', stepMainSpacing: 0.15, stepTempSize: 'RB6', stepTempSpacing: 0.15,
        });
        expect(newStairRow().waistMainSize).toBe('RB9');
        expect(stair.compute({ rows: [newStairRow(S)] }, ctx).concrete).toBe(0);
    });
});

describe('stair — withStepChange (journey helper keeps rise/run in step)', () => {
    const sample = withS({ rise: 0.45, run: 0.9, steps: 3, riser: 0.15, tread: 0.3 });
    it('steps 4 follows both: rise 0.6, run 1.2', () => {
        const r = withStepChange(sample, { steps: 4 });
        expect(r.rise).toBeCloseTo(0.6, 12);
        expect(r.run).toBeCloseTo(1.2, 12);
        expect(r.steps).toBe(4);
    });
    it('riser 0.2 changes only the rise (3 × 0.2); tread 0.25 only the run (3 × 0.25)', () => {
        const a = withStepChange(sample, { riser: 0.2 });
        expect(a.rise).toBeCloseTo(0.6, 12);
        expect(a.run).toBeCloseTo(0.9, 12);
        const b = withStepChange(sample, { tread: 0.25 });
        expect(b.rise).toBeCloseTo(0.45, 12);
        expect(b.run).toBeCloseTo(0.75, 12);
    });
    it('a rise typed by hand (not steps × riser) is left alone, the run still follows', () => {
        const r = withStepChange({ ...sample, rise: 0.5 }, { steps: 4 });
        expect(r.rise).toBe(0.5);
        expect(r.run).toBeCloseTo(1.2, 12);
    });
    it('both typed by hand: nothing is overwritten', () => {
        const r = withStepChange({ ...sample, rise: 0.5, run: 1 }, { steps: 5 });
        expect(r.rise).toBe(0.5);
        expect(r.run).toBe(1);
    });
    it('NaN steps behaves like 0 for the linked values, never NaN', () => {
        const r = withStepChange(sample, { steps: NaN });
        expect(Number.isFinite(r.rise)).toBe(true);
        expect(Number.isFinite(r.run)).toBe(true);
    });
});

describe('stair — rebar slot rows', () => {
    it('no bars: nothing; otherwise size order then tie wire', () => {
        expect(slotRows({ rows: [] })).toEqual([]);
        expect(slotRows({ rows: [S] }).map(x => x.key)).toEqual(['RB9', 'tie-wire']);
        const row = withS({ waistMainSize: 'DB16', waistTempSize: 'RB6', stepMainSize: 'DB12', stepTempSize: 'DB20' });
        expect(slotRows({ rows: [row] }).map(x => x.key)).toEqual(['RB6', 'DB12', 'DB16', 'DB20', 'tie-wire']);
    });
    it.each(SIZES)('BOQ row of %s: waste, 25 on gross, 15 on net, tie wire 3 %%', (size) => {
        const r = run([withS({ ...NO_BARS, waistMainSize: size })]);
        const kg = 21.6 * KG[size];
        const row = item(r, `stair:rebar:${size}`);
        expect(row.qty).toBeCloseTo(kg, 9);
        expect(row.grossQty).toBeCloseTo(kg * WASTE[size], 9);
        expect(row.matTotal).toBeCloseTo(25 * kg * WASTE[size], 9);
        expect(row.labTotal).toBeCloseTo(15 * kg, 9);
        expect(item(r, 'stair:rebar:tie-wire').grossQty).toBeCloseTo(0.03 * kg * WASTE[size], 9);
    });
});

describe('stair — BOQ money for S', () => {
    const r = run([S]);
    it('R140 props 3 × (150 + 50)', () => {
        expect(item(r, 'R140').total).toBeCloseTo(600, 9);
    });
    it('R142 formwork 3.78, R143 ไม้คร่าว 2.268, R144 ตะปู 0.945', () => {
        expect(item(r, 'R142').total).toBeCloseTo(3.78 * 400, 9);
        expect(item(r, 'R143').qty).toBeCloseTo(2.268, 9);
        expect(item(r, 'R143').total).toBeCloseTo(2.268 * 350, 9);
        expect(item(r, 'R144').total).toBeCloseTo(0.945 * 50, 9);
    });
    it('R145 concrete 0.432 → 0.4752 → 0.5 → MAX(1, 0.5) = 1', () => {
        expect(item(r, 'R145').grossQty).toBe(1);
        expect(item(r, 'R145').total).toBeCloseTo(2500 + 500 * 0.432, 9);
    });
    it('rebar RB9 32.3352 kg: gross × 1.09, tie wire 3 %', () => {
        expect(item(r, 'stair:rebar:RB9').grossQty).toBeCloseTo(32.3352 * 1.09, 9);
        expect(item(r, 'stair:rebar:tie-wire').grossQty).toBeCloseTo(0.03 * 32.3352 * 1.09, 9);
    });
    it('no stair: concrete is not forced to 1 m³', () => {
        expect(item(run([]), 'R145').grossQty).toBe(0);
    });
    it('level skipped: every line and the rebar rows are 0', () => {
        const s = run([S], { journey: { stair: 'skipped' }, boqOverrides: { R145: { qty: 2 } } });
        for (const l of stair.boqLinks) expect(item(s, l.line).qty, l.line).toBe(0);
        for (const k of ['R143', 'R144']) expect(item(s, k).qty, k).toBe(0);
        expect(hasItem(s, 'stair:rebar:RB9')).toBe(false);
        expect(Object.values(s.calcOutputs.stair ?? {}).every(v => v === 0)).toBe(true);
    });
});

describe('stair — required fields (REQUIRED_FIELDS decision table)', () => {
    const missing = (rows: StairRow[], patch: Partial<Project> = {}) =>
        missingRequirements('stair', { ...createProject('blank'), calculators: { 'stair': { rows: rows } }, ...patch });
    const keys = (rows: StairRow[]) => missing(rows).map(m => m.fieldKey ?? m.label);
    const REQUIRED = ['steps', 'width'] as const;

    it('a complete row meets every requirement', () => {
        expect(keys([S])).toEqual([]);
    });
    it('an empty table asks for nothing (the step is optional or has no "at least one")', () => {
        expect(keys([])).toEqual([]);
    });
    it.each(REQUIRED)('%s empty (0 / negative / NaN / Infinity) is reported once; a tiny positive value is accepted', (field) => {
        for (const v of [0, -1, NaN, Infinity]) {
            expect(keys([withS({ [field]: v })]), `${field}=${v}`).toEqual([field]);
        }
        expect(keys([withS({ [field]: 0.0001 })])).toEqual([]);
    });
    it('all required values empty on a started row are all reported, in the decision-table order', () => {
        const row = withS({ steps: 0, width: 0 });
        const started = withS({ ...row, riser: 0.15 });
        const got = keys([started]);
        expect(got.length).toBeGreaterThan(0);
        for (const k of got) expect(REQUIRED).toContain(k);
    });
    it('a row that only carries a copied standard value (nothing typed from the plan) is ignored', () => {
        expect(keys([withS({ width: 0, waist: 0, rise: 0, run: 0, steps: 0, riser: 0, tread: 0 })])).toEqual([]);
    });
    it('marked "ไม่มีในโครงการนี้" there is nothing to complete', () => {
        expect(missing([], { journey: { 'stair': 'skipped' } })).toEqual([]);
        expect(missing([withS({ steps: 0 })], { journey: { 'stair': 'skipped' } })).toEqual([]);
    });
    it('the second row is named by its position in the message', () => {
        const m = missing([S, withS({ steps: 0 })]);
        expect(m).toHaveLength(1);
        expect(m[0]?.itemIndex).toBe(1);
        expect(m[0]?.listKey).toBe('rows');
        expect(m[0]?.fieldKey).toBe('steps');
    });
});
