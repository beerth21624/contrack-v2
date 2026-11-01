// ─── English overlay of the required-value list (docs/erp/03-i18n.md §9) ───
// requirements.ts builds Thai labels (`<card title> — <field>`, or a fixed "add at least one" sentence). The list on
// screen translates the pieces: field names and fixed sentences by lookup, card titles by pattern (a name the user
// typed is kept as typed). Pure; unknown text falls back to the Thai original.
import type { MissingValue } from './requirements';

const FIELD_EN: Readonly<Record<string, string>> = {
    'ชื่อโครงการ': 'Project name',
    'ค่ารื้อต่อหน่วย': 'Demolition rate per unit',
    'ความกว้างพื้นที่ถม': 'Fill area width',
    'ความยาวพื้นที่ถม': 'Fill area length',
    'ความสูงถม': 'Fill height',
    'ชนิดเสาเข็ม': 'Pile type',
    'หน้าตัด/รูปทรง': 'Section / shape',
    'ความยาว': 'Length',
    'จำนวนต้น': 'Number of units',
    'จำนวนฐานแบบนี้': 'Number of footings of this type',
    'ความกว้าง': 'Width',
    'ความหนาฐาน': 'Footing thickness',
    'ความลึกหลุมขุด': 'Excavation depth',
    'ตั้งอยู่บนฐานราก': 'Sits on footing',
    'ความสูง': 'Height',
    'ความลึก': 'Depth',
    'ความยาวรวมทุกช่วง': 'Total length of all spans',
    'ความหนา': 'Thickness',
    'ความกว้างช่วง': 'Span width',
    'ความยาวช่วง': 'Span length',
    'ความสูงเสา': 'Column height',
    'ความยาวรวม': 'Total length',
    'จำนวนขั้น': 'Number of steps',
    'ความกว้างบันได': 'Stair width',
    'พื้นที่หลังคาตามแนวราบ': 'Roof area on plan',
    'ความชันหลังคา': 'Roof slope',
    'จำนวน': 'Quantity',
    'ท่อสายเมน': 'Main cable conduit',
    'สายเมนวงจร': 'Circuit main cable',
    'สายเข้าโคม / จุด': 'Cable to luminaire / point',
    'จำนวนสาย': 'Number of conductors',
    'ชนิดฝ้า': 'Ceiling type',
    'ระยะยื่นชายคา': 'Eave overhang',
    'กว้าง': 'Width',
    'ยาว': 'Length',
    'ความยาวรอบชายคา': 'Eave perimeter length',
    'ชนิดพื้น': 'Floor type',
    'ความกว้างพื้น': 'Floor width',
    'ความยาวพื้น': 'Floor length',
    'ความยาวรอบห้อง': 'Room perimeter length',
    'ความสูงกระเบื้องผนัง': 'Wall tile height',
    'สูง': 'Height',
};

const FIXED_EN: Readonly<Record<string, string>> = {
    'เพิ่มฐานรากอย่างน้อย 1 รายการ': 'Add at least 1 footing',
    'เพิ่มคานคอดินอย่างน้อย 1 รายการ': 'Add at least 1 ground beam',
    'เพิ่มพื้นหล่อในที่อย่างน้อย 1 ผืน': 'Add at least 1 cast-in-place slab',
    'เพิ่มเสาอย่างน้อย 1 รายการ': 'Add at least 1 column',
    'เพิ่มคานดาดฟ้า / คานหลังคาอย่างน้อย 1 รายการ': 'Add at least 1 roof deck / roof beam',
    'เพิ่มประตูหรือหน้าต่างอย่างน้อย 1 รายการ': 'Add at least 1 door or window',
    'เพิ่มผนังก่ออิฐอย่างน้อย 1 รายการ': 'Add at least 1 brick wall',
    'เพิ่มวงจรไฟฟ้าอย่างน้อย 1 วงจร': 'Add at least 1 electrical circuit',
    'ระบุอุปกรณ์ตู้ควบคุมไฟฟ้าพร้อมจำนวนอย่างน้อย 1 รายการ': 'Enter at least 1 consumer unit item with a quantity',
    'ระบุอุปกรณ์ไฟฟ้าพร้อมจำนวนอย่างน้อย 1 รายการ': 'Enter at least 1 electrical fitting with a quantity',
    'กรอกความยาวท่อน้ำทิ้งอย่างน้อย 1 แนว': 'Enter the length of at least 1 waste pipe run',
    'กรอกความยาวท่อน้ำดีอย่างน้อย 1 แนว': 'Enter the length of at least 1 water supply pipe run',
    'ระบุสุขภัณฑ์พร้อมจำนวนอย่างน้อย 1 รายการ': 'Enter at least 1 sanitary ware item with a quantity',
    'เพิ่มฝ้าเพดานอย่างน้อย 1 ห้อง': 'Add at least 1 ceiling room',
    'เพิ่มพื้นปูกระเบื้องอย่างน้อย 1 ห้อง': 'Add at least 1 tiled floor room',
};

