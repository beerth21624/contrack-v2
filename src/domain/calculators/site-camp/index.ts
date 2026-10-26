// External Google Sheet "โปรแกรมคำนวณวัสดุแคมป์คนงาน / ห้องน้ำ / ห้องอาบน้ำ / สโตร์เก็บของ" (rId2,
// linked from BOQ (Home) C18) → BOQ section 3, rows 19–22.
// The sheet was not supplied (decision D8): reconstructed from review deck p16.
// Spec: docs/excel-spec/01-boq-home-and-steps-00-05.md, Section 3.
import { roundUp } from '../../boq/engine';
import { defineCalculator } from '../types';

/** หมวด of the take-off table. Each group takes its room count from one input. */
export type CampGroupId = 'camp' | 'toilet' | 'shower' | 'store';

export interface CampGroupDef {
    id: CampGroupId;
    /** หมวด as written in the sheet. */
    label: string;
    /** Input holding this group's room count (จำนวนที่กรอก). */
    rooms: 'workerRooms' | 'toilets' | 'showers' | 'stores';
    /** BOQ (Home) row the room count fills. */
    boqLine: 'R19' | 'R20' | 'R21' | 'R22';
    boqDesc: string;
}

export const CAMP_GROUPS: readonly CampGroupDef[] = [
    { id: 'camp', label: 'แคมป์คนงาน', rooms: 'workerRooms', boqLine: 'R19', boqDesc: 'ห้องพักคนงาน' },
    { id: 'toilet', label: 'ห้องน้ำ', rooms: 'toilets', boqLine: 'R20', boqDesc: 'ห้องน้ำคนงาน' },
    { id: 'shower', label: 'ห้องอาบน้ำ', rooms: 'showers', boqLine: 'R21', boqDesc: 'ห้องอาบน้ำ' },
    { id: 'store', label: 'สโตร์เก็บของ', rooms: 'stores', boqLine: 'R22', boqDesc: 'สโตร์เก็บของ' },
];

/** One row of the material take-off table. */
export interface CampMaterialLine {
    group: CampGroupId;   // หมวด
    code: string;         // รหัส
    item: string;         // รายการวัสดุ
    unit: string;         // หน่วย
    baseQty: number;      // ปริมาณฐาน (for the sample rooms)
    basePer: number;      // ฐานต่อ (rooms the base qty covers)
    unitPrice: number;    // ราคาต่อหน่วย
    note?: string;        // หมายเหตุ
}

export interface SiteCampInput {
    workerRooms: number;  // จำนวนห้องพักคนงาน
    toilets: number;      // จำนวนห้องน้ำ
    showers: number;      // จำนวนห้องอาบน้ำ
    stores: number;       // จำนวนสโตร์เก็บของ
    waste: number;        // เผื่อวัสดุสูญเสีย (fraction)
    labourRate: number;   // ค่าแรงติดตั้ง (% ของค่าวัสดุ, fraction)
    /** Take-off rows (D5: unlimited). The deck screenshot is cut off: ห้องอาบน้ำ / สโตร์ rows are not known yet. */
    materials: CampMaterialLine[];
}

const num = (v: number) => (Number.isFinite(v) ? v : 0);

export function groupRooms(input: SiteCampInput, group: CampGroupId): number {
    const g = CAMP_GROUPS.find(x => x.id === group);
    return g ? num(input[g.rooms]) : 0;
}

export interface CampLineResult {
    rooms: number;        // จำนวนที่กรอก
    calcQty: number;      // ปริมาณคำนวณ = ปริมาณฐาน × จำนวนที่กรอก ÷ ฐานต่อ
    grossQty: number;     // ปริมาณรวมเผื่อ = ROUNDUP(ปริมาณคำนวณ × (1 + เผื่อ), 0)
    total: number;        // รวมวัสดุ = ปริมาณรวมเผื่อ × ราคาต่อหน่วย
}

export function campLine(line: CampMaterialLine, input: SiteCampInput): CampLineResult {
    const rooms = groupRooms(input, line.group);
    const basePer = num(line.basePer);
    const calcQty = basePer === 0 ? 0 : num(line.baseQty) * rooms / basePer;
    const grossQty = roundUp(calcQty * (1 + num(input.waste)));
    return { rooms, calcQty, grossQty, total: grossQty * num(line.unitPrice) };
}

const row = (group: CampGroupId, code: string, item: string, unit: string, baseQty: number, basePer: number,
    unitPrice: number, note?: string): CampMaterialLine => ({ group, code, item, unit, baseQty, basePer, unitPrice, note });

