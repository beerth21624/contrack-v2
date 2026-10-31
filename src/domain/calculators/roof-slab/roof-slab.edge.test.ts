// QA edge tests for "พื้นดาดฟ้า_RoofSlab" (Excel v5 sheet 32). Expected values are hand-computed from the Excel
// formulas (docs/excel-spec/02-structure-steps-06-13.md §2.8) and the D1 notes in the source header.
import { describe, expect, it } from 'vitest';
import { missingRequirements } from '../../journey/requirements';
import { newRoofSlabRow, roofSlab, roofSlabRow, roofSlabTotals, ROOF_SLAB_BAR_SIZES, ROOF_SLAB_LAYERS, ROOF_SLAB_NAMES, type RoofSlabInput, type RoofSlabRow } from '.';
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
const run = (rows: RoofSlabRow[], patch: Partial<Project> = {}): ProjectResult =>
    computeProject({ ...createProject('blank'), calculators: { 'roof-slab': { rows } }, ...patch });
const slotRows = (input: RoofSlabInput) => roofSlab.boqSlots?.(input, ctx).rebar ?? [];

/** Excel row 8: 1.0 × 4.5, t 0.1, RB9 × 2 layers @0.2. */
const P1: RoofSlabRow = { name: 'S1', width: 1, length: 4.5, thickness: 0.1, size: 'RB9', layers: 2, spacing: 0.2 };
const withP = (patch: Partial<RoofSlabRow>): RoofSlabRow => ({ ...P1, ...patch });
const out1 = (patch: Partial<RoofSlabRow>) => roofSlab.compute({ rows: [withP(patch)] }, ctx);

/** Hand example W: 2 × 3 × 0.1, RB9 × 1 layer @0.25 (area 6). */
const W: RoofSlabRow = { name: 'S2', width: 2, length: 3, thickness: 0.1, size: 'RB9', layers: 1, spacing: 0.25 };

describe('roof-slab — blank()', () => {
    it('no panels; outputs finite; linked outputs and rebar 0; no slot rows', () => {
        const b = roofSlab.blank?.();
        expect(b).toEqual({ rows: [] });
        if (!b) return;
        const o = roofSlab.compute(b, ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const l of roofSlab.boqLinks) expect(o[l.output], l.output).toBe(0);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(roofSlab.boqSlots?.(b, ctx)).toEqual({ rebar: [] });
    });
    it('blank project: R129–R134 are 0', () => {
        const r = computeProject(createProject('blank'));
        for (const k of ['R129', 'R131', 'R132', 'R133', 'R134']) expect(item(r, k).qty, k).toBe(0);
        expect(hasItem(r, 'roof-slab:rebar:tie-wire')).toBe(false);
    });
});

describe('roof-slab — hand example W (every cell)', () => {
    const c = roofSlabRow(W);
    it('bars: 6 / 0.25 × 2 × 1 layer = 48 m = 23.952 kg (no rounding)', () => {
        expect(c.barLength).toBeCloseTo(48, 12);
        expect(c.kg).toBeCloseTo(23.952, 9);
    });
    it('props ROUNDUP(6 / 0.6) = 10, formwork = area 6, concrete 0.6', () => {
        expect(c.props).toBe(10);
        expect(c.formwork).toBeCloseTo(6, 12);
        expect(c.concrete).toBeCloseTo(0.6, 12);
    });
});

