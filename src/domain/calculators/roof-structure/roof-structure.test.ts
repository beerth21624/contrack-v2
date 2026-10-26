import { describe, expect, it } from 'vitest';
import { roofStructure, valleyLength, type RoofStructureInput } from '.';
import { roofing, type RoofingInput } from '../roofing';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const goldenLines: Record<string, { E?: number; H?: number; M?: number } | undefined> = golden.lines;
const SLOPE = 147.5110237;
const ctxWith = (slopeArea: number) => ({ outputs: (id: string) => (id === 'roofing' ? { slopeArea } : undefined) });
const ctx = ctxWith(SLOPE);

const section15 = (input?: RoofStructureInput, roofingInput?: RoofingInput) => {
    const project = createProject();
    if (input !== undefined) project.calculators['roof-structure'] = input;
    if (roofingInput !== undefined) project.calculators.roofing = roofingInput;
    const res = computeProject(project, [roofing, roofStructure]);
    const sec = res.boq.sections.find(s => s.no === 15);
    const row = (key: string) => sec?.rows.find(r => r.key === key) as BoqItemRow;
    return { sec, row, res };
};

describe('โครงสร้างหลังคา Roof Structure (sheet 22)', () => {
    it('Excel sample: G ความยาว and I ความยาวรวม of every row', () => {
        const out = roofStructure.compute(roofStructure.defaults(), ctx);
        expect(out['wallPlate.length']).toBeCloseTo(92.9, 9);         // G5
        expect(out['wallPlate.total']).toBeCloseTo(185.8, 9);         // I5
        expect([0, 1, 2, 3, 4].map(i => out[`kingPosts.part.${i}`]))  // I7…I11
            .toEqual([6.4, 10.8, 24.4, 15.9, 19.2].map(v => expect.closeTo(v, 9) as number));
        expect(out['kingPosts.total']).toBeCloseTo(76.7, 9);          // I6
        expect(out['ridge.length']).toBeCloseTo(44.1, 9);             // G12
        expect(out['ridge.total']).toBeCloseTo(88.2, 9);              // I12
        expect(out['valley.length']).toBeCloseTo(6.646048895, 8);     // G13
        expect(out['valley.total']).toBeCloseTo(26.58419558, 7);      // I13
        expect(out['rafter.area']).toBeCloseTo(SLOPE, 7);             // E14
        expect(out['rafter.total']).toBeCloseTo(169.6376772, 6);      // I14
        expect(out['purlin.area']).toBeCloseTo(SLOPE, 7);             // E15
        expect(out['purlin.total']).toBeCloseTo(498.9343448, 6);      // I15
    });

    it('Excel sample: J จำนวน (ท่อน) = 31, 13, 15, 5, 29, 84', () => {
        const out = roofStructure.compute(roofStructure.defaults(), ctx);
        expect([out.R152, out.R153, out.R154, out.R155, out.R156, out.R157]).toEqual([31, 13, 15, 5, 29, 84]);
        expect(out.R159).toBeCloseTo(SLOPE, 7);
    });

    it('without the Roofing calculator it uses the Roofing sheet sample (K7 = 147.511)', () => {
        const out = roofStructure.compute(roofStructure.defaults(), { outputs: () => undefined });
        expect(out.linkedSlopeArea).toBeCloseTo(SLOPE, 7);
        expect(out.R157).toBe(84);
    });

    it('feeds BOQ section 15 exactly like Excel (E152…E159, H, M and the subtotal)', () => {
        const { sec, row } = section15();
        for (const key of ['R152', 'R153', 'R154', 'R155', 'R156', 'R157', 'R159']) {
            const g = goldenLines[key];
            expect(g, key).toBeDefined();
            if (!g) continue;
            const r = row(key);
            expect(r.qty, key).toBeCloseTo(g.E ?? NaN, 6);
            expect(r.grossQty, key).toBe(g.H);
            expect(r.total, key).toBeCloseTo(g.M ?? NaN, 4);
            expect(r.fromCalc.qty, key).toBe(true);
        }
        // R158 งานทาสีกันสนิม stays the typed lump sum.
        expect(row('R158').fromCalc.qty).toBe(false);
        expect(row('R158').total).toBe(goldenLines.R158?.M);
        expect(row('R152').desc).toBe('อะเส 2-C 150x50x20x3.2 มม.');
        expect(sec?.matTotal).toBeCloseTo(golden.sections['15'].J, 4);
        expect(sec?.labTotal).toBeCloseTo(golden.sections['15'].L, 4);
        expect(sec?.total).toBeCloseTo(golden.sections['15'].M, 4);
    });

    it('slope area follows the Roofing sheet: pitch 30° → K7 130.48 → rafters 26, purlins 74, labour on 130.48 m²', () => {
        const { row } = section15(undefined, { ...roofing.defaults(), slopeDeg: 30 });
        expect(row('R156').qty).toBe(26);
        expect(row('R157').qty).toBe(74);
        expect(row('R159').qty).toBeCloseTo(130.4811608, 6);
        expect(row('R152').qty).toBe(31);   // linear members do not depend on the pitch
    });

    it('a typed area overrides the link (Excel E14/E15 are yellow cells)', () => {
        const input = roofStructure.defaults();
        input.purlin = { ...input.purlin, area: 100 };
        const out = roofStructure.compute(input, ctx);
        expect(out['purlin.total']).toBeCloseTo(100 / 0.34 * 1.15, 9);
        expect(out.R157).toBe(57);          // ROUNDUP(338.235 / 6)
        expect(out.R159).toBe(100);         // E159 = E15
        expect(out.R156).toBe(29);          // the rafters keep the link
    });

    it('adding a ดั้ง sub-row (2-C, 2 m × 1) → I6 80.7 → 14 sticks', () => {
        const input = roofStructure.defaults();
        input.kingPosts = { ...input.kingPosts, parts: [...input.kingPosts.parts, { desc: '- ดั้ง-6', c: 2, length: 2, count: 1 }] };
        const out = roofStructure.compute(input, ctx);
        expect(out['kingPosts.total']).toBeCloseTo(80.7, 9);
        expect(out.R153).toBe(14);
    });

    it('valley runs and pitch are inputs: 3 m × 4 m at 30° → G 5.774, 4 valleys → 4 sticks', () => {
        const input = roofStructure.defaults();
        input.valley = { ...input.valley, runA: 3, runB: 4, deg: 30 };
        expect(valleyLength(input.valley)).toBeCloseTo(5.773502692, 8);
        expect(roofStructure.compute(input, ctx).R155).toBe(4);
    });

    it('single C halves a double-C member: อะเส with C = 1 → 92.9 m → 16 sticks', () => {
        const input = roofStructure.defaults();
        input.wallPlate = { ...input.wallPlate, c: 1 };
        expect(roofStructure.compute(input, ctx).R152).toBe(16);
    });

    it('empty spacing gives 0 sticks (Excel: #DIV/0!)', () => {
        const input = roofStructure.defaults();
        input.rafter = { ...input.rafter, spacing: 0 };
        expect(roofStructure.compute(input, ctxWith(SLOPE)).R156).toBe(0);
    });
});
