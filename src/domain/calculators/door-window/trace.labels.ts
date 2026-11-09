// ─── Dev-mode trace labels of the door & window step (docs/dev-mode/README.md §5) ───
// Names follow the schedule page's column titles. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';

// Same values as WALL_PARTS / OPENING_WALL_TYPES / BRICK_THICKNESSES in ./index (not imported: index imports this file).
const WALL_PARTS = ['ผนังภายในบ้าน', 'ผนังรอบบ้าน', 'ผนังรอบบ้าน-พิเศษ', 'ผนังภายนอกบ้าน'];
const WALL_TYPES = ['อิฐมวลเบา', 'อิฐมอญ', 'ผนังเบา'];
const THICKNESSES = ['ครึ่งแผ่น', 'เต็มแผ่น'];

/** Output keys `opening|<wall part>|<brick>|<thickness>` (area to deduct from brick walls), named in plain words. */
const openingTerms = (lang: 'th' | 'en'): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const w of WALL_PARTS) for (const b of WALL_TYPES) for (const t of THICKNESSES) {
        out[`opening|${w}|${b}|${t}`] = lang === 'th'
            ? `พื้นที่ช่องเปิดหักผนัง ${w} · ${b} · ${t}`
            : `Opening area deducted from wall: ${w} · ${b} · ${t}`;
    }
    return out;
};
const openingUnits = (): Record<string, string> => Object.fromEntries(
    Object.keys(openingTerms('th')).map(k => [k, 'ตร.ม.']));
const openingUnitsEn = (): Record<string, string> => Object.fromEntries(
    Object.keys(openingTerms('th')).map(k => [k, 'sq.m.']));

