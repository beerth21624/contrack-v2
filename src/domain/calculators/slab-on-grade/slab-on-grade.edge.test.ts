// QA edge tests for "พื้นหล่อในที่_S" (Excel v5 sheet 28). Expected values are hand-computed from the Excel formulas
// (docs/excel-spec/02-structure-steps-06-13.md §2.4), never by calling the code under test.
import { describe, expect, it } from 'vitest';
import { missingRequirements } from '../../journey/requirements';
import { computeSlabOnGrade, newSlabRow, slabOnGrade, slabRowCalc, SLAB_BAR_SIZES, SLAB_LAYERS, SLAB_NAMES, type SlabOnGradeInput, type SlabRow } from '.';
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
const run = (slabs: SlabRow[], patch: Partial<Project> = {}): ProjectResult =>
    computeProject({ ...createProject('blank'), calculators: { 'slab-on-grade': { slabs } }, ...patch });
const slotRows = (input: SlabOnGradeInput) => slabOnGrade.boqSlots?.(input, ctx).rebar ?? [];

/** T: 3 × 4 × 0.10, fill 0.4, sand 0.05, RB9 × 2 layers @0.2 (area 12 m²). */
const T: SlabRow = { name: 'S1', width: 3, length: 4, thickness: 0.1, fillDepth: 0.4, sandThickness: 0.05, barSize: 'RB9', layers: 2, spacing: 0.2 };
const withT = (patch: Partial<SlabRow>): SlabRow => ({ ...T, ...patch });
const out1 = (patch: Partial<SlabRow>) => slabOnGrade.compute({ slabs: [withT(patch)] }, ctx);

describe('slab-on-grade — blank()', () => {
    it('no panels; every output finite; linked outputs and rebar 0; no slot rows', () => {
        const b = slabOnGrade.blank?.();
        expect(b).toEqual({ slabs: [] });
        if (!b) return;
        const o = slabOnGrade.compute(b, ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const l of slabOnGrade.boqLinks) expect(o[l.output], l.output).toBe(0);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(slabOnGrade.boqSlots?.(b, ctx)).toEqual({ rebar: [] });
    });
    it('blank project: R88–R94 are 0', () => {
        const r = computeProject(createProject('blank'));
        for (const k of ['R88', 'R89', 'R90', 'R94']) expect(item(r, k).qty, k).toBe(0);
        expect(hasItem(r, 'slab-on-grade:rebar:tie-wire')).toBe(false);
    });
});

describe('slab-on-grade — hand example T (every cell of one row)', () => {
    const c = slabRowCalc(T);
    it('volumes and areas', () => {
        expect(c.backfill).toBeCloseTo(4.8, 12);     // 12 × 0.4
        expect(c.sand).toBeCloseTo(0.75, 12);        // 12 × 0.05 × 1.25
        expect(c.plastic).toBeCloseTo(12, 12);
        expect(c.concrete).toBeCloseTo(1.2, 12);
    });
    it('bars: 12 / 0.2 × 2 directions × 2 layers = 240 m = 119.76 kg (no rounding up)', () => {
        expect(c.barLength).toBeCloseTo(240, 9);
        expect(c.weight).toBeCloseTo(119.76, 9);
    });
});

