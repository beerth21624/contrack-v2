// ─── Dev-mode trace labels of the site camp step (docs/dev-mode/README.md §5) ───
// Names follow the site camp page. Never mention the spreadsheet here.
import type { CalcTraceLabels, TraceLabelSet } from '../../trace/types';

// Same groups as CAMP_GROUPS in ./index (not imported: index imports this file).
const GROUPS = [
    { id: 'camp', rooms: 'workerRooms', th: 'แคมป์คนงาน', en: 'Worker camp' },
    { id: 'toilet', rooms: 'toilets', th: 'ห้องน้ำ', en: 'Toilets' },
    { id: 'shower', rooms: 'showers', th: 'ห้องอาบน้ำ', en: 'Shower rooms' },
    { id: 'store', rooms: 'stores', th: 'สโตร์เก็บของ', en: 'Storerooms' },
] as const;

const build = (lang: 'th' | 'en'): TraceLabelSet => {
    const th = lang === 'th';
    const terms: Record<string, string> = th ? {
        workerRooms: 'จำนวนห้องพักคนงาน', toilets: 'จำนวนห้องน้ำ', showers: 'จำนวนห้องอาบน้ำ', stores: 'จำนวนสโตร์เก็บของ',
        waste: 'เผื่อวัสดุสูญเสีย', labourRate: 'ค่าแรงติดตั้ง (% ของค่าวัสดุ)',
        code: 'รหัส', item: 'รายการวัสดุ', unit: 'หน่วย', baseQty: 'ปริมาณฐาน', basePer: 'ฐานต่อ (ห้อง)', unitPrice: 'ราคาต่อหน่วย', note: 'หมายเหตุ', group: 'หมวด',
        rooms: 'จำนวนที่กรอก', calcQty: 'ปริมาณคำนวณ', grossQty: 'ปริมาณรวมเผื่อ', total: 'รวมวัสดุ',
        mat: 'ค่าวัสดุของแต่ละหมวด', materialTotal: 'รวมค่าวัสดุ', labour: 'ค่าแรงติดตั้ง', grandTotal: 'รวมทั้งหมด',
    } : {
        workerRooms: 'Number of worker rooms', toilets: 'Number of toilets', showers: 'Number of shower rooms', stores: 'Number of storerooms',
        waste: 'Material wastage', labourRate: 'Installation labour (% of material cost)',
        code: 'Code', item: 'Material item', unit: 'Unit', baseQty: 'Base quantity', basePer: 'Base per (rooms)', unitPrice: 'Price per unit', note: 'Remark', group: 'Group',
        rooms: 'Quantity entered', calcQty: 'Calculated quantity', grossQty: 'Total with wastage', total: 'Material total',
        mat: 'Material cost of each group', materialTotal: 'Total material cost', labour: 'Installation labour', grandTotal: 'Grand total',
    };
    const units: Record<string, string> = th ? {
        workerRooms: 'ห้อง', toilets: 'ห้อง', showers: 'ห้อง', stores: 'ห้อง', waste: '%', labourRate: '%', basePer: 'ห้อง', unitPrice: 'บาท',
        total: 'บาท', mat: 'บาท', materialTotal: 'บาท', labour: 'บาท', grandTotal: 'บาท',
    } : {
        workerRooms: 'rooms', toilets: 'rooms', showers: 'rooms', stores: 'rooms', waste: '%', labourRate: '%', basePer: 'rooms', unitPrice: 'baht',
        total: 'baht', mat: 'baht', materialTotal: 'baht', labour: 'baht', grandTotal: 'baht',
    };
    const steps: Record<string, TraceLabelSet['steps'][string]> = th ? {
        rooms: { label: 'จำนวนห้องที่กรอกของหมวดนี้', formula: 'จำนวนห้องของหมวดของรายการนี้', unit: 'ห้อง' },
        calcQty: { label: 'ปริมาณคำนวณ', formula: '{baseQty} × {rooms} ÷ {basePer} (ฐานต่อ = 0 → 0)', unit: '' },
        grossQty: { label: 'ปริมาณรวมเผื่อ', formula: 'ปัดขึ้นเป็นจำนวนเต็ม({calcQty} × (1 + {waste}))', unit: '' },
        total: { label: 'รวมวัสดุ', formula: '{grossQty} × {unitPrice}', unit: 'บาท' },
        materialTotal: { label: 'รวมค่าวัสดุ', formula: 'Σ {mat}', unit: 'บาท' },
        labour: { label: 'ค่าแรงติดตั้ง', formula: '{materialTotal} × {labourRate}', unit: 'บาท' },
        grandTotal: { label: 'รวมทั้งหมด', formula: '{materialTotal} + {labour}', unit: 'บาท' },
    } : {
        rooms: { label: 'Rooms entered for this group', formula: 'number of rooms of this row\'s group', unit: 'rooms' },
        calcQty: { label: 'Calculated quantity', formula: '{baseQty} × {rooms} ÷ {basePer} (base per = 0 → 0)', unit: '' },
        grossQty: { label: 'Total with wastage', formula: 'round up to a whole number({calcQty} × (1 + {waste}))', unit: '' },
        total: { label: 'Material total', formula: '{grossQty} × {unitPrice}', unit: 'baht' },
        materialTotal: { label: 'Total material cost', formula: 'Σ {mat}', unit: 'baht' },
        labour: { label: 'Installation labour', formula: '{materialTotal} × {labourRate}', unit: 'baht' },
        grandTotal: { label: 'Grand total', formula: '{materialTotal} + {labour}', unit: 'baht' },
    };
    for (const g of GROUPS) {
        const name = th ? g.th : g.en;
        const rooms = terms[g.rooms] ?? g.rooms;
        terms[`mat_${g.id}`] = th ? `ค่าวัสดุ ${name}` : `Material cost: ${name}`;
        terms[`lab_${g.id}`] = th ? `ค่าแรงติดตั้ง ${name}` : `Installation labour: ${name}`;
        terms[`matPerRoom_${g.id}`] = th ? `ค่าวัสดุ ต่อห้อง ${name}` : `Material cost per room: ${name}`;
        terms[`labPerRoom_${g.id}`] = th ? `ค่าแรง ต่อห้อง ${name}` : `Labour per room: ${name}`;
        for (const k of ['mat', 'lab', 'matPerRoom', 'labPerRoom']) units[`${k}_${g.id}`] = th ? 'บาท' : 'baht';
        steps[`mat_${g.id}`] = th
            ? { label: `ค่าวัสดุ ${name}`, formula: `Σ {total} (รายการวัสดุของหมวด ${name})`, unit: 'บาท' }
            : { label: `Material cost: ${name}`, formula: `Σ {total} (material items of ${name})`, unit: 'baht' };
        steps[`lab_${g.id}`] = th
            ? { label: `ค่าแรงติดตั้ง ${name}`, formula: `{mat_${g.id}} × {labourRate}`, unit: 'บาท' }
            : { label: `Installation labour: ${name}`, formula: `{mat_${g.id}} × {labourRate}`, unit: 'baht' };
        steps[`matPerRoom_${g.id}`] = th
            ? { label: `ค่าวัสดุ ต่อห้อง ${name}`, formula: `{mat_${g.id}} ÷ {${g.rooms}} (${rooms} = 0 → 0)`, unit: 'บาท' }
            : { label: `Material cost per room: ${name}`, formula: `{mat_${g.id}} ÷ {${g.rooms}} (${rooms} = 0 → 0)`, unit: 'baht' };
        steps[`labPerRoom_${g.id}`] = th
            ? { label: `ค่าแรง ต่อห้อง ${name}`, formula: `{lab_${g.id}} ÷ {${g.rooms}} (${rooms} = 0 → 0)`, unit: 'บาท' }
            : { label: `Labour per room: ${name}`, formula: `{lab_${g.id}} ÷ {${g.rooms}} (${rooms} = 0 → 0)`, unit: 'baht' };
    }
    return { terms, units, steps };
};

export const SITE_CAMP_TRACE_LABELS: CalcTraceLabels = { th: build('th'), en: build('en') };
