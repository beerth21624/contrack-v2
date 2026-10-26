import { describe, expect, it } from 'vitest';
import { newRoofBeamRow, roofBeam, type RoofBeamInput } from '.';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const blank = (): RoofBeamInput => {
    const b = roofBeam.blank?.();
    if (!b) throw new Error('roof-beam has no blank()');
    return b;
};

describe('คานดาดฟ้า — blank project', () => {
    it('starts with no beams', () => {
        expect(blank()).toEqual({ rows: [] });
    });

    it('compute(blank) is finite and every BOQ-linked output is 0', () => {
        const o = roofBeam.compute(blank(), ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const link of roofBeam.boqLinks) expect(o[link.output], link.output).toBe(0);
        for (const k of Object.keys(o).filter(k => k.startsWith('rebar.'))) expect(o[k], k).toBe(0);
        expect(roofBeam.boqSlots?.(blank(), ctx)).toEqual({ rebar: [] });
    });

    it('in a blank project the BOQ rows it fills are 0 and there are no roof-beam rebar rows', () => {
        const r = computeProject(createProject('blank'), [roofBeam]);
        const rows = (r.boq.sections.find(s => s.no === 12)?.rows ?? []).filter((x): x is BoqItemRow => x.type === 'item');
        for (const link of roofBeam.boqLinks) {
            const row = rows.find(x => x.key === link.line);
            expect(row?.qty, link.line).toBe(0);
            expect(row?.total, link.line).toBe(0);
        }
        expect(rows.filter(x => x.key.startsWith('roof-beam:'))).toEqual([]);
    });

    it('a new beam has no size and the Excel bar spec; later beams copy section and bars, not the length', () => {
        expect(newRoofBeamRow()).toEqual({
            name: '', width: 0, depth: 0, length: 0, mainSize: 'DB12', mainCount: 0, stirrupSize: 'RB6', stirrupSpacing: 0.15,
        });
        const prev = { name: 'B1', width: 0.2, depth: 0.4, length: 6, mainSize: 'DB16', mainCount: 4, stirrupSize: 'RB9', stirrupSpacing: 0.2 };
        expect(newRoofBeamRow(prev)).toEqual({ ...prev, name: '', length: 0 });
    });

    it('one beam 0.2 × 0.3 × 6 m, 4-DB12, RB6 @0.15: concrete 0.36 m³, 10 props', () => {
        const o = roofBeam.compute({ rows: [{ ...newRoofBeamRow(), width: 0.2, depth: 0.3, length: 6, mainCount: 4 }] }, ctx);
        expect(o.concrete).toBeCloseTo(0.36, 9);
        expect(o.props).toBe(10);                                   // ROUNDUP(6 / 0.6)
        expect(o.formwork).toBeCloseTo(2 * 0.3 * 6 + 0.2 * 6, 9);   // sides + soffit
        expect(o['rebar.DB12']).toBeCloseTo(24 * 0.888, 9);
        expect(o['rebar.RB6']).toBeCloseTo(40 * 1 * 0.222, 9);      // ROUNDUP(6 / 0.15) = 40 × 1.0 m
    });
});
