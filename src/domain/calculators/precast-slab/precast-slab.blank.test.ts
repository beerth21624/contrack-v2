import { describe, expect, it } from 'vitest';
import { newPrecastPanel, precastSlab, type PrecastSlabInput } from '.';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const blank = (): PrecastSlabInput => {
    const b = precastSlab.blank?.();
    if (!b) throw new Error('precast-slab has no blank()');
    return b;
};

describe('พื้นสำเร็จรูป — blank project', () => {
    it('starts with no spans', () => {
        expect(blank()).toEqual({ panels: [] });
    });

    it('compute(blank) is finite and every BOQ-linked output is 0', () => {
        const o = precastSlab.compute(blank(), ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const link of precastSlab.boqLinks) expect(o[link.output], link.output).toBe(0);
        for (const k of Object.keys(o).filter(k => k.startsWith('rebar.'))) expect(o[k], k).toBe(0);
        expect(precastSlab.boqSlots?.(blank(), ctx)).toEqual({ 'shear-key': [] });
    });

    it('in a blank project section 10 is 0 (incl. the props row 0.1 × area) and there are no shear-key rows', () => {
        const r = computeProject(createProject('blank'), [precastSlab]);
        const rows = r.boq.sections.flatMap(s => s.rows).filter((x): x is BoqItemRow => x.type === 'item');
        for (const key of ['R97', 'R98', 'R99', 'R101', 'R104']) {
            const row = rows.find(x => x.key === key);
            expect(row?.qty, key).toBe(0);
            expect(row?.total, key).toBe(0);
        }
        expect(rows.filter(x => x.key.startsWith('precast-slab:'))).toEqual([]);
    });

    it('a new span has no size and the Excel shear key / topping; later spans copy the previous one', () => {
        expect(newPrecastPanel()).toEqual({ width: 0, length: 0, keySize: 'RB6', keySpacing: 0.35, keyBarLength: 0.8, topping: 0.05 });
        const prev = { width: 3, length: 4, keySize: 'RB9', keySpacing: 0.3, keyBarLength: 1, topping: 0.06 };
        expect(newPrecastPanel(prev)).toEqual({ ...prev, width: 0, length: 0 });
    });

    it('one span 3 × 4 m: 12 m², topping 0.6 m³, shear key 18 × 0.8 m RB6', () => {
        const o = precastSlab.compute({ panels: [{ ...newPrecastPanel(), width: 3, length: 4 }] }, ctx);
        expect(o.area).toBeCloseTo(12, 9);
        expect(o.concrete).toBeCloseTo(0.6, 9);
        expect(o.formwork).toBeCloseTo(0.7, 9);                  // 2 × (3 + 4) × 0.05
        expect(o['rebar.RB6']).toBeCloseTo(18 * 0.8 * 0.222, 9); // ROUNDUP(6 / 0.35) = 18 bars
    });
});