describe('slab-on-grade — each input changed alone from T', () => {
    it('width 4 (area 16)', () => {
        const o = out1({ width: 4 });
        expect(o.backfill).toBeCloseTo(6.4, 9);
        expect(o.sand).toBeCloseTo(1, 9);
        expect(o.plastic).toBeCloseTo(16, 9);
        expect(o.concrete).toBeCloseTo(1.6, 9);
        expect(o['rebar.RB9']).toBeCloseTo(320 * 0.499, 9);
    });
    it('length 5 (area 15)', () => {
        const o = out1({ length: 5 });
        expect(o.backfill).toBeCloseTo(6, 9);
        expect(o.sand).toBeCloseTo(0.9375, 9);
        expect(o.plastic).toBeCloseTo(15, 9);
        expect(o.concrete).toBeCloseTo(1.5, 9);
        expect(o['rebar.RB9']).toBeCloseTo(300 * 0.499, 9);
    });
    it('thickness 0.15 moves only the concrete', () => {
        const o = out1({ thickness: 0.15 });
        expect(o.concrete).toBeCloseTo(1.8, 9);
        expect(o.backfill).toBeCloseTo(4.8, 9);
        expect(o['rebar.RB9']).toBeCloseTo(119.76, 9);
    });
    it('fill depth 0.6 moves only the backfill; sand 0.1 only the sand', () => {
        expect(out1({ fillDepth: 0.6 }).backfill).toBeCloseTo(7.2, 9);
        expect(out1({ fillDepth: 0.6 }).sand).toBeCloseTo(0.75, 9);
        expect(out1({ sandThickness: 0.1 }).sand).toBeCloseTo(1.5, 9);
        expect(out1({ sandThickness: 0.1 }).backfill).toBeCloseTo(4.8, 9);
    });
    it.each([[0, 0], [1, 59.88], [2, 119.76], [3, 179.64], [1.5, 89.82]])('layers %s gives %s kg of RB9', (layers, kg) => {
        expect(out1({ layers })['rebar.RB9']).toBeCloseTo(kg, 9);
    });
    it('layers dropdown offers 1 and 2; sizes RB6..DB16 (DB20 is not in the Excel list); names S1, S2', () => {
        expect([...SLAB_LAYERS]).toEqual([1, 2]);
        expect([...SLAB_BAR_SIZES]).toEqual(['RB6', 'RB9', 'DB12', 'DB16']);
        expect([...SLAB_NAMES]).toEqual(['S1', 'S2']);
    });
    it.each([
        [0.1, 12 / 0.1 * 4], [0.15, 12 / 0.15 * 4], [0.2, 240], [0.25, 192], [0.3, 160], [0.5, 96], [1, 48], [12, 4], [100, 0.48],
    ])('spacing %s gives %s m of bar (no rounding up)', (spacing, len) => {
        expect(slabRowCalc(withT({ spacing })).barLength).toBeCloseTo(len, 9);
    });
    it('spacing 0 gives 0 bars (Excel IFERROR → "0")', () => {
        const c = slabRowCalc(withT({ spacing: 0 }));
        expect(c.barLength).toBe(0);
        expect(c.weight).toBe(0);
        expect(slabRowCalc(withT({ spacing: NaN })).barLength).toBe(0);
    });
});

describe('slab-on-grade — every bar size option', () => {
    it.each(SIZES)('size %s: 240 m × kg/m', (size) => {
        const o = out1({ barSize: size });
        expect(o[`rebar.${size}`]).toBeCloseTo(240 * KG[size], 9);
        for (const other of SIZES.filter(s => s !== size)) expect(o[`rebar.${other}`], other).toBe(0);
    });
    it.each(['', 'DB25', 'rb9', 'RB 9'])('unknown size "%s": weight 0, no rebar row, other quantities kept', (size) => {
        const o = out1({ barSize: size });
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(o.concrete).toBeCloseTo(1.2, 9);
        expect(slotRows({ slabs: [withT({ barSize: size })] })).toEqual([]);
    });
    it('two panels with different sizes go to their own size totals', () => {
        const o = slabOnGrade.compute({ slabs: [T, withT({ barSize: 'DB12', layers: 1 })] }, ctx);
        expect(o['rebar.RB9']).toBeCloseTo(119.76, 9);
        expect(o['rebar.DB12']).toBeCloseTo(120 * 0.888, 9);
    });
});

describe('slab-on-grade — zero, negative, decimal and huge values', () => {
    const FIELDS = ['width', 'length', 'thickness', 'fillDepth', 'sandThickness', 'layers', 'spacing'] as const;
    it.each(FIELDS)('%s = 0 / -1 / NaN / Infinity / 1e9 / 0.0001 never gives NaN or Infinity', (field) => {
        for (const v of [0, -1, NaN, Infinity, -Infinity, 1e9, 0.0001, 2.5]) {
            for (const [k, x] of Object.entries(out1({ [field]: v }))) expect(Number.isFinite(x), `${field}=${v} ${k}`).toBe(true);
        }
    });
    it('width 0 or length 0: no area, no bars', () => {
        for (const patch of [{ width: 0 }, { length: 0 }]) {
            const o = out1(patch);
            for (const k of ['backfill', 'sand', 'plastic', 'concrete', 'rebar.RB9']) expect(o[k], k).toBe(0);
        }
    });
    it('NaN behaves like 0', () => {
        expect(out1({ width: NaN })).toEqual(out1({ width: 0 }));
    });
    it('a 1 mm × 1 mm slab keeps tiny quantities (no flooring)', () => {
        const o = out1({ width: 0.001, length: 0.001 });
        expect(o.plastic).toBeCloseTo(1e-6, 12);
        expect(o.concrete).toBeCloseTo(1e-7, 12);
    });
    it('1000 × 1000 m slab stays finite and exact', () => {
        const o = out1({ width: 1000, length: 1000 });
        expect(o.plastic).toBeCloseTo(1e6, 3);
        expect(o.concrete).toBeCloseTo(1e5, 3);
        expect(o['rebar.RB9']).toBeCloseTo(1e6 / 0.2 * 4 * 0.499, 3);
    });
});

