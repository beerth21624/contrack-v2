import { describe, expect, it } from 'vitest';
import { newSlabRow, slabOnGrade, type SlabOnGradeInput } from '.';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const blank = (): SlabOnGradeInput => {
    const b = slabOnGrade.blank?.();
    if (!b) throw new Error('slab-on-grade has no blank()');
    return b;
};

describe('พื้นหล่อในที่ — blank project', () => {
    it('starts with no panels', () => {
        expect(blank()).toEqual({ slabs: [] });
    });

    it('compute(blank) is finite and every BOQ-linked output is 0', () => {
        const o = slabOnGrade.compute(blank(), ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const link of slabOnGrade.boqLinks) expect(o[link.output], link.output).toBe(0);
        for (const k of Object.keys(o).filter(k => k.startsWith('rebar.'))) expect(o[k], k).toBe(0);
        expect(slabOnGrade.boqSlots?.(blank(), ctx)).toEqual({ rebar: [] });
    });

    it('in a blank project the BOQ rows it fills are 0 and there are no rebar rows', () => {
        const r = computeProject(createProject('blank'), [slabOnGrade]);
        const rows = (r.boq.sections.find(s => s.no === 9)?.rows ?? []).filter((x): x is BoqItemRow => x.type === 'item');
        for (const link of slabOnGrade.boqLinks) {
            const row = rows.find(x => x.key === link.line);
            expect(row?.qty, link.line).toBe(0);
            expect(row?.total, link.line).toBe(0);
        }
        expect(rows.filter(x => x.key.startsWith('slab-on-grade:'))).toEqual([]);
    });

    it('a new panel has no size and the Excel bar spec; later panels copy the previous spec', () => {
        expect(newSlabRow()).toEqual({
            name: 'S1', width: 0, length: 0, thickness: 0, fillDepth: 0.4, sandThickness: 0.05, barSize: 'RB9', layers: 2, spacing: 0.2,
        });
        const prev = { ...newSlabRow(), width: 3, length: 4, thickness: 0.12, barSize: 'DB12', layers: 1, spacing: 0.25 };
        expect(newSlabRow(prev)).toEqual({ ...prev, width: 0, length: 0 });
    });

    it('one panel 3 × 4 × 0.10 m: concrete 1.2 m³, RB9 240 m = 119.76 kg', () => {
        const o = slabOnGrade.compute({ slabs: [{ ...newSlabRow(), width: 3, length: 4, thickness: 0.1 }] }, ctx);
        expect(o.concrete).toBeCloseTo(1.2, 9);
        expect(o['rebar.RB9']).toBeCloseTo(119.76, 9);   // 12 / 0.2 × 2 × 2 = 240 m × 0.499
        expect(o.backfill).toBeCloseTo(4.8, 9);           // 12 × 0.4
        expect(o.sand).toBeCloseTo(0.75, 9);              // 12 × 0.05 × 1.25
    });
});
