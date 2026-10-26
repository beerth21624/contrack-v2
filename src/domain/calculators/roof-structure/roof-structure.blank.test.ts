import { describe, expect, it } from 'vitest';
import { roofStructure } from '.';
import { roofing } from '../roofing';
import { computeProject, createProject } from '../../project';

const blankInput = () => roofStructure.blank?.() ?? roofStructure.defaults();
const roofingOut = (input = roofing.blank?.() ?? roofing.defaults()) => roofing.compute(input, { outputs: () => undefined });
const ctxWithRoofing = (out: Record<string, number>) => ({ outputs: (id: string) => (id === 'roofing' ? out : undefined) });

describe('โครงสร้างหลังคา blank project', () => {
    it('empties plan lengths / king posts / valley; keeps steel sections, ซีคู่, factor and spacing', () => {
        const sample = roofStructure.defaults();
        const blank = blankInput();
        expect(blank.wallPlate).toEqual({ ...sample.wallPlate, lengths: [] });
        expect(blank.ridge).toEqual({ ...sample.ridge, lengths: [] });
        expect(blank.kingPosts).toEqual({ desc: sample.kingPosts.desc, parts: [] });
        expect(blank.valley).toEqual({ ...sample.valley, runA: 0, runB: 0, deg: 0, count: 0 });
        expect(blank.rafter).toEqual(sample.rafter);
        expect(blank.purlin).toEqual(sample.purlin);
        expect(sample.kingPosts.parts).toHaveLength(5);   // defaults() unchanged
    });

    it('with a blank roofing sheet every output is a finite 0 (BOQ 152–157, 159)', () => {
        const out = roofStructure.compute(blankInput(), ctxWithRoofing(roofingOut()));
        for (const [k, v] of Object.entries(out)) {
            expect(Number.isFinite(v), k).toBe(true);
            expect(v, k).toBe(0);
        }
        for (const link of roofStructure.boqLinks) expect(out[link.output], link.line).toBe(0);
    });

    it('rafters, purlins and the steel labour follow the roof size typed on the roofing level', () => {
        const project = createProject('blank');
        project.calculators.roofing = { ...(roofing.blank?.() ?? roofing.defaults()), planArea: 113, slopeDeg: 40 };
        const out = computeProject(project, [roofing, roofStructure]).calcOutputs['roof-structure'];
        expect(out?.R159).toBeCloseTo(147.5110237, 6);
        expect(out?.R156).toBe(Math.ceil((147.5110237 / 1) * 1.15 / 6));
        expect(out?.R157).toBe(Math.ceil((147.5110237 / 0.34) * 1.15 / 6));
        expect(out?.R152).toBe(0);
        expect(out?.R155).toBe(0);
    });
});
