import { describe, expect, it } from 'vitest';
import { newRoofSlabRow, roofSlab, type RoofSlabInput } from '.';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const blank = (): RoofSlabInput => {
    const b = roofSlab.blank?.();
    if (!b) throw new Error('roof-slab has no blank()');
    return b;
};

describe('พื้นดาดฟ้า — blank project', () => {
    it('starts with no panels', () => {
        expect(blank()).toEqual({ rows: [] });
    });

    it('compute(blank) is finite and every BOQ-linked output is 0', () => {
        const o = roofSlab.compute(blank(), ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const link of roofSlab.boqLinks) expect(o[link.output], link.output).toBe(0);
        for (const k of Object.keys(o).filter(k => k.startsWith('rebar.'))) expect(o[k], k).toBe(0);
        expect(roofSlab.boqSlots?.(blank(), ctx)).toEqual({ rebar: [] });
    });

    it('in a blank project the BOQ rows it fills are 0 and there are no roof-slab rebar rows', () => {
        const r = computeProject(createProject('blank'), [roofSlab]);
        const rows = (r.boq.sections.find(s => s.no === 12)?.rows ?? []).filter((x): x is BoqItemRow => x.type === 'item');
        for (const link of roofSlab.boqLinks) {
            const row = rows.find(x => x.key === link.line);
            expect(row?.qty, link.line).toBe(0);
            expect(row?.total, link.line).toBe(0);
        }
        expect(rows.filter(x => x.key.startsWith('roof-slab:'))).toEqual([]);
    });

    it('a new panel has no size and the Excel bar spec; later panels copy thickness and bars', () => {
        expect(newRoofSlabRow()).toEqual({ name: 'S1', width: 0, length: 0, thickness: 0, size: 'RB9', layers: 2, spacing: 0.2 });
        const prev = { name: 'S2', width: 3, length: 4, thickness: 0.12, size: 'DB12', layers: 1, spacing: 0.25 };
        expect(newRoofSlabRow(prev)).toEqual({ ...prev, width: 0, length: 0 });
    });

    it('one panel 3 × 4 × 0.10 m: concrete 1.2 m³, formwork 12 m², 20 props, RB9 119.76 kg', () => {
        const o = roofSlab.compute({ rows: [{ ...newRoofSlabRow(), width: 3, length: 4, thickness: 0.1 }] }, ctx);
        expect(o.concrete).toBeCloseTo(1.2, 9);
        expect(o.formwork).toBeCloseTo(12, 9);
        expect(o.props).toBe(20);                       // ROUNDUP(12 / 0.6)
        expect(o['rebar.RB9']).toBeCloseTo(119.76, 9);  // 12 / 0.2 × 2 × 2 = 240 m
    });
});
