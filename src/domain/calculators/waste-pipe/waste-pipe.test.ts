import { describe, expect, it } from 'vitest';
import {
    wastePipe, runLength, pipeRunTargets, unlinkedRuns, sizeMismatches, sizeFromLabel,
    WASTE_PIPE_BOQ_LINES, WASTE_PIPE_SIZES, type WastePipeInput,
} from '.';
import { waterPipe } from '../water-pipe';
import { CALCULATORS } from '../registry';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const calcs = [...CALCULATORS.filter(c => c.id !== wastePipe.id && c.id !== waterPipe.id), wastePipe, waterPipe];

function section9(input?: WastePipeInput) {
    const project = createProject();
    if (input !== undefined) project.calculators['waste-pipe'] = input;
    const sec = computeProject(project, calcs).boq.sections.find(s => s.no === 9);
    const row = (key: string) => sec?.rows.find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    return { sec, row };
}

describe('ท่อน้ำทิ้ง_Waste Pipe (sheet 05)', () => {
    it('Excel sample: F5:F7 = D + E (6 / 21.1 / 8), D6 = 14.5 + 1.1', () => {
        const runs = wastePipe.defaults().runs;
        expect(runs).toHaveLength(3);
        expect(runs[1]?.horizontal).toBeCloseTo(14.5 + 1.1, 12);
        const expected = [6, 21.1, 8];
        runs.forEach((r, i) => expect(runLength(r)).toBeCloseTo(expected[i] ?? NaN, 12));
    });

    it('outputs E84:E86 = golden BOQ', () => {
        const out = wastePipe.compute(wastePipe.defaults(), ctx);
        expect(out.R84).toBeCloseTo(golden.lines.R84.E, 9);
        expect(out.R85).toBeCloseTo(golden.lines.R85.E, 9);
        expect(out.R86).toBeCloseTo(golden.lines.R86.E, 9);
        expect(out.total).toBeCloseTo(35.1, 9);
        expect(out.unlinked).toBe(0);
    });

    it('feeds BOQ section 9 exactly like Excel (labour on gross, 50 % consumables R87)', () => {
        const { sec, row } = section9();
        for (const key of ['R84', 'R85', 'R86', 'R87'] as const) {
            const g = golden.lines[key];
            expect(row(key)?.qty).toBeCloseTo(g.E, 9);
            expect(row(key)?.matTotal).toBeCloseTo(g.J, 6);
            expect(row(key)?.labTotal).toBeCloseTo(g.L, 6);
            expect(row(key)?.total).toBeCloseTo(g.M, 6);
        }
        expect(row('R84')?.desc).toBe('ท่อน้ำทิ้งชักโครก PVC 4"');
        expect(row('R85')?.desc).toBe('ท่อน้ำทิ้ง ØW ØFD PVC 2"');
        expect(row('R86')?.desc).toBe('ท่ออากาศถังบำบัด PVC 1"');
        expect(sec?.total).toBeCloseTo(golden.sections['9'].M, 2);
    });

    it('an added row is summed into the BOQ row of its pipe size (not dropped like Excel)', () => {
        const input = wastePipe.defaults();
        input.runs.push({ label: 'ท่อน้ำทิ้ง ØW ØFD PVC 2"', size: 'PVC 2"', horizontal: 3, vertical: 1.5 });
        input.runs.push({ label: 'ท่ออากาศถังบำบัด PVC 1"', size: 'PVC 1" ', horizontal: 2, vertical: 0 }); // Excel's trailing space
        const out = wastePipe.compute(input, ctx);
        expect(out.R84).toBeCloseTo(6, 9);
        expect(out.R85).toBeCloseTo(25.6, 9);
        expect(out.R86).toBeCloseTo(10, 9);
        expect(out.unlinked).toBe(0);
        const { row } = section9(input);
        // R85: H = 25.6 × 1.15 = 29.44 → J 60 × 29.44 = 1766.4, L 50 × 29.44 = 1472
        expect(row('R85')?.matTotal).toBeCloseTo(1766.4, 6);
        expect(row('R85')?.labTotal).toBeCloseTo(1472, 6);
        // R86: H = 11.5 → J 230, L 575; R87 = (1380 + 1766.4 + 230 + 690 + 1472 + 575) × 50 %
        expect(row('R87')?.total).toBeCloseTo(3056.7, 6);
    });

    it('the first three rows stay positional (Excel E84 = F5 …) even when their size changes', () => {
        const input = wastePipe.defaults();
        input.runs[0] = { label: 'ท่อน้ำทิ้ง ØW ØFD PVC 2"', size: 'PVC 2"', horizontal: 1, vertical: 1 };
        input.runs.push({ label: '', size: 'PVC 4"', horizontal: 5, vertical: 0 });
        const out = wastePipe.compute(input, ctx);
        expect(out.R84).toBeCloseTo(2 + 5, 9);
        expect(out.R85).toBeCloseTo(21.1, 9);
        expect(sizeMismatches(input, WASTE_PIPE_BOQ_LINES)).toEqual([{ index: 0, size: 'PVC 2"', line: WASTE_PIPE_BOQ_LINES[0] }]);
        expect(wastePipe.boqText?.(input, ctx).R84).toEqual({ desc: 'ท่อน้ำทิ้ง ØW ØFD PVC 2"' });
    });

    it('rows of a size with no BOQ row are reported, not added', () => {
        const input = wastePipe.defaults();
        input.runs.push({ label: '', size: '', horizontal: 2, vertical: 1 });
        input.runs.push({ label: '', size: 'PVC 3"', horizontal: 4, vertical: 0 });
        input.runs.push({ label: '', size: '', horizontal: 0, vertical: 0 });
        expect(pipeRunTargets(input.runs, WASTE_PIPE_BOQ_LINES)).toEqual([0, 1, 2, null, null, null]);
        const out = wastePipe.compute(input, ctx);
        expect([out.R84, out.R85, out.R86]).toEqual([6, expect.closeTo(21.1, 9), 8]);
        expect(out.unlinked).toBe(7);
        expect(out.total).toBeCloseTo(42.1, 9);
        expect(unlinkedRuns(input, WASTE_PIPE_BOQ_LINES)).toEqual([
            { index: 3, size: '', length: 3 },
            { index: 4, size: 'PVC 3"', length: 4 },
        ]);
    });

    it('blank B keeps the template text; size is read from the item name', () => {
        const input = wastePipe.defaults();
        input.runs[2] = { label: '', size: '', horizontal: 0, vertical: 0 };
        expect(wastePipe.boqText?.(input, ctx).R86).toBeUndefined();
        expect(sizeFromLabel('ท่อน้ำทิ้งชักโครก PVC 4"', WASTE_PIPE_SIZES)).toBe('PVC 4"');
        expect(sizeFromLabel('ท่ออากาศถังบำบัด PVC 1"', WASTE_PIPE_SIZES)).toBe('PVC 1"');
        expect(sizeFromLabel('อื่น ๆ', WASTE_PIPE_SIZES)).toBe('');
    });

    it('links', () => {
        expect(wastePipe.boqLinks).toEqual([
            { line: 'R84', field: 'qty', output: 'R84' },
            { line: 'R85', field: 'qty', output: 'R85' },
            { line: 'R86', field: 'qty', output: 'R86' },
        ]);
    });
});
