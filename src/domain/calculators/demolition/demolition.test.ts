import { describe, expect, it } from 'vitest';
import { demolition, DEMOLITION_FIXED_ITEMS, lineTotal, type DemolitionInput } from '.';
import { fill } from '../fill';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };

/** Sets qty / rate of row i (0-based) of the sample list. */
const withRow = (input: DemolitionInput, i: number, qty: number, rate: number): DemolitionInput => ({
    ...input,
    items: input.items.map((l, j) => (j === i ? { ...l, qty, rate } : l)),
});

const r12 = (calcInput?: unknown) => {
    const project = createProject();
    if (calcInput !== undefined) project.calculators.demolition = calcInput;
    const res = computeProject(project, [demolition, fill]);
    const sec = res.boq.sections.find(s => s.no === 1);
    const row = sec?.rows.find(r => r.key === 'R12') as BoqItemRow;
    return { row, section: sec };
};

describe('งานรื้อถอน_Site Preparation (sheet 35)', () => {
    it('Excel sample: 7 fixed rows, F4:F10 = 0, F11 รวมทั้งหมด = 0', () => {
        const input = demolition.defaults();
        expect(input.items.map(i => i.label)).toEqual([
            'รื้อถอนอาคาร/สิ่งปลูกสร้างเดิม', 'รื้อถอนต้นไม้', 'รื้อถอนท่อระบายน้ำ', 'รื้อรั้ว / กำแพง',
            'รื้อถนน / พื้นภายนอก', 'เคลียร์พื้นที่ / เปิดหน้าดิน', 'ขนขยะทิ้ง',
        ]);
        expect(input.items.map(i => i.unit)).toEqual(['ตร.ม.', 'ต้น', 'ม.', 'ตร.ม.', 'ตร.ม.', 'ตร.ม.', 'เที่ยว']);
        expect(input.items).toHaveLength(DEMOLITION_FIXED_ITEMS.length);
        input.items.forEach(l => expect(lineTotal(l)).toBe(0));
        expect(demolition.compute(input, ctx)).toEqual({ total: 0, boqQty: 0 });
    });

    it('Excel sample feeds BOQ R12 like Excel: E12 = 0, K12 = 0, note kept', () => {
        const { row, section } = r12();
        expect(row.qty).toBe(golden.lines.R12.E);
        expect(row.labUnit).toBe(golden.lines.R12.K);
        expect(row.total).toBe(golden.lines.R12.M);
        expect(row.note).toBe('ไม่มีงานรื้อถอน');
        expect(section?.total).toBeCloseTo(golden.sections['1'].M, 2);
    });

    it('F = D × E and F11 = Σ, including added rows', () => {
        // 3 ต้น × 1,500 = 4,500; 4 เที่ยว × 2,500 = 10,000; added row 1 จุด × 3,000
        const input = withRow(withRow(demolition.defaults(), 1, 3, 1500), 6, 4, 2500);
        input.items.push({ label: 'รื้อบ่อเกรอะเดิม', unit: 'จุด', qty: 1, rate: 3000, check: '' });
        expect(input.items.map(lineTotal)).toEqual([0, 4500, 0, 0, 0, 0, 10000, 3000]);
        expect(demolition.compute(input, ctx)).toEqual({ total: 17500, boqQty: 1 });
    });

    it('a non-empty list becomes BOQ R12 = 1 เหมา × labour total, and clears "ไม่มีงานรื้อถอน"', () => {
        const { row, section } = r12(withRow(demolition.defaults(), 0, 50, 350));   // 50 ตร.ม. × 350 = 17,500
        expect(row.qty).toBe(1);
        expect(row.labUnit).toBe(17500);
        expect(row.labTotal).toBe(17500);
        expect(row.matTotal).toBe(0);
        expect(row.fromCalc).toEqual({ qty: true, mat: false, lab: true });
        expect(row.note).toBe('');
        expect(section?.total).toBe(17500);
    });

    it('blank / invalid cells count as 0', () => {
        expect(demolition.compute(withRow(demolition.defaults(), 0, Number.NaN, 100), ctx).total).toBe(0);
    });

    it('blank project: the 7 kinds of work at 0, BOQ R12 and section 1 at 0', () => {
        const blank = demolition.blank?.();
        expect(blank).toBeDefined();
        if (!blank) return;
        expect(blank.items.map(i => i.label)).toEqual(DEMOLITION_FIXED_ITEMS.map(i => i.label));
        const out = demolition.compute(blank, ctx);
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
        expect(out).toEqual({ total: 0, boqQty: 0 });
        const res = computeProject(createProject('blank'), [demolition, fill]);
        const sec = res.boq.sections.find(s => s.no === 1);
        expect((sec?.rows.find(r => r.key === 'R12') as BoqItemRow).total).toBe(0);
        expect(sec?.total).toBe(0);
    });

    it('links F11 to BOQ R12 as qty flag + labour', () => {
        expect(demolition.boqLinks).toEqual([
            { line: 'R12', field: 'qty', output: 'boqQty' },
            { line: 'R12', field: 'lab', output: 'total' },
        ]);
    });
});
