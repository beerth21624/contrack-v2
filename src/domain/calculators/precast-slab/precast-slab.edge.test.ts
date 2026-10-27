// QA edge tests for " พื้นสำเร็จรูป_PS" (Excel v5 sheet 29). Expected values are hand-computed from the Excel formulas
// (docs/excel-spec/02-structure-steps-06-13.md §2.5), never by calling the code under test.
import { describe, expect, it } from 'vitest';
import { missingRequirements } from '../../journey/requirements';
import { newPrecastPanel, precastPanel, precastSlab, precastSlabTotals, PS_BAR_SIZES, type PrecastPanelRow, type PrecastSlabInput } from '.';
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
const run = (panels: PrecastPanelRow[], patch: Partial<Project> = {}): ProjectResult =>
    computeProject({ ...createProject('blank'), calculators: { 'precast-slab': { panels } }, ...patch });
const slotRows = (input: PrecastSlabInput) => precastSlab.boqSlots?.(input, ctx)['shear-key'] ?? [];

/** Q: 3 × 3 m span, RB6 shear key @0.35 with 0.8 m bars, topping 0.05. */
const Q: PrecastPanelRow = { width: 3, length: 3, keySize: 'RB6', keySpacing: 0.35, keyBarLength: 0.8, topping: 0.05 };
const withQ = (patch: Partial<PrecastPanelRow>): PrecastPanelRow => ({ ...Q, ...patch });
const out1 = (patch: Partial<PrecastPanelRow>) => precastSlab.compute({ panels: [withQ(patch)] }, ctx);

describe('precast-slab — blank()', () => {
    it('no panels; outputs finite; linked outputs and shear key 0; no slot rows', () => {
        const b = precastSlab.blank?.();
        expect(b).toEqual({ panels: [] });
        if (!b) return;
        const o = precastSlab.compute(b, ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const l of precastSlab.boqLinks) expect(o[l.output], l.output).toBe(0);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(precastSlab.boqSlots?.(b, ctx)).toEqual({ 'shear-key': [] });
    });
    it('blank project: R97–R104 are 0', () => {
        const r = computeProject(createProject('blank'));
        for (const k of ['R97', 'R98', 'R99', 'R101', 'R102', 'R103', 'R104']) expect(item(r, k).qty, k).toBe(0);
        expect(hasItem(r, 'precast-slab:shear-key:RB6')).toBe(false);
    });
});

describe('precast-slab — hand example Q (every cell)', () => {
    const c = precastPanel(Q);
    it('areas', () => {
        expect(c.area).toBeCloseTo(9, 12);
        expect(c.wiremesh).toBeCloseTo(9, 12);
    });
    it('shear key: ROUNDUP(2 × 3 / 0.35) = ROUNDUP(17.14) = 18 bars × 0.8 m = 14.4 m = 3.1968 kg', () => {
        expect(c.keyCount).toBe(18);
        expect(c.keyTotalLength).toBeCloseTo(14.4, 12);
        expect(c.keyWeight).toBeCloseTo(3.1968, 9);
    });
    it('edge form = perimeter 12 × topping 0.05 = 0.6; topping concrete 9 × 0.05 = 0.45', () => {
        expect(c.perimeter).toBeCloseTo(12, 12);
        expect(c.formwork).toBeCloseTo(0.6, 12);
        expect(c.concrete).toBeCloseTo(0.45, 12);
    });
});