describe('roof-slab — each input changed alone from Excel row 8 (1 × 4.5, area 4.5)', () => {
    it('baseline', () => {
        const o = out1({});
        expect(o['rebar.RB9']).toBeCloseTo(90 * 0.499, 9);   // 4.5/0.2 × 2 × 2 = 90 m
        expect(o.props).toBe(8);                             // ROUNDUP(7.5)
        expect(o.formwork).toBeCloseTo(4.5, 9);
        expect(o.concrete).toBeCloseTo(0.45, 9);
    });
    it('width 2 (area 9): 180 m bars, 15 props', () => {
        const o = out1({ width: 2 });
        expect(o['rebar.RB9']).toBeCloseTo(180 * 0.499, 9);
        expect(o.props).toBe(15);
        expect(o.formwork).toBeCloseTo(9, 9);
        expect(o.concrete).toBeCloseTo(0.9, 9);
    });
    it('length 6 (area 6): 120 m bars, 10 props', () => {
        const o = out1({ length: 6 });
        expect(o['rebar.RB9']).toBeCloseTo(120 * 0.499, 9);
        expect(o.props).toBe(10);
        expect(o.concrete).toBeCloseTo(0.6, 9);
    });
    it('thickness 0.15 moves only the concrete', () => {
        const o = out1({ thickness: 0.15 });
        expect(o.concrete).toBeCloseTo(0.675, 9);
        expect(o.formwork).toBeCloseTo(4.5, 9);
        expect(o['rebar.RB9']).toBeCloseTo(90 * 0.499, 9);
    });
    it.each([[0, 0], [1, 45], [2, 90], [3, 135], [1.5, 67.5]])('layers %s gives %s m of bar', (layers, len) => {
        expect(roofSlabRow(withP({ layers })).barLength).toBeCloseTo(len, 9);
        expect(out1({ layers })['rebar.RB9']).toBeCloseTo(len * 0.499, 9);
    });
    it.each([[0.1, 180], [0.15, 120], [0.2, 90], [0.25, 72], [0.3, 60], [0.5, 36], [4.5, 4]])('spacing %s gives %s m of bar', (spacing, len) => {
        expect(roofSlabRow(withP({ spacing })).barLength).toBeCloseTo(len, 9);
    });
    it.each([0, -0.2, NaN])('spacing %s: 0 bars (Excel IFERROR → "0")', (spacing) => {
        const c = roofSlabRow(withP({ spacing }));
        expect(c.barLength).toBe(0);
        expect(c.kg).toBe(0);
    });
});

describe('roof-slab — ROUNDUP boundaries of props = ROUNDUP(area / 0.6)', () => {
    it.each([
        // width × 1 m length = area
        [0.6, 1], [1.2, 2], [1.8, 3], [3, 5], [3.6, 6], [4.2, 7], [0.61, 2], [0.0001, 1], [0, 0], [6, 10], [6.01, 11], [9, 15], [0.3, 1], [59.4, 99],
    ])('area %s m² needs %s props', (area, props) => {
        expect(roofSlabRow(withP({ width: area, length: 1 })).props).toBe(props);
    });
    it('props are rounded per panel, then added: two 0.7 m² panels need 2 + 2 = 4', () => {
        const rows = [withP({ width: 0.7, length: 1 }), withP({ width: 0.7, length: 1 })];
        expect(roofSlab.compute({ rows }, ctx).props).toBe(4);
    });
    it('props use the area, not the width or length alone (Excel oddity 5, kept)', () => {
        expect(roofSlabRow(withP({ width: 3, length: 3.5 })).props).toBe(18);   // 10.5 / 0.6 = 17.5
    });
});

describe('roof-slab — every bar size option', () => {
    it('dropdowns (Excel leaves DB20 out of the size list)', () => {
        expect([...ROOF_SLAB_BAR_SIZES]).toEqual(['RB6', 'RB9', 'DB12', 'DB16']);
        expect([...ROOF_SLAB_LAYERS]).toEqual([1, 2]);
        expect([...ROOF_SLAB_NAMES]).toEqual(['S1', 'S2']);
    });
    it.each(SIZES)('size %s: 90 m × kg/m only in its own total', (size) => {
        const o = out1({ size });
        expect(o[`rebar.${size}`]).toBeCloseTo(90 * KG[size], 9);
        for (const other of SIZES.filter(s => s !== size)) expect(o[`rebar.${other}`], other).toBe(0);
    });
    it.each(['', 'DB25', 'rb9'])('unknown size "%s": 0 kg, no slot row, concrete kept', (size) => {
        const input = { rows: [withP({ size })] };
        const o = roofSlab.compute(input, ctx);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(slotRows(input)).toEqual([]);
        expect(o.concrete).toBeCloseTo(0.45, 9);
    });
});

