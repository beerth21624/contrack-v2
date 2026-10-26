import { describe, expect, it } from 'vitest';
import { waterPipe, runLength, unlinkedRuns, WATER_PIPE_BOQ_LINES, type WaterPipeInput } from '.';
import { wastePipe } from '../waste-pipe';
import { CALCULATORS } from '../registry';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const calcs = [...CALCULATORS.filter(c => c.id !== wastePipe.id && c.id !== waterPipe.id), wastePipe, waterPipe];

function section21(input?: WaterPipeInput) {
    const project = createProject();
    if (input !== undefined) project.calculators['water-pipe'] = input;
    const sec = computeProject(project, calcs).boq.sections.find(s => s.no === 21);
    const row = (key: string) => sec?.rows.find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    return { sec, row };
}

describe('ท่อน้ำดี_Water Pipe (sheet 06)', () => {
    it('Excel sample: F5:F6 = D + E (58.5 / 13.1)', () => {
        const runs = waterPipe.defaults().runs;
        expect(runs).toHaveLength(2);
        const expected = [58.5, 13.1];
        runs.forEach((r, i) => expect(runLength(r)).toBeCloseTo(expected[i] ?? NaN, 12));
    });

    it('outputs E213:E214 = golden BOQ', () => {
        const out = waterPipe.compute(waterPipe.defaults(), ctx);
        expect(out.R213).toBeCloseTo(golden.lines.R213.E, 9);
        expect(out.R214).toBeCloseTo(golden.lines.R214.E, 9);
        expect(out.total).toBeCloseTo(71.6, 9);
        expect(out.unlinked).toBe(0);
    });

    it('feeds BOQ section 21 exactly like Excel (labour on gross, 50 % consumables R215)', () => {
        const { sec, row } = section21();
        for (const key of ['R213', 'R214', 'R215'] as const) {
            const g = golden.lines[key];
            expect(row(key)?.qty).toBeCloseTo(g.E, 9);
            expect(row(key)?.matTotal).toBeCloseTo(g.J, 6);
            expect(row(key)?.labTotal).toBeCloseTo(g.L, 6);
            expect(row(key)?.total).toBeCloseTo(g.M, 6);
        }
        expect(row('R213')?.desc).toBe('ท่อเมนภายนอก PVC 3/4"');
        expect(row('R214')?.desc).toBe('ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2"');
        expect(sec?.total).toBeCloseTo(golden.sections['21'].M, 2);
    });

    it('an added row is summed into the BOQ row of its pipe size', () => {
        const input = waterPipe.defaults();
        input.runs.push({ label: 'ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2"', size: 'PVC 1/2"', horizontal: 6, vertical: 2.9 });
        input.runs.push({ label: '', size: '', horizontal: 1, vertical: 0 });
        const out = waterPipe.compute(input, ctx);
        expect(out.R213).toBeCloseTo(58.5, 9);
        expect(out.R214).toBeCloseTo(22, 9);
        expect(out.unlinked).toBe(1);
        expect(unlinkedRuns(input, WATER_PIPE_BOQ_LINES)).toEqual([{ index: 3, size: '', length: 1 }]);
        const { row } = section21(input);
        // R214: H = 22 × 1.15 = 25.3 → J 15 × 25.3 = 379.5, L 40 × 25.3 = 1012
        expect(row('R214')?.total).toBeCloseTo(1391.5, 6);
        // R215 = (1345.5 + 379.5 + 2691 + 1012) × 50 %
        expect(row('R215')?.total).toBeCloseTo(2714, 6);
    });

    it('links', () => {
        expect(waterPipe.boqLinks).toEqual([
            { line: 'R213', field: 'qty', output: 'R213' },
            { line: 'R214', field: 'qty', output: 'R214' },
        ]);
    });
});