/** Card titles the code builds (`prefix + name`, `fallback n`); a typed name matches none of these and stays. */
const TITLE_RULES: readonly [RegExp, (m: RegExpExecArray) => string][] = [
    [/^ฐานราก (.+)$/, m => `Footing ${titleEn(m[1] ?? '')}`],
    [/^เสาตอม่อ (.+)$/, m => `Pedestal ${titleEn(m[1] ?? '')}`],
    [/^คานคอดิน (.+)$/, m => `Ground beam ${titleEn(m[1] ?? '')}`],
    [/^เสา (.+)$/, m => `Column ${titleEn(m[1] ?? '')}`],
    [/^คาน (.+)$/, m => `Beam ${m[1] ?? ''}`],
    [/^(.+) \(ลำดับที่ (\d+)\)$/, m => `${titleEn(m[1] ?? '')} (no. ${m[2] ?? ''})`],
    [/^แบบที่ (\d+)$/, m => `Type ${m[1] ?? ''}`],
    [/^คานที่ (\d+)$/, m => `Beam ${m[1] ?? ''}`],
    [/^ผืนที่ (\d+)$/, m => `Slab ${m[1] ?? ''}`],
    [/^ช่วงที่ (\d+)$/, m => `Span ${m[1] ?? ''}`],
    [/^บันได (\d+)$/, m => `Stair ${m[1] ?? ''}`],
    [/^ประตูที่ (\d+)$/, m => `Door ${m[1] ?? ''}`],
    [/^หน้าต่างที่ (\d+)$/, m => `Window ${m[1] ?? ''}`],
    [/^ประตู (.+)$/, m => `Door ${m[1] ?? ''}`],
    [/^หน้าต่าง (.+)$/, m => `Window ${m[1] ?? ''}`],
    [/^ผนังที่ (\d+)$/, m => `Wall ${m[1] ?? ''}`],
    [/^วงจรที่ (\d+)$/, m => `Circuit ${m[1] ?? ''}`],
    [/^ห้องที่ (\d+)$/, m => `Room ${m[1] ?? ''}`],
    [/^ห้องน้ำที่ (\d+)$/, m => `Bathroom ${m[1] ?? ''}`],
    [/^บัวที่ (\d+)$/, m => `Moulding ${m[1] ?? ''}`],
    [/^ผนังระแนงที่ (\d+)$/, m => `Slat wall ${m[1] ?? ''}`],
    [/^รายการที่ (\d+)$/, m => `Item ${m[1] ?? ''}`],
];

function titleEn(title: string): string {
    for (const [re, fn] of TITLE_RULES) {
        const m = re.exec(title);
        if (m) return fn(m);
    }
    return title;
}

/** The list text of a missing value in English: `card — field`, a field alone, or a fixed sentence. */
export function missingLabelEn(m: MissingValue): string {
    if (m.item !== undefined && m.field !== undefined) return `${titleEn(m.item)} — ${FIELD_EN[m.field] ?? m.field}`;
    if (m.field !== undefined) return FIELD_EN[m.field] ?? m.field;
    return FIXED_EN[m.label] ?? m.label;
}

/** The list text of a missing value in the UI locale. */
export const missingLabel = (m: MissingValue, locale: string): string => (locale === 'en' ? missingLabelEn(m) : m.label);
