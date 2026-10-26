// Sheet "ค่าตรวจสอบที่ดิน" (Excel v5 sheet 36) → BOQ (Home) section 0, row 9.
// Spec: docs/excel-spec/01-boq-home-and-steps-00-05.md, Section 0.
import { defineCalculator } from '../types';

export interface CostLine {
    label: string;        // รายการค่าใช้จ่าย
    qty: number;          // จำนวน
    unit: string;         // หน่วย
    unitPrice: number;    // ราคาต่อหน่วย
    note?: string;        // หมายเหตุ
}

export interface ChecklistAnswer {
    done: boolean;
    note: string;
}

export interface LandInspectionInput {
    projectName: string;  // C4 ชื่อโครงการ
    province: string;     // F4 จังหวัด
    surveyDate: string;   // C5 วันที่เข้าสำรวจ
    inspector: string;    // F5 ผู้ตรวจสอบ
    /** Rows 8–11 of the sheet plus any rows the user adds (Excel has one "+ เพิ่ม" row; decision D5: unlimited). */
    items: CostLine[];
    /** Site-inspection checklist (Google Doc linked from G8), one answer per CHECKLIST item. */
    checklist: ChecklistAnswer[];
}

/** The 5 questions of the linked site-inspection checklist (deck p4). */
export const LAND_INSPECTION_CHECKLIST = [
    'ที่ดินอยู่ตรงไหน',
    'เข้าใช้ได้หรือไม่',
    'แนวเขตถูกต้องหรือไม่',
    'มีหมุดอ้างอิงหรือไม่',
    'มีข้อมูลเพียงพอสำหรับเริ่มงานหรือไม่',
] as const;

export const lineTotal = (l: CostLine) => (Number.isFinite(l.qty) ? l.qty : 0) * (Number.isFinite(l.unitPrice) ? l.unitPrice : 0);

/** Excel v5 sample (rows 4–11). */
const sample = (): LandInspectionInput => ({
    projectName: '',
    province: '',
    surveyDate: '',
    inspector: '',
    items: [
        { label: 'ค่าแรงตรวจสอบที่ดิน', qty: 2, unit: 'วัน', unitPrice: 1500, note: 'เอกสารสำรวจหน้างาน' },
        { label: 'ค่าเดินทาง', qty: 1, unit: 'เที่ยว', unitPrice: 2500 },
        { label: 'ค่าที่พัก', qty: 1, unit: 'คืน', unitPrice: 1200 },
        { label: 'ค่าอุปกรณ์สำรวจ / เอกสาร', qty: 1, unit: 'งาน', unitPrice: 800 },
    ],
    checklist: LAND_INSPECTION_CHECKLIST.map(() => ({ done: false, note: '' })),
});

export const landInspection = defineCalculator<LandInspectionInput>({
    id: 'land-inspection',
    sheetName: 'ค่าตรวจสอบที่ดิน',
    title: 'โปรแกรมคำนวณค่าตรวจสอบที่ดิน',
    titleEn: 'Land Inspection Cost',
    sections: [0],
    deps: [],
    defaults: sample,
    // Nothing on this sheet is read off the plan: the 4 cost lines are a standard inspection lump sum
    // (2 วัน, 1 เที่ยว, 1 คืน, 1 งาน at the Excel prices = 7,500), so a blank project keeps them. The text
    // fields and checklist are already empty in the Excel sample.
    blank: sample,
    compute: (input) => ({
        // F14 ต้นทุนรวม = SUM(F8:F12)
        total: input.items.reduce((s, l) => s + lineTotal(l), 0),
    }),
    // Excel retypes F14 into BOQ K9 (labour, 1 เหมา); decision D3 links it.
    boqLinks: [{ line: 'R9', field: 'lab', output: 'total' }],
});