describe('precast-slab — each input changed alone from Q', () => {
    it('width 3.5: area 10.5, 7/0.35 = 20 bars, perimeter 13', () => {
        const o = out1({ width: 3.5 });
        expect(o.area).toBeCloseTo(10.5, 9);
        expect(o.wiremesh).toBeCloseTo(10.5, 9);
        expect(o['rebar.RB6']).toBeCloseTo(20 * 0.8 * 0.222, 9);   // 3.552
        expect(o.formwork).toBeCloseTo(0.65, 9);
        expect(o.concrete).toBeCloseTo(0.525, 9);
    });
    it('length 4: bars unchanged (they depend on the width), perimeter 14', () => {
        const o = out1({ length: 4 });
        expect(o.area).toBeCloseTo(12, 9);
        expect(o['rebar.RB6']).toBeCloseTo(3.1968, 9);
        expect(o.formwork).toBeCloseTo(0.7, 9);
        expect(o.concrete).toBeCloseTo(0.6, 9);
    });
    it('shear-key bar length 1.2: 18 × 1.2 = 21.6 m', () => {
        expect(out1({ keyBarLength: 1.2 })['rebar.RB6']).toBeCloseTo(21.6 * 0.222, 9);
        expect(out1({ keyBarLength: 0 })['rebar.RB6']).toBe(0);
    });
    it('topping 0.1 doubles form and concrete, not area or bars', () => {
        const o = out1({ topping: 0.1 });
        expect(o.formwork).toBeCloseTo(1.2, 9);
        expect(o.concrete).toBeCloseTo(0.9, 9);
        expect(o.area).toBeCloseTo(9, 9);
        expect(o['rebar.RB6']).toBeCloseTo(3.1968, 9);
    });
    it.each([
        [0.3, 20], [0.35, 18], [0.4, 15], [0.5, 12], [0.6, 10], [0.7, 9], [1, 6], [6, 1], [7, 1], [0.1, 60],
    ])('shear-key spacing %s gives %s bars', (spacing, count) => {
        expect(precastPanel(withQ({ keySpacing: spacing })).keyCount).toBe(count);
        expect(out1({ keySpacing: spacing })['rebar.RB6']).toBeCloseTo(count * 0.8 * 0.222, 9);
    });
    it.each([0, NaN])('spacing %s: Excel "_" → no bars, 0 kg', (spacing) => {
        const c = precastPanel(withQ({ keySpacing: spacing }));
        expect(c.keyCount).toBeNull();
        expect(c.keyTotalLength).toBeNull();
        expect(c.keyWeight).toBe(0);
    });
});

describe('precast-slab — ROUNDUP boundaries of ROUNDUP(2 × width / spacing)', () => {
    it.each([
        [1.75, 0.35, 10],      // 3.5/0.35 = 10.000000000000002 in IEEE → 10, not 11
        [0.35, 0.35, 2],
        [3.5, 0.35, 20],
        [3.51, 0.35, 21],
        [3.49, 0.35, 20],
        [3, 0.5, 12],
        [3, 0.6, 10],          // 6/0.6 = 10.000000000000002? → 10
        [3, 0.7, 9],           // 8.57
        [2, 1.2, 4],           // 3.33
        [1.2, 0.4, 6],         // 6.000000000000001
        [0.9, 0.3, 6],
        [0, 0.35, 0],
        [0.01, 0.35, 1],
        [0.175, 0.35, 1],      // exactly 1
        [0.1751, 0.35, 2],
    ])('width %s over spacing %s → %s bars', (width, sp, n) => {
        expect(precastPanel(withQ({ width, keySpacing: sp })).keyCount).toBe(n);
    });
});

describe('precast-slab — every bar size option', () => {
    it('dropdown offers the five sizes', () => {
        expect([...PS_BAR_SIZES]).toEqual([...SIZES]);
    });
    it.each(SIZES)('size %s: 14.4 m × kg/m', (size) => {
        const o = out1({ keySize: size });
        expect(o[`rebar.${size}`]).toBeCloseTo(14.4 * KG[size], 9);
        for (const other of SIZES.filter(s => s !== size)) expect(o[`rebar.${other}`], other).toBe(0);
    });
    it.each(['', 'DB25', 'rb6'])('unknown size "%s": weight 0, no slot row, area still counted', (size) => {
        const input = { panels: [withQ({ keySize: size })] };
        const o = precastSlab.compute(input, ctx);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(o.area).toBeCloseTo(9, 9);
        expect(slotRows(input)).toEqual([]);
    });
});

describe('precast-slab — zero, negative, decimal and huge values', () => {
    const FIELDS = ['width', 'length', 'keySpacing', 'keyBarLength', 'topping'] as const;
    it.each(FIELDS)('%s = 0 / -1 / NaN / Infinity / 1e9 / 0.0001 never gives NaN or Infinity', (field) => {
        for (const v of [0, -1, NaN, Infinity, -Infinity, 1e9, 0.0001, 1.7]) {
            for (const [k, x] of Object.entries(out1({ [field]: v }))) expect(Number.isFinite(x), `${field}=${v} ${k}`).toBe(true);
        }
    });
    it('width 0: no area, no bars; length 0 keeps the shear key but no area', () => {
        const o = out1({ width: 0 });
        expect(o.area).toBe(0);
        expect(o['rebar.RB6']).toBe(0);
        const p = out1({ length: 0 });
        expect(p.area).toBe(0);
        expect(p['rebar.RB6']).toBeCloseTo(3.1968, 9);
        expect(p.formwork).toBeCloseTo(6 * 0.05, 9);   // perimeter 2 × (3 + 0)
    });
    it('NaN behaves like 0', () => {
        expect(out1({ length: NaN })).toEqual(out1({ length: 0 }));
    });
    it('1000 × 1000 m: finite and exact', () => {
        const o = out1({ width: 1000, length: 1000 });
        expect(o.area).toBeCloseTo(1e6, 3);
        expect(o.concrete).toBeCloseTo(5e4, 3);
    });
});

