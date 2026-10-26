import { describe, expect, it } from 'vitest';
import { landInspection, lineTotal } from '.';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };

describe('ค่าตรวจสอบที่ดิน (sheet 36)', () => {
    it('Excel sample: F8:F11 = C × E, F14 ต้นทุนรวม = 7,500', () => {
        const input = landInspection.defaults();
        expect(input.items.map(lineTotal)).toEqual([3000, 2500, 1200, 800]);
        expect(landInspection.compute(input, ctx).total).toBe(7500);
    });

    it('extra rows are added to the total', () => {
        const input = landInspection.defaults();
        input.items.push({ label: 'ค่ารังวัด', qty: 1, unit: 'งาน', unitPrice: 3000 });
        expect(landInspection.compute(input, ctx).total).toBe(10500);
    });

    it('blank / invalid cells count as 0 (like the empty "+ เพิ่ม" row F12)', () => {
        const input = landInspection.defaults();
        input.items.push({ label: '', qty: Number.NaN, unit: '', unitPrice: 500 });
        expect(landInspection.compute(input, ctx).total).toBe(7500);
    });

    it('feeds BOQ K9 (labour of ค่าตรวจสอบที่ดิน); section 0 stays out of the construction total', () => {
        expect(landInspection.boqLinks).toEqual([{ line: 'R9', field: 'lab', output: 'total' }]);
        const project = createProject();
        project.calculators['land-inspection'] = {
            ...landInspection.defaults(),
            items: [{ label: 'ค่าแรงตรวจสอบที่ดิน', qty: 3, unit: 'วัน', unitPrice: 1500 }],
        };
        const base = computeProject(createProject(), [landInspection]);
        const r9 = base.boq.sections.find(s => s.no === 0)?.rows.find(r => r.key === 'R9') as BoqItemRow;
        expect(r9.labUnit).toBe(golden.lines.R9.K);
        expect(r9.total).toBe(golden.lines.R9.M);
        const changed = computeProject(project, [landInspection]);
        expect(changed.boq.sections.find(s => s.no === 0)?.total).toBe(4500);
        expect(changed.boq.constructionTotal).toBeCloseTo(base.boq.constructionTotal, 6);
    });
});
