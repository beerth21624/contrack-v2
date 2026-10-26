import { describe, expect, it } from 'vitest';
import { slabOnGrade, slabRowCalc, type SlabRow } from '.';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const lines = golden.lines as Record<string, { E?: number; H?: number; M?: number }>;
const sections = golden.sections as Record<string, { M: number }>;

const project = (slabs?: SlabRow[]) => {
    const p = createProject();
    if (slabs) p.calculators['slab-on-grade'] = { slabs };
    return computeProject(p, [slabOnGrade]);
};
const items = (r: ReturnType<typeof project>) =>
    (r.boq.sections.find(s => s.no === 9)?.rows ?? []).filter((x): x is BoqItemRow => x.type === 'item');
const item = (r: ReturnType<typeof project>, key: string) => items(r).find(x => x.key === key);

describe('พื้นหล่อในที่_S (sheet 28)', () => {
    it('Excel sample rows 8–17: S1, t 0.1, fill 0.4, sand 0.05, RB9 × 2 layers @0.2', () => {
        const d = slabOnGrade.defaults().slabs;
        expect(d.map(r => [r.width, r.length])).toEqual([
            [1.8, 2.0], [0.9, 7.0], [2.3, 3.0], [1.0, 1.0], [2.0, 4.0], [1.5, 4.0], [1.5, 4.0], [1.5, 4.0], [0.9, 3.5], [0.9, 3.5],
        ]);
        for (const r of d) {
            expect(r).toMatchObject({ name: 'S1', thickness: 0.1, fillDepth: 0.4, sandThickness: 0.05, barSize: 'RB9', layers: 2, spacing: 0.2 });
        }
    });

    it('row formulas H, J, K, P, Q, S reproduce Excel cached values', () => {
        // [H backfill, J sand, K plastic, P bar length, Q kg, S concrete] for rows 8–17
        const excel = [
            [1.44, 0.225, 3.6, 72, 35.928, 0.36],
            [2.52, 0.39375, 6.3, 126, 62.874, 0.63],
            [2.76, 0.43125, 6.9, 138, 68.862, 0.69],
            [0.4, 0.0625, 1, 20, 9.98, 0.1],
            [3.2, 0.5, 8, 160, 79.84, 0.8],
            [2.4, 0.375, 6, 120, 59.88, 0.6],
            [2.4, 0.375, 6, 120, 59.88, 0.6],
            [2.4, 0.375, 6, 120, 59.88, 0.6],
            [1.26, 0.196875, 3.15, 63, 31.437, 0.315],
            [1.26, 0.196875, 3.15, 63, 31.437, 0.315],
        ];
        slabOnGrade.defaults().slabs.forEach((r, i) => {
            const c = slabRowCalc(r);
            const [h, j, k, p, q, s] = excel[i] ?? [];
            expect(c.backfill).toBeCloseTo(h ?? NaN, 9);
            expect(c.sand).toBeCloseTo(j ?? NaN, 9);
            expect(c.plastic).toBeCloseTo(k ?? NaN, 9);
            expect(c.barLength).toBeCloseTo(p ?? NaN, 9);
            expect(c.weight).toBeCloseTo(q ?? NaN, 9);
            expect(c.concrete).toBeCloseTo(s ?? NaN, 9);
        });
    });

    it('totals row 6: G6 20.04, I6 3.13125, K6 50.1, M6..Q6 = 0 / 499.998 / 0 / 0 / 0, S6 5.01', () => {
        const o = slabOnGrade.compute(slabOnGrade.defaults(), ctx);
        expect(o.backfill).toBeCloseTo(20.04, 9);
        expect(o.sand).toBeCloseTo(3.13125, 9);
        expect(o.plastic).toBeCloseTo(50.1, 9);
        expect(o['rebar.RB6']).toBe(0);
        expect(o['rebar.RB9']).toBeCloseTo(499.998, 9);
        expect(o['rebar.DB12']).toBe(0);
        expect(o['rebar.DB16']).toBe(0);
        expect(o['rebar.DB20']).toBe(0);
        expect(o.concrete).toBeCloseTo(5.01, 9);
    });

    it('feeds BOQ section 9 like Excel (R88–R94) and the section total matches M95', () => {
        const r = project();
        for (const key of ['R88', 'R89', 'R90', 'R94']) {
            const row = item(r, key);
            expect(row?.fromCalc.qty).toBe(true);
            expect(row?.qty).toBeCloseTo(lines[key]?.E ?? NaN, 9);
            expect(row?.grossQty).toBeCloseTo(lines[key]?.H ?? NaN, 9);
            expect(row?.total).toBeCloseTo(lines[key]?.M ?? NaN, 6);
        }
        // Rebar slot replaces R92/R93 with the same values.
        const rb9 = item(r, 'slab-on-grade:rebar:RB9');
        const wire = item(r, 'slab-on-grade:rebar:tie-wire');
        expect(item(r, 'R92')).toBeUndefined();
        expect(rb9?.qty).toBeCloseTo(lines.R92?.E ?? NaN, 9);
        expect(rb9?.grossQty).toBeCloseTo(lines.R92?.H ?? NaN, 9);
        expect(rb9?.total).toBeCloseTo(lines.R92?.M ?? NaN, 6);
        expect(wire?.grossQty).toBeCloseTo(lines.R93?.H ?? NaN, 9);
        expect(wire?.total).toBeCloseTo(lines.R93?.M ?? NaN, 6);
        expect(items(r).filter(x => x.key.startsWith('slab-on-grade:rebar:')).map(x => x.desc))
            .toEqual(['- เหล็ก RB9', '- ลวดผูกเหล็ก']);
        expect(r.boq.sections.find(s => s.no === 9)?.total).toBeCloseTo(sections['9']?.M ?? NaN, 2);
    });

    it('adding a DB12 panel (2 × 3, 1 layer @0.25) adds its quantities and a DB12 BOQ row', () => {
        const extra: SlabRow = {
            name: 'S2', width: 2, length: 3, thickness: 0.1, fillDepth: 0.4, sandThickness: 0.05,
            barSize: 'DB12', layers: 1, spacing: 0.25,
        };
        // area 6 → backfill 2.4, sand 0.375, plastic 6, bars 6/0.25×2×1 = 48 m × 0.888 = 42.624 kg, concrete 0.6
        const c = slabRowCalc(extra);
        expect(c.barLength).toBeCloseTo(48, 9);
        expect(c.weight).toBeCloseTo(42.624, 9);
        const input = { slabs: [...slabOnGrade.defaults().slabs, extra] };
        const o = slabOnGrade.compute(input, ctx);
        expect(o.backfill).toBeCloseTo(22.44, 9);
        expect(o.sand).toBeCloseTo(3.50625, 9);
        expect(o.plastic).toBeCloseTo(56.1, 9);
        expect(o.concrete).toBeCloseTo(5.61, 9);
        expect(o['rebar.DB12']).toBeCloseTo(42.624, 9);
        const r = project(input.slabs);
        expect(item(r, 'slab-on-grade:rebar:DB12')?.grossQty).toBeCloseTo(42.624 * 1.12, 9);
        expect(item(r, 'slab-on-grade:rebar:tie-wire')?.grossQty).toBeCloseTo((499.998 * 1.09 + 42.624 * 1.12) * 0.03, 9);
        expect(item(r, 'R94')?.grossQty).toBe(6.25);   // MAX(1, CEILING(5.61 × 1.1, 0.25))
    });

    it('IFERROR / SWITCH edge cases: zero spacing → 0 m, blank size → 0 kg, 1 layer halves the bars', () => {
        const base = slabOnGrade.defaults().slabs[0];
        if (!base) throw new Error('no sample row');
        expect(slabRowCalc({ ...base, spacing: 0 }).barLength).toBe(0);
        expect(slabRowCalc({ ...base, barSize: '' }).weight).toBe(0);
        expect(slabRowCalc({ ...base, layers: 1 }).barLength).toBeCloseTo(36, 9);
    });
});