describe('precast-slab — table size', () => {
    const many = (n: number): PrecastPanelRow[] => Array.from({ length: n }, () => ({ ...Q }));
    it('Excel sample: 9 spans = 74.75 m², formwork 5.14, concrete 3.7375', () => {
        const t = precastSlabTotals(precastSlab.defaults());
        expect(t.area).toBeCloseTo(74.75, 9);
        expect(t.wiremesh).toBeCloseTo(74.75, 9);
        expect(t.formwork).toBeCloseTo(5.14, 9);
        expect(t.concrete).toBeCloseTo(3.7375, 9);
    });
    it.each([1, 9, 17, 18, 40])('%s identical spans scale linearly (Excel rows 8–24 = 17; none dropped past it)', (n) => {
        const o = precastSlab.compute({ panels: many(n) }, ctx);
        expect(o.area).toBeCloseTo(9 * n, 9);
        expect(o.formwork).toBeCloseTo(0.6 * n, 9);
        expect(o.concrete).toBeCloseTo(0.45 * n, 9);
        expect(o['rebar.RB6']).toBeCloseTo(3.1968 * n, 9);
    });
    it('delete a span removes its share', () => {
        const panels = [Q, withQ({ width: 2, length: 1.2 }), withQ({ width: 3, length: 4 })];
        const all = precastSlab.compute({ panels }, ctx);
        const rest = precastSlab.compute({ panels: [panels[0] ?? Q, panels[2] ?? Q] }, ctx);
        expect(diff(all, rest, 'area')).toBeCloseTo(2.4, 9);
        expect(diff(all, rest, 'rebar.RB6')).toBeCloseTo(12 * 0.8 * 0.222, 9);   // ROUNDUP(4/0.35 = 11.43) = 12
    });
    it('newPrecastPanel copies the previous key/topping but not the size', () => {
        expect(newPrecastPanel(withQ({ keySize: 'DB12', topping: 0.07 }))).toEqual(withQ({ keySize: 'DB12', topping: 0.07, width: 0, length: 0 }));
        expect(newPrecastPanel()).toEqual({ width: 0, length: 0, keySize: 'RB6', keySpacing: 0.35, keyBarLength: 0.8, topping: 0.05 });
    });
});

describe('precast-slab — shear-key slot rows (section 8, no tie wire)', () => {
    it('only the bar sizes in use, in size order, never a tie-wire row', () => {
        expect(slotRows({ panels: [] })).toEqual([]);
        expect(slotRows({ panels: [Q] }).map(x => x.key)).toEqual(['RB6']);
        const panels = [withQ({ keySize: 'DB16' }), withQ({ keySize: 'RB9' }), withQ({ keySize: 'RB6' })];
        expect(slotRows({ panels }).map(x => x.key)).toEqual(['RB6', 'RB9', 'DB16']);
    });
    it.each(SIZES)('BOQ row of %s: waste, 25 on gross, 15 on net', (size) => {
        const r = run([withQ({ keySize: size })]);
        const kg = 14.4 * KG[size];
        const row = item(r, `precast-slab:shear-key:${size}`);
        expect(row.qty).toBeCloseTo(kg, 9);
        expect(row.grossQty).toBeCloseTo(kg * WASTE[size], 9);
        expect(row.matTotal).toBeCloseTo(25 * kg * WASTE[size], 9);
        expect(row.labTotal).toBeCloseTo(15 * kg, 9);
        expect(hasItem(r, 'precast-slab:shear-key:tie-wire')).toBe(false);
    });
});