export const DOOR_WINDOW_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            // inputs (row fields)
            name: 'รายการ',
            type: 'ชนิดบาน',
            wallPart: 'ส่วนผนัง',
            brick: 'อิฐ',
            thickness: 'ความหนา',
            count: 'จำนวน (บาน)',
            width: 'กว้าง',
            height: 'สูง',
            rate: 'อลูมิเนียม บาท/ตร.ม.',
            matPrice: 'ราคาวัสดุ ต่อชุด (ที่กรอกเอง)',
            labPrice: 'ค่าแรง ต่อชุด (ที่กรอกเอง)',
            // hard-coded constants
            woodMat: 'ราคาวัสดุบานไม้ ต่อชุด',
            woodLab: 'ค่าแรงบานไม้ ต่อชุด',
            // intermediate values
            area: 'พื้นที่ ต่อบาน',
            total: 'รวม (พื้นที่)',
            matUnit: 'ราคาวัสดุ ต่อชุด',
            labUnit: 'ค่าแรง ต่อชุด',
            amount: 'เป็นเงิน',
            woodCount: 'จำนวนบานไม้',
            // outputs
            R191: 'วงกบประตูไม้',
            'opening.total': 'พื้นที่ช่องเปิดรวม',
            'aluminium.count': 'จำนวนบานอลูมิเนียม',
            'aluminium.amount': 'ราคาบานอลูมิเนียม รวม',
            'wood.count': 'จำนวนบานไม้',
            'wood.amount': 'ราคาบานไม้ รวม',
            ...openingTerms('th'),
        },
        units: {
            count: 'บาน', width: 'ม.', height: 'ม.', rate: 'บาท/ตร.ม.', matPrice: 'บาท', labPrice: 'บาท',
            woodMat: 'บาท', woodLab: 'บาท', area: 'ตร.ม.', total: 'ตร.ม.', matUnit: 'บาท', labUnit: 'บาท', amount: 'บาท',
            woodCount: 'บาน', R191: 'ชุด', 'opening.total': 'ตร.ม.', 'aluminium.count': 'บาน', 'aluminium.amount': 'บาท',
            'wood.count': 'บาน', 'wood.amount': 'บาท',
            ...openingUnits(),
        },
        steps: {
            area: { label: 'พื้นที่ ต่อบาน', formula: '{width} × {height}', unit: 'ตร.ม.' },
            total: { label: 'พื้นที่รวม', formula: '{area} × {count}', unit: 'ตร.ม.' },
            matUnitTyped: { label: 'ราคาวัสดุ ต่อชุด (กรอกเอง)', formula: '{matPrice}', unit: 'บาท' },
            matUnitAlu: { label: 'ราคาวัสดุ ต่อชุด (อลูมิเนียม)', formula: '{width} × {height} × {rate}', unit: 'บาท' },
            matUnitWood: { label: 'ราคาวัสดุ ต่อชุด (บานไม้)', formula: '{woodMat}', unit: 'บาท' },
            matUnitNone: { label: 'ราคาวัสดุ ต่อชุด (ไม่ระบุชนิดบาน = 0)', formula: '0', unit: 'บาท' },
            labUnitTyped: { label: 'ค่าแรง ต่อชุด (กรอกเอง)', formula: '{labPrice}', unit: 'บาท' },
            labUnitWood: { label: 'ค่าแรง ต่อชุด (บานไม้)', formula: '{woodLab}', unit: 'บาท' },
            labUnitNone: { label: 'ค่าแรง ต่อชุด (ไม่คิดแยก = 0)', formula: '0', unit: 'บาท' },
            amount: { label: 'ราคารวมของรายการ', formula: '{count} × ({matUnit} + {labUnit})', unit: 'บาท' },
            opening: { label: 'พื้นที่ช่องเปิดหักผนัง ({wallPart} · {brick} · {thickness})', formula: 'Σ {total} (แถวที่ส่วนผนัง {wallPart} อิฐ {brick} ความหนา {thickness})', unit: 'ตร.ม.' },
            openingTotal: { label: 'พื้นที่ช่องเปิดรวม', formula: 'Σ {total}', unit: 'ตร.ม.' },
            aluminiumCount: { label: 'จำนวนบานอลูมิเนียม', formula: 'Σ {count} (เฉพาะบานอลูมิเนียม)', unit: 'บาน' },
            aluminiumAmount: { label: 'ราคาบานอลูมิเนียม รวม', formula: 'Σ {amount} (เฉพาะบานอลูมิเนียม)', unit: 'บาท' },
            woodCount: { label: 'จำนวนบานไม้', formula: 'Σ {count} (เฉพาะบานไม้)', unit: 'บาน' },
            woodAmount: { label: 'ราคาบานไม้ รวม', formula: 'Σ {amount} (เฉพาะบานไม้)', unit: 'บาท' },
            woodFrames: { label: 'วงกบประตูไม้ (นับทุกบานไม้ ทั้งประตูและหน้าต่าง)', formula: '{woodCount}', unit: 'ชุด' },
        },
    },
    en: {
        terms: {
            name: 'Item',
            type: 'Leaf type',
            wallPart: 'Wall part',
            brick: 'Brick',
            thickness: 'Thickness',
            count: 'Number of leaves',
            width: 'Width',
            height: 'Height',
            rate: 'Aluminium baht/sq.m.',
            matPrice: 'Material price per set (typed)',
            labPrice: 'Labour per set (typed)',
            woodMat: 'Wooden leaf material price per set',
            woodLab: 'Wooden leaf labour per set',
            area: 'Area per leaf',
            total: 'Total (area)',
            matUnit: 'Material price per set',
            labUnit: 'Labour per set',
            amount: 'Amount',
            woodCount: 'Number of wooden leaves',
            R191: 'Wooden door frames',
            'opening.total': 'Total opening area',
            'aluminium.count': 'Number of aluminium leaves',
            'aluminium.amount': 'Aluminium leaves, total price',
            'wood.count': 'Number of wooden leaves',
            'wood.amount': 'Wooden leaves, total price',
            ...openingTerms('en'),
        },
        units: {
            count: 'leaves', width: 'm', height: 'm', rate: 'baht/sq.m.', matPrice: 'baht', labPrice: 'baht',
            woodMat: 'baht', woodLab: 'baht', area: 'sq.m.', total: 'sq.m.', matUnit: 'baht', labUnit: 'baht', amount: 'baht',
            woodCount: 'leaves', R191: 'sets', 'opening.total': 'sq.m.', 'aluminium.count': 'leaves', 'aluminium.amount': 'baht',
            'wood.count': 'leaves', 'wood.amount': 'baht',
            ...openingUnitsEn(),
        },
        steps: {
            area: { label: 'Area per leaf', formula: '{width} × {height}', unit: 'sq.m.' },
            total: { label: 'Total area', formula: '{area} × {count}', unit: 'sq.m.' },
            matUnitTyped: { label: 'Material price per set (typed)', formula: '{matPrice}', unit: 'baht' },
            matUnitAlu: { label: 'Material price per set (aluminium)', formula: '{width} × {height} × {rate}', unit: 'baht' },
            matUnitWood: { label: 'Material price per set (wooden leaf)', formula: '{woodMat}', unit: 'baht' },
            matUnitNone: { label: 'Material price per set (no leaf type = 0)', formula: '0', unit: 'baht' },
            labUnitTyped: { label: 'Labour per set (typed)', formula: '{labPrice}', unit: 'baht' },
            labUnitWood: { label: 'Labour per set (wooden leaf)', formula: '{woodLab}', unit: 'baht' },
            labUnitNone: { label: 'Labour per set (not charged separately = 0)', formula: '0', unit: 'baht' },
            amount: { label: 'Amount of the item', formula: '{count} × ({matUnit} + {labUnit})', unit: 'baht' },
            opening: { label: 'Opening area deducted from wall ({wallPart} · {brick} · {thickness})', formula: 'Σ {total} (rows with wall part {wallPart}, brick {brick}, thickness {thickness})', unit: 'sq.m.' },
            openingTotal: { label: 'Total opening area', formula: 'Σ {total}', unit: 'sq.m.' },
            aluminiumCount: { label: 'Number of aluminium leaves', formula: 'Σ {count} (aluminium leaves only)', unit: 'leaves' },
            aluminiumAmount: { label: 'Aluminium leaves, total price', formula: 'Σ {amount} (aluminium leaves only)', unit: 'baht' },
            woodCount: { label: 'Number of wooden leaves', formula: 'Σ {count} (wooden leaves only)', unit: 'leaves' },
            woodAmount: { label: 'Wooden leaves, total price', formula: 'Σ {amount} (wooden leaves only)', unit: 'baht' },
            woodFrames: { label: 'Wooden door frames (every wooden leaf, doors and windows)', formula: '{woodCount}', unit: 'sets' },
        },
    },
};