describe('roof-slab — zero, negative, decimal and huge values', () => {
    const FIELDS = ['width', 'length', 'thickness', 'layers', 'spacing'] as const;
    it.each(FIELDS)('%s = 0 / -1 / NaN / Infinity / 1e9 / 0.0001 never gives NaN or Infinity', (field) => {
        for (const v of [0, -1, NaN, Infinity, -Infinity, 1e9, 0.0001, 2.5]) {
            for (const [k, x] of Object.entries(out1({ [field]: v }))) expect(Number.isFinite(x), `${field}=${v} ${k}`).toBe(true);
        }
    });
    it('width 0 or length 0: no area quantities', () => {
        for (const patch of [{ width: 0 }, { length: 0 }]) {
            const o = out1(patch);
            for (const k of ['props', 'formwork', 'concrete', 'rebar.RB9']) expect(o[k], k).toBe(0);
        }
    });
    it('NaN behaves like 0', () => {
        expect(out1({ width: NaN })).toEqual(out1({ width: 0 }));
    });
    it('1000 × 1000 m: finite, props ROUNDUP(1e6/0.6) = 1666667', () => {
        const o = out1({ width: 1000, length: 1000 });
        expect(o.formwork).toBeCloseTo(1e6, 3);
        expect(o.props).toBe(1666667);
    });
});

describe('roof-slab — table size (D1: every row counts, Excel M6/N6 stop at row 17)', () => {
    const many = (n: number): RoofSlabRow[] => Array.from({ length: n }, () => ({ ...P1 }));
    it('Excel sample (4 panels): props 42, formwork 24, concrete 2.4', () => {
        const t = roofSlabTotals(roofSlab.defaults());
        expect(t.props).toBe(8 + 18 + 8 + 8);   // ROUNDUP(4.5/0.6=7.5), ROUNDUP(10.5/0.6=17.5), 2 × ROUNDUP(7.5)
        expect(t.formwork).toBeCloseTo(24, 9);
        expect(t.concrete).toBeCloseTo(2.4, 9);
    });
    it.each([1, 10, 17, 18, 40])('%s identical panels scale linearly (Excel rows 8–24 = 17; none dropped)', (n) => {
        const o = roofSlab.compute({ rows: many(n) }, ctx);
        expect(o.props).toBe(8 * n);
        expect(o.formwork).toBeCloseTo(4.5 * n, 9);
        expect(o.concrete).toBeCloseTo(0.45 * n, 9);
        expect(o['rebar.RB9']).toBeCloseTo(44.91 * n, 9);
    });
    it('P1 + W: sums', () => {
        const o = roofSlab.compute({ rows: [P1, W] }, ctx);
        expect(o['rebar.RB9']).toBeCloseTo(44.91 + 23.952, 9);
        expect(o.props).toBe(18);
        expect(o.formwork).toBeCloseTo(10.5, 9);
        expect(o.concrete).toBeCloseTo(1.05, 9);
    });
    it('delete a panel removes its share', () => {
        const all = roofSlab.compute({ rows: [P1, W, withP({ width: 1, length: 1 })] }, ctx);
        const rest = roofSlab.compute({ rows: [P1, withP({ width: 1, length: 1 })] }, ctx);
        expect(diff(all, rest, 'props')).toBe(10);
        expect(diff(all, rest, 'concrete')).toBeCloseTo(0.6, 9);
    });
    it('newRoofSlabRow copies the spec, never the size', () => {
        expect(newRoofSlabRow()).toEqual({ name: 'S1', width: 0, length: 0, thickness: 0, size: 'RB9', layers: 2, spacing: 0.2 });
        expect(newRoofSlabRow(W)).toEqual({ ...W, width: 0, length: 0 });
        expect(roofSlab.compute({ rows: [newRoofSlabRow(W)] }, ctx).concrete).toBe(0);
    });
});

describe('roof-slab — rebar slot rows', () => {
    it('no bars: nothing; otherwise size order then tie wire', () => {
        expect(slotRows({ rows: [] })).toEqual([]);
        expect(slotRows({ rows: [withP({ layers: 0 })] })).toEqual([]);
        const rows = ['DB16', 'RB6', 'DB12'].map(size => withP({ size }));
        expect(slotRows({ rows }).map(x => x.key)).toEqual(['RB6', 'DB12', 'DB16', 'tie-wire']);
    });
    it.each(SIZES)('BOQ row of %s: waste, 25 on gross, 15 on net, tie wire 3 %%', (size) => {
        const r = run([withP({ size })]);
        const kg = 90 * KG[size];
        const row = item(r, `roof-slab:rebar:${size}`);
        expect(row.qty).toBeCloseTo(kg, 9);
        expect(row.grossQty).toBeCloseTo(kg * WASTE[size], 9);
        expect(row.matTotal).toBeCloseTo(25 * kg * WASTE[size], 9);
        expect(row.labTotal).toBeCloseTo(15 * kg, 9);
        expect(item(r, 'roof-slab:rebar:tie-wire').grossQty).toBeCloseTo(0.03 * kg * WASTE[size], 9);
    });
});