describe('precast-slab — BOQ money for Q', () => {
    const r = run([Q]);
    it('R97 slab 9 m² × (300 + 60); R98 ไม้ค้ำยัน 0.1 × area', () => {
        expect(item(r, 'R97').total).toBeCloseTo(3240, 9);
        expect(item(r, 'R98').qty).toBeCloseTo(0.9, 9);
        expect(item(r, 'R98').total).toBeCloseTo(0.9 * 350, 9);
    });
    it('R99 wire mesh 9: gross × 1.1 = 9.9 → 40 × 9.9 + 30 × 9', () => {
        expect(item(r, 'R99').grossQty).toBeCloseTo(9.9, 9);
        expect(item(r, 'R99').total).toBeCloseTo(396 + 270, 9);
    });
    it('R101 formwork 0.6 and derived R102 / R103', () => {
        expect(item(r, 'R101').total).toBeCloseTo(0.6 * 400, 9);
        expect(item(r, 'R102').qty).toBeCloseTo(0.36, 9);
        expect(item(r, 'R103').qty).toBeCloseTo(0.15, 9);
    });
    it('R104 concrete 0.45 → 0.495 → 0.5 → MAX(1, 0.5) = 1', () => {
        expect(item(r, 'R104').grossQty).toBe(1);
        expect(item(r, 'R104').total).toBeCloseTo(2500 + 500 * 0.45, 9);
    });
    it('R104 rounding boundary: concrete 5 m³ → 5.5 (not 5.75); 0.91 m³ → 1.25', () => {
        expect(item(run([withQ({ width: 10, length: 10, topping: 0.05 })]), 'R104').grossQty).toBeCloseTo(5.5, 9);
        expect(item(run([withQ({ width: 10, length: 9.1, topping: 0.01 })]), 'R104').grossQty).toBeCloseTo(1.25, 9);
        expect(item(run([withQ({ width: 10, length: 9.1, topping: 0.01 })]), 'R104').qty).toBeCloseTo(0.91, 9);
    });
    it('no span: nothing is ordered (concrete not forced to 1 m³)', () => {
        expect(item(run([]), 'R104').grossQty).toBe(0);
    });
    it('level skipped: every linked line, derived lines and shear-key rows are 0, price edits survive', () => {
        const s = run([Q], { journey: { 'precast-slab': 'skipped' }, boqOverrides: { R97: { qty: 99, mat: 111 } } });
        for (const l of precastSlab.boqLinks) expect(item(s, l.line).qty, l.line).toBe(0);
        for (const k of ['R98', 'R102', 'R103']) expect(item(s, k).qty, k).toBe(0);
        expect(item(s, 'R97').matUnit).toBe(111);
        expect(hasItem(s, 'precast-slab:shear-key:RB6')).toBe(false);
        expect(Object.values(s.calcOutputs['precast-slab'] ?? {}).every(v => v === 0)).toBe(true);
    });
});

describe('precast-slab — required fields (REQUIRED_FIELDS decision table)', () => {
    const missing = (rows: PrecastPanelRow[], patch: Partial<Project> = {}) =>
        missingRequirements('precast-slab', { ...createProject('blank'), calculators: { 'precast-slab': { panels: rows } }, ...patch });
    const keys = (rows: PrecastPanelRow[]) => missing(rows).map(m => m.fieldKey ?? m.label);
    const REQUIRED = ['width', 'length'] as const;

    it('a complete row meets every requirement', () => {
        expect(keys([Q])).toEqual([]);
    });
    it('an empty table asks for nothing (the step is optional or has no "at least one")', () => {
        expect(keys([])).toEqual([]);
    });
    it.each(REQUIRED)('%s empty (0 / negative / NaN / Infinity) is reported once; a tiny positive value is accepted', (field) => {
        for (const v of [0, -1, NaN, Infinity]) {
            expect(keys([withQ({ [field]: v })]), `${field}=${v}`).toEqual([field]);
        }
        expect(keys([withQ({ [field]: 0.0001 })])).toEqual([]);
    });
    it('all required values empty on a started row are all reported, in the decision-table order', () => {
        const row = withQ({ width: 0, length: 0 });
        const started = withQ({ ...row, width: 1 });
        const got = keys([started]);
        expect(got.length).toBeGreaterThan(0);
        for (const k of got) expect(REQUIRED).toContain(k);
    });
    it('a row that only carries a copied standard value (nothing typed from the plan) is ignored', () => {
        expect(keys([withQ({ width: 0, length: 0 })])).toEqual([]);
    });
    it('marked "ไม่มีในโครงการนี้" there is nothing to complete', () => {
        expect(missing([], { journey: { 'precast-slab': 'skipped' } })).toEqual([]);
        expect(missing([withQ({ width: 0 })], { journey: { 'precast-slab': 'skipped' } })).toEqual([]);
    });
    it('the second row is named by its position in the message', () => {
        const m = missing([Q, withQ({ width: 0 })]);
        expect(m).toHaveLength(1);
        expect(m[0]?.itemIndex).toBe(1);
        expect(m[0]?.listKey).toBe('panels');
        expect(m[0]?.fieldKey).toBe('width');
    });
});
