// Sheet "งานรื้อถอน_Site Preparation" (Excel v5 sheet 35) → BOQ (Home) section 1, row 12.
// Spec: docs/excel-spec/01-boq-home-and-steps-00-05.md, Section 1 (b-1).
import type { BoqLineKey } from '../../boq/types';
import { defineCalculator } from '../types';

export interface DemolitionLine {
    label: string;    // B รายการ
    unit: string;     // C หน่วย
    qty: number;      // D ปริมาณ (input)
    rate: number;     // E Rate (input) = ค่าแรง + เครื่องมือพื้นฐาน + ค่าใช้จ่ายเบื้องต้นต่อหน่วย
    check: string;    // G รายละเอียดที่ต้องตรวจสอบ (hint)
}

export interface DemolitionInput {
    /** Rows 4–10 of the sheet plus any rows the user adds (Excel has no free rows; decision D5: unlimited). */
    items: DemolitionLine[];
}

/** The 7 fixed rows of the sheet (A4:G10). D and E are blank in Excel v5. */
export const DEMOLITION_FIXED_ITEMS: readonly Omit<DemolitionLine, 'qty' | 'rate'>[] = [
    { label: 'รื้อถอนอาคาร/สิ่งปลูกสร้างเดิม', unit: 'ตร.ม.', check: 'ประเภท / จำนวนชั้น / พื้นที่' },
    { label: 'รื้อถอนต้นไม้', unit: 'ต้น', check: 'ขนาดต้น / จำนวน' },
    { label: 'รื้อถอนท่อระบายน้ำ', unit: 'ม.', check: 'ขนาดท่อ / ความยาว' },
    { label: 'รื้อรั้ว / กำแพง', unit: 'ตร.ม.', check: 'ประเภท / ความสูง / ความยาว' },
    { label: 'รื้อถนน / พื้นภายนอก', unit: 'ตร.ม.', check: 'คอนกรีต / Asphalt' },
    { label: 'เคลียร์พื้นที่ / เปิดหน้าดิน', unit: 'ตร.ม.', check: 'พื้นที่รวม' },
    { label: 'ขนขยะทิ้ง', unit: 'เที่ยว', check: 'จำนวนเที่ยวรถ' },
];

const num = (v: number) => (Number.isFinite(v) ? v : 0);

/** F = D × E. Excel v5 holds a static 0 here (no formula); the intended formula is built (decision D1). */
export const lineTotal = (l: DemolitionLine) => num(l.qty) * num(l.rate);

export const demolitionTotal = (items: DemolitionLine[]) => items.reduce((s, l) => s + lineTotal(l), 0);

export const demolition = defineCalculator<DemolitionInput>({
    id: 'demolition',
    sheetName: 'งานรื้อถอน_Site Preparation',
    title: 'โปรแกรมถอดแบบ – งานรื้อถอน_Site Preparation',
    titleEn: 'Demolition / Site Preparation',
    sections: [1],
    deps: [],
    defaults: () => ({
        items: DEMOLITION_FIXED_ITEMS.map(i => ({ ...i, qty: 0, rate: 0 })),
    }),
    compute: (input) => {
        // F11 รวมทั้งหมด = SUM(F4:F10) (static 0 in Excel v5)
        const total = demolitionTotal(input.items);
        return {
            total,
            // BOQ E12 is a typed 0 เหมา in Excel. Linked as 1 เหมา only when there is demolition work,
            // so an empty list keeps the row (and section 1) at 0 like Excel.
            boqQty: total > 0 ? 1 : 0,
        };
    },
    // Excel does not link F11 into the BOQ; decision D3 links it to K12 (labour) — the rate is
    // labour + basic tools + incidentals per unit.
    boqLinks: [
        { line: 'R12', field: 'qty', output: 'boqQty' },
        { line: 'R12', field: 'lab', output: 'total' },
    ],
    // The template note "ไม่มีงานรื้อถอน" is only true while the list is empty; clear it otherwise.
    boqText: (input): Record<BoqLineKey, { note?: string }> =>
        (demolitionTotal(input.items) > 0 ? { R12: { note: '' } } : {}),
});