export const siteCamp = defineCalculator<SiteCampInput>({
    id: 'site-camp',
    // The real sheet name is unknown (external file, D8).
    sheetName: 'Google Sheet ภายนอก — แคมป์คนงาน (สร้างจากภาพสไลด์)',
    title: 'โปรแกรมคำนวณวัสดุแคมป์คนงาน / ห้องน้ำ / ห้องอาบน้ำ / สโตร์เก็บของ',
    titleEn: 'Site Camp Materials',
    sections: [3],
    deps: [],
    defaults: () => ({
        workerRooms: 4,
        toilets: 2,
        showers: 1,
        stores: 1,
        waste: 0.05,
        labourRate: 0.2,
        materials: [
            row('camp', 'PLY15', 'ไม้อัดดำ 4x8 ฟุต หนา 15 มม.', 'แผ่น', 12, 4, 550, 'ฐาน 4 ห้อง'),
            row('camp', 'EUCALYPTUS', 'ไม้ยูคา 2.5 นิ้ว x 3 ม.', 'ท่อน', 200, 4, 55),
            row('camp', 'ZINC6', 'สังกะสี 66.5 ซม. x 6 ฟุต (หลังคา)', 'แผ่น', 55, 4, 150),
            row('camp', 'ZINC7', 'สังกะสี 66.5 ซม. x 7 ฟุต (ผนัง)', 'แผ่น', 15, 4, 170),
            row('camp', 'ZINC8', 'สังกะสี 66.5 ซม. x 8 ฟุต', 'แผ่น', 15, 4, 190),
            row('camp', 'NAIL3X10_BOX', 'ตะปู 3 x 10 (กล่อง 18 กก.)', 'กล่อง', 1, 4, 850),
            row('camp', 'NAIL15_BOX', 'ตะปู 1-1/2 x 14 (ถุง 1 กก.)', 'กล่อง', 3, 4, 60),
            row('camp', 'ZINC_NAIL', 'ตะปูตอกสังกะสี 1-3/4 นิ้ว x 13 (กล่อง 0.154 กก.)', 'กล่อง', 5, 4, 35),
            row('camp', 'STRING60', 'สายเอ็น สีเขียว #60', 'ม้วน', 2, 4, 45),
            row('toilet', 'EUCALYPTUS', 'ไม้ยูคา 2.5 นิ้ว x 3 ม.', 'ท่อน', 13, 2, 55, 'ฐาน 2 ห้อง'),
            row('toilet', 'ZINC6', 'สังกะสี 66.5 ซม. x 6 ฟุต', 'แผ่น', 3, 2, 150),
            row('toilet', 'ZINC7', 'สังกะสี 66.5 ซม. x 7 ฟุต', 'แผ่น', 11, 2, 170),
            row('toilet', 'CONCRETE_RING80', 'วงส้วม ขนาด 80 ซม.', 'วง', 4, 2, 280),
            row('toilet', 'RING_COVER80', 'ฝาปิดวงส้วม ขนาด 80 ซม.', 'อัน', 2, 2, 160),
            row('toilet', 'TOILET_FLAT', 'ส้วมนั่งราบ', 'ตัว', 2, 2, 850),
            row('toilet', 'CEMENT_TPI50', 'ปูนเขียว TPI 50 กก.', 'ถุง', 2, 2, 165),
            row('toilet', 'SAND25', 'ทรายหยาบ ถุง 25 กก.', 'ถุง', 10, 2, 45),
            row('toilet', 'STONE25', 'หิน 3/4 ถุง 25 กก.', 'ถุง', 6, 2, 55),
            row('toilet', 'FAUCET12', 'ก๊อกน้ำ 1/2 นิ้ว', 'อัน', 2, 2, 120),
            row('toilet', 'PVC12_PIPE', 'ท่อหนา PVC 1/2 นิ้ว', 'เส้น', 2, 2, 85),
            row('toilet', 'PVC12_FEMALE_ELBOW', 'ข้องอเกลียวใน หนา PVC 1/2 นิ้ว', 'ตัว', 1, 2, 25),
            row('toilet', 'PVC12_TEE', 'สามทาง หนา PVC 1/2 นิ้ว', 'อัน', 2, 2, 18),
        ],
    }),
    compute: (input) => {
        const out: Record<string, number> = {
            workerRooms: num(input.workerRooms),
            toilets: num(input.toilets),
            showers: num(input.showers),
            stores: num(input.stores),
        };
        const rate = num(input.labourRate);
        let materialTotal = 0;
        for (const g of CAMP_GROUPS) {
            const mat = input.materials.filter(l => l.group === g.id).reduce((s, l) => s + campLine(l, input).total, 0);
            const lab = mat * rate;
            const rooms = num(input[g.rooms]);
            materialTotal += mat;
            out[`mat_${g.id}`] = mat;
            out[`lab_${g.id}`] = lab;
            // Per-room prices: what BOQ I/K of the group's row would be once the full sheet is supplied.
            out[`matPerRoom_${g.id}`] = rooms === 0 ? 0 : mat / rooms;
            out[`labPerRoom_${g.id}`] = rooms === 0 ? 0 : lab / rooms;
        }
        out.materialTotal = materialTotal;
        out.labour = materialTotal * rate;          // ค่าแรงติดตั้ง = 20% ของค่าวัสดุ
        out.total = out.materialTotal + out.labour;
        return out;
    },
    // Only the room counts are linked (D3). The BOQ prices 7,000 / 4,700 / 4,500 / 7,000 stay as typed in
    // Excel: the take-off is incomplete (ห้องอาบน้ำ / สโตร์ cut off in the deck), see D8.
    boqLinks: CAMP_GROUPS.map(g => ({ line: g.boqLine, field: 'qty' as const, output: g.rooms })),
});