describe('roof-slab — BOQ money for W', () => {
    const r = run([W]);
    it('R129 props 10 × (150 + 50)', () => {
        expect(item(r, 'R129').total).toBeCloseTo(2000, 9);
    });
    it('R131 formwork 6, R132 ไม้คร่าว 3.6, R133 ตะปู 1.5', () => {
        expect(item(r, 'R131').total).toBeCloseTo(2400, 9);
        expect(item(r, 'R132').qty).toBeCloseTo(3.6, 9);
        expect(item(r, 'R132').total).toBeCloseTo(1260, 9);
        expect(item(r, 'R133').total).toBeCloseTo(75, 9);
    });
    it('R134 concrete 0.6 → 0.66 → CEILING 0.25 = 0.75 → MAX(1, 0.75) = 1', () => {
        expect(item(r, 'R134').grossQty).toBe(1);
        expect(item(r, 'R134').total).toBeCloseTo(2500 + 500 * 0.6, 9);
    });
    it.each([[0.9, 1], [0.91, 1.25], [5, 5.5], [10, 11]])('concrete %s m³ is ordered as %s m³', (c, ordered) => {
        const x = run([withP({ width: 1, length: c, thickness: 1 })]);
        expect(item(x, 'R134').grossQty).toBeCloseTo(ordered, 9);
    });
    it('no slab: concrete not forced to 1 m³', () => {
        expect(item(run([]), 'R134').grossQty).toBe(0);
    });
    it('level skipped: every line and the rebar rows are 0', () => {
        const s = run([W], { journey: { 'roof-slab': 'skipped' }, boqOverrides: { R131: { qty: 9 } } });
        for (const l of roofSlab.boqLinks) expect(item(s, l.line).qty, l.line).toBe(0);
        for (const k of ['R132', 'R133']) expect(item(s, k).qty, k).toBe(0);
        expect(hasItem(s, 'roof-slab:rebar:RB9')).toBe(false);
        expect(Object.values(s.calcOutputs['roof-slab'] ?? {}).every(v => v === 0)).toBe(true);
    });
});

describe('roof-slab — required fields (REQUIRED_FIELDS decision table)', () => {
    const missing = (rows: RoofSlabRow[], patch: Partial<Project> = {}) =>
        missingRequirements('roof-slab', { ...createProject('blank'), calculators: { 'roof-slab': { rows: rows } }, ...patch });
    const keys = (rows: RoofSlabRow[]) => missing(rows).map(m => m.fieldKey ?? m.label);
    const REQUIRED = ['width', 'length', 'thickness'] as const;

    it('a complete row meets every requirement', () => {
        expect(keys([P1])).toEqual([]);
    });
    it('an empty table asks for nothing (the step is optional or has no "at least one")', () => {
        expect(keys([])).toEqual([]);
    });
    it.each(REQUIRED)('%s empty (0 / negative / NaN / Infinity) is reported once; a tiny positive value is accepted', (field) => {
        for (const v of [0, -1, NaN, Infinity]) {
            expect(keys([withP({ [field]: v })]), `${field}=${v}`).toEqual([field]);
        }
        expect(keys([withP({ [field]: 0.0001 })])).toEqual([]);
    });
    it('all required values empty on a started row are all reported, in the decision-table order', () => {
        const row = withP({ width: 0, length: 0, thickness: 0 });
        const started = withP({ ...row, width: 1 });
        const got = keys([started]);
        expect(got.length).toBeGreaterThan(0);
        for (const k of got) expect(REQUIRED).toContain(k);
    });
    it('a row that only carries a copied standard value (nothing typed from the plan) is ignored', () => {
        expect(keys([withP({ width: 0, length: 0 })])).toEqual([]);
    });
    it('marked "ไม่มีในโครงการนี้" there is nothing to complete', () => {
        expect(missing([], { journey: { 'roof-slab': 'skipped' } })).toEqual([]);
        expect(missing([withP({ width: 0 })], { journey: { 'roof-slab': 'skipped' } })).toEqual([]);
    });
    it('the second row is named by its position in the message', () => {
        const m = missing([P1, withP({ width: 0 })]);
        expect(m).toHaveLength(1);
        expect(m[0]?.itemIndex).toBe(1);
        expect(m[0]?.listKey).toBe('rows');
        expect(m[0]?.fieldKey).toBe('width');
    });
});