describe('slab-on-grade — table size', () => {
    const many = (n: number): SlabRow[] => Array.from({ length: n }, () => ({ ...T }));
    it('Excel sample (10 panels): fill 20.04, sand 3.13125, plastic 50.1, concrete 5.01', () => {
        const o = computeSlabOnGrade(slabOnGrade.defaults());
        expect(o.backfill).toBeCloseTo(20.04, 9);
        expect(o.sand).toBeCloseTo(3.13125, 9);
        expect(o.plastic).toBeCloseTo(50.1, 9);
        expect(o.concrete).toBeCloseTo(5.01, 9);
    });
    it.each([1, 10, 17, 18, 40])('%s identical panels scale linearly (Excel rows 8–24 = 17; none dropped past it)', (n) => {
        const o = slabOnGrade.compute({ slabs: many(n) }, ctx);
        expect(o.plastic).toBeCloseTo(12 * n, 9);
        expect(o.concrete).toBeCloseTo(1.2 * n, 9);
        expect(o['rebar.RB9']).toBeCloseTo(119.76 * n, 9);
    });
    it('delete a panel removes its share', () => {
        const slabs = [T, withT({ width: 1, length: 1 }), withT({ width: 2, length: 2 })];
        const all = slabOnGrade.compute({ slabs }, ctx);
        const rest = slabOnGrade.compute({ slabs: [slabs[0] ?? T, slabs[2] ?? T] }, ctx);
        expect(diff(all, rest, 'plastic')).toBeCloseTo(1, 9);
        expect(diff(all, rest, 'concrete')).toBeCloseTo(0.1, 9);
    });
    it('newSlabRow copies the previous spec but never the size', () => {
        expect(newSlabRow(T)).toEqual({ ...T, width: 0, length: 0 });
        expect(slabOnGrade.compute({ slabs: [newSlabRow(T)] }, ctx).plastic).toBe(0);
    });
});

describe('slab-on-grade — rebar slot rows', () => {
    it('no bars: no rows; tie wire only when there is a bar row', () => {
        expect(slotRows({ slabs: [] })).toEqual([]);
        expect(slotRows({ slabs: [withT({ layers: 0 })] })).toEqual([]);
        expect(slotRows({ slabs: [T] }).map(x => x.key)).toEqual(['RB9', 'tie-wire']);
    });
    it('size order RB6, RB9, DB12, DB16, DB20', () => {
        const slabs = ['DB20', 'RB6', 'DB16', 'DB12', 'RB9'].map(s => withT({ barSize: s }));
        expect(slotRows({ slabs }).map(x => x.key)).toEqual(['RB6', 'RB9', 'DB12', 'DB16', 'DB20', 'tie-wire']);
    });
    it.each(SIZES)('BOQ row of %s: waste, 25 on gross, 15 on net; tie wire 3 %% of gross at 50', (size) => {
        const r = run([withT({ barSize: size })]);
        const kg = 240 * KG[size];
        const row = item(r, `slab-on-grade:rebar:${size}`);
        expect(row.qty).toBeCloseTo(kg, 9);
        expect(row.grossQty).toBeCloseTo(kg * WASTE[size], 9);
        expect(row.matTotal).toBeCloseTo(25 * kg * WASTE[size], 9);
        expect(row.labTotal).toBeCloseTo(15 * kg, 9);
        const wire = item(r, 'slab-on-grade:rebar:tie-wire');
        expect(wire.grossQty).toBeCloseTo(0.03 * kg * WASTE[size], 9);
        expect(wire.matTotal).toBeCloseTo(50 * 0.03 * kg * WASTE[size], 9);
    });
});

