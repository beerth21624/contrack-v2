import { describe, expect, it } from 'vitest';
import { landInspection } from '.';

describe('ค่าตรวจสอบที่ดิน (sheet 36)', () => {
    it('Excel sample: F14 ต้นทุนรวม = 7,500', () => {
        expect(landInspection.compute(landInspection.defaults(), { outputs: () => undefined }).total).toBe(7500);
    });

    it('extra rows are added to the total', () => {
        const input = landInspection.defaults();
        input.items.push({ label: 'ค่ารังวัด', qty: 1, unit: 'งาน', unitPrice: 3000 });
        expect(landInspection.compute(input, { outputs: () => undefined }).total).toBe(10500);
    });

    it('feeds BOQ K9 (labour of ค่าตรวจสอบที่ดิน)', () => {
        expect(landInspection.boqLinks).toEqual([{ line: 'R9', field: 'lab', output: 'total' }]);
    });
});