describe('slab-on-grade — BOQ money for T', () => {
    const r = run([T]);
    it('R88 backfill 4.8 m³ × 125', () => {
        expect(item(r, 'R88').total).toBeCloseTo(600, 9);
    });
    it('R89 sand 0.75: gross × 1.3 = 0.975 → 750 × 0.975 + 500 × 0.75', () => {
        expect(item(r, 'R89').grossQty).toBeCloseTo(0.975, 9);
        expect(item(r, 'R89').total).toBeCloseTo(731.25 + 375, 9);
    });
    it('R90 plastic 12 m²: gross × 1.3 = 15.6 → 10 × 15.6 + 10 × 12', () => {
        expect(item(r, 'R90').grossQty).toBeCloseTo(15.6, 9);
        expect(item(r, 'R90').total).toBeCloseTo(156 + 120, 9);
    });
    it('R94 concrete 1.2 m³ → 1.32 → CEILING 0.25 = 1.5', () => {
        expect(item(r, 'R94').grossQty).toBeCloseTo(1.5, 9);
        expect(item(r, 'R94').total).toBeCloseTo(2500 * 1.5 + 500 * 1.2, 9);
    });
    it.each([
        // thickness (m) → concrete 12 × t → ordered
        [0.05, 1], [0.0757, 1], [0.08, 1.25], [0.2, 2.75], [1 / 12 * 5, 5.5],
    ])('thickness %s gives ordered concrete %s m³', (t, ordered) => {
        expect(item(run([withT({ thickness: t })]), 'R94').grossQty).toBeCloseTo(ordered, 9);
    });
    it('no slab: concrete is not forced up to 1 m³', () => {
        expect(item(run([]), 'R94').grossQty).toBe(0);
    });
    it('level skipped: R88–R94 and rebar rows are 0 even with an edited quantity', () => {
        const s = run([T], { journey: { 'slab-on-grade': 'skipped' }, boqOverrides: { R94: { qty: 7 } } });
        for (const l of slabOnGrade.boqLinks) expect(item(s, l.line).qty, l.line).toBe(0);
        expect(hasItem(s, 'slab-on-grade:rebar:RB9')).toBe(false);
        expect(Object.values(s.calcOutputs['slab-on-grade'] ?? {}).every(v => v === 0)).toBe(true);
    });
});

describe('slab-on-grade — required fields (REQUIRED_FIELDS decision table)', () => {
    const missing = (rows: SlabRow[], patch: Partial<Project> = {}) =>
        missingRequirements('slab-on-grade', { ...createProject('blank'), calculators: { 'slab-on-grade': { slabs: rows } }, ...patch });
    const keys = (rows: SlabRow[]) => missing(rows).map(m => m.fieldKey ?? m.label);
    const REQUIRED = ['width', 'length', 'thickness'] as const;

    it('a complete row meets every requirement', () => {
        expect(keys([T])).toEqual([]);
    });
    it('an empty table asks for at least one item', () => {
        expect(missing([]).map(m => m.label)).toEqual(['เพิ่มพื้นหล่อในที่อย่างน้อย 1 ผืน']);
    });
    it.each(REQUIRED)('%s empty (0 / negative / NaN / Infinity) is reported once; a tiny positive value is accepted', (field) => {
        for (const v of [0, -1, NaN, Infinity]) {
            expect(keys([withT({ [field]: v })]), `${field}=${v}`).toEqual([field]);
        }
        expect(keys([withT({ [field]: 0.0001 })])).toEqual([]);
    });
    it('all required values empty on a started row are all reported, in the decision-table order', () => {
        const row = withT({ width: 0, length: 0, thickness: 0 });
        const started = withT({ ...row, width: 1 });
        const got = keys([started]);
        expect(got.length).toBeGreaterThan(0);
        for (const k of got) expect(REQUIRED).toContain(k);
    });
    it('a row that only carries a copied standard value (nothing typed from the plan) is ignored', () => {
        expect(keys([withT({ width: 0, length: 0 })])).toEqual(['เพิ่มพื้นหล่อในที่อย่างน้อย 1 ผืน']);
    });
    it('marked "ไม่มีในโครงการนี้" there is nothing to complete', () => {
        expect(missing([], { journey: { 'slab-on-grade': 'skipped' } })).toEqual([]);
        expect(missing([withT({ width: 0 })], { journey: { 'slab-on-grade': 'skipped' } })).toEqual([]);
    });
    it('the second row is named by its position in the message', () => {
        const m = missing([T, withT({ width: 0 })]);
        expect(m).toHaveLength(1);
        expect(m[0]?.itemIndex).toBe(1);
        expect(m[0]?.listKey).toBe('slabs');
        expect(m[0]?.fieldKey).toBe('width');
    });
});
