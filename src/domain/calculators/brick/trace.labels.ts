// ─── Dev-mode trace labels of the brick step (docs/dev-mode/README.md §5) ───
// Names follow the brick page's column titles. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';

/**
 * An input's term is its path without array indexes (`walls.length`), the formulas use the bare field name
 * (`length`): every name is also known with the `walls.` prefix so both resolve.
 */
const withPrefix = (labels: CalcTraceLabels, prefix: string): CalcTraceLabels => {
    const alias = (t: Record<string, string>): Record<string, string> => ({
        ...Object.fromEntries(Object.entries(t).filter(([k]) => !k.includes('*')).map(([k, v]) => [`${prefix}.${k}`, v])),
        ...t,
    });
    const set = (l: CalcTraceLabels['th']): CalcTraceLabels['th'] => ({
        ...l, terms: alias(l.terms), ...(l.units ? { units: alias(l.units) } : {}),
    });
    return { th: set(labels.th), en: set(labels.en) };
};

const WALL_PARTS = ['ผนังภายในบ้าน', 'ผนังรอบบ้าน', 'ผนังรอบบ้าน-พิเศษ', 'ผนังภายนอกบ้าน'];
const WALL_TYPES = ['อิฐมวลเบา', 'อิฐมอญ', 'ผนังเบา'];
const THICKNESSES = ['ครึ่งแผ่น', 'เต็มแผ่น'];

/** Opening areas read from the door & window step: keys `opening|<wall part>|<brick>|<thickness>`. */
const openingTerms = (lang: 'th' | 'en'): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const w of WALL_PARTS) for (const b of WALL_TYPES) for (const t of THICKNESSES) {
        out[`opening|${w}|${b}|${t}`] = lang === 'th'
            ? `พื้นที่ช่องเปิด (จากประตู-หน้าต่าง) ${w} · ${b} · ${t}`
            : `Opening area (from doors & windows): ${w} · ${b} · ${t}`;
    }
    return out;
};
const openingUnits = (unit: string): Record<string, string> =>
    Object.fromEntries(Object.keys(openingTerms('th')).map(k => [k, unit]));

const BASE: CalcTraceLabels = {
    th: {
        terms: {
            // inputs (row fields)
            wallPart: 'ส่วนผนัง',
            brickType: 'ชนิดอิฐ',
            thickness: 'ความหนา',
            length: 'ความยาว',
            height: 'ความสูง',
            shape: 'รูปผนัง',
            // hard-coded constants
            triangleFactor: 'ตัวคูณพื้นที่ผนังสามเหลี่ยม (จั่ว) = ครึ่งหนึ่ง',
            // intermediate values used in formulas
            area: 'พื้นที่ผนัง',
            openings: 'พื้นที่ช่องเปิด',
            net: 'พื้นที่ก่อ สุทธิ (หักช่องเปิดแล้ว)',
            groupOpenings: 'พื้นที่ช่องเปิดรวมของกลุ่มผนังเดียวกัน (ส่วนผนัง + ชนิดอิฐ + ความหนา)',
            groupArea: 'พื้นที่ผนังรวมของกลุ่มผนังเดียวกัน',
            // outputs
            gross: 'พื้นที่ผนัง รวม',
            unmatchedOpenings: 'ช่องเปิดที่ไม่มีผนังตรงกัน (ไม่ถูกหักออก)',
            R179: 'อิฐมอญ ครึ่งแผ่น พื้นที่สุทธิ',
            R180: 'อิฐมอญ เต็มแผ่น พื้นที่สุทธิ',
            R181: 'อิฐมวลเบา ครึ่งแผ่น พื้นที่สุทธิ',
            R182: 'อิฐมวลเบา เต็มแผ่น พื้นที่สุทธิ',
            'net|ผนังภายในบ้าน': 'พื้นที่ก่อสุทธิ ส่วนผนัง ผนังภายในบ้าน',
            'net|ผนังรอบบ้าน-พิเศษ': 'พื้นที่ก่อสุทธิ ส่วนผนัง ผนังรอบบ้าน-พิเศษ',
            'net|ผนังรอบบ้าน': 'พื้นที่ก่อสุทธิ ส่วนผนัง ผนังรอบบ้าน',
            'net|ผนังภายนอกบ้าน': 'พื้นที่ก่อสุทธิ ส่วนผนัง ผนังภายนอกบ้าน',
            // other values of the door & window step (read together with the openings)
            R191: 'วงกบประตูไม้',
            'opening.total': 'พื้นที่ช่องเปิดรวม',
            'aluminium.count': 'จำนวนบานอลูมิเนียม',
            'aluminium.amount': 'ราคาบานอลูมิเนียม รวม',
            'wood.count': 'จำนวนบานไม้',
            'wood.amount': 'ราคาบานไม้ รวม',
            ...openingTerms('th'),
        },
        units: {
            length: 'ม.', height: 'ม.', area: 'ตร.ม.', openings: 'ตร.ม.', net: 'ตร.ม.', groupOpenings: 'ตร.ม.', groupArea: 'ตร.ม.',
            gross: 'ตร.ม.', unmatchedOpenings: 'ตร.ม.', R179: 'ตร.ม.', R180: 'ตร.ม.', R181: 'ตร.ม.', R182: 'ตร.ม.',
            'net|ผนังภายในบ้าน': 'ตร.ม.', 'net|ผนังรอบบ้าน-พิเศษ': 'ตร.ม.', 'net|ผนังรอบบ้าน': 'ตร.ม.', 'net|ผนังภายนอกบ้าน': 'ตร.ม.', R191: 'ชุด', 'opening.total': 'ตร.ม.', 'aluminium.count': 'บาน', 'aluminium.amount': 'บาท', 'wood.count': 'บาน', 'wood.amount': 'บาท',
            ...openingUnits('ตร.ม.'),
        },
        steps: {
            area: { label: 'พื้นที่ผนัง (สี่เหลี่ยม)', formula: '{length} × {height}', unit: 'ตร.ม.' },
            areaTriangle: { label: 'พื้นที่ผนัง (สามเหลี่ยม จั่ว)', formula: '{triangleFactor} × {length} × {height}', unit: 'ตร.ม.' },
            openings: { label: 'พื้นที่ช่องเปิดที่หัก', formula: '{groupOpenings}', unit: 'ตร.ม.' },
            openingsShare: { label: 'พื้นที่ช่องเปิดที่หัก (แบ่งตามสัดส่วนพื้นที่ผนังในกลุ่มเดียวกัน)', formula: '{groupOpenings} × {area} ÷ {groupArea}', unit: 'ตร.ม.' },
            openingsNone: { label: 'พื้นที่ช่องเปิดที่หัก (ช่องเปิดของกลุ่มนี้หักที่ผนังแถวแรกของกลุ่มแล้ว)', formula: 'ไม่หักซ้ำ → 0', unit: 'ตร.ม.' },
            net: { label: 'พื้นที่ก่อ สุทธิ', formula: '{area} − {openings}', unit: 'ตร.ม.' },
            totalGross: { label: 'พื้นที่ผนัง รวมทุกแถว', formula: 'Σ {area}', unit: 'ตร.ม.' },
            totalOpenings: { label: 'พื้นที่ช่องเปิดที่หัก รวมทุกแถว', formula: 'Σ {openings}', unit: 'ตร.ม.' },
            totalNet: { label: 'พื้นที่ก่อ สุทธิ รวมทุกแถว', formula: 'Σ {net}', unit: 'ตร.ม.' },
            unmatchedOpenings: { label: 'ช่องเปิดที่ไม่มีผนังตรงกัน (ไม่ถูกหักออก)', formula: 'Σ {groupOpenings} (กลุ่มที่ไม่มีผนังส่วนผนัง ชนิดอิฐ ความหนา ตรงกัน)', unit: 'ตร.ม.' },
            R179: { label: 'อิฐมอญ ครึ่งแผ่น (ส่งเข้า BOQ)', formula: 'Σ {net} (ผนังอิฐมอญ ครึ่งแผ่น)', unit: 'ตร.ม.' },
            R180: { label: 'อิฐมอญ เต็มแผ่น (ส่งเข้า BOQ)', formula: 'Σ {net} (ผนังอิฐมอญ เต็มแผ่น)', unit: 'ตร.ม.' },
            R181: { label: 'อิฐมวลเบา ครึ่งแผ่น (ส่งเข้า BOQ)', formula: 'Σ {net} (ผนังอิฐมวลเบา ครึ่งแผ่น)', unit: 'ตร.ม.' },
            R182: { label: 'อิฐมวลเบา เต็มแผ่น (ส่งเข้า BOQ)', formula: 'Σ {net} (ผนังอิฐมวลเบา เต็มแผ่น)', unit: 'ตร.ม.' },
            partNet: { label: 'พื้นที่ก่อ สุทธิ ส่วนผนัง {part} (ใช้ต่อในงานฉาบปูน)', formula: 'Σ {net} (ผนังส่วน {part})', unit: 'ตร.ม.' },
        },
    },
    en: {
        terms: {
            wallPart: 'Wall part',
            brickType: 'Brick type',
            thickness: 'Thickness',
            length: 'Length',
            height: 'Height',
            shape: 'Wall shape',
            triangleFactor: 'Triangular (gable) wall area factor = one half',
            area: 'Wall area',
            openings: 'Opening area',
            net: 'Net masonry area (after openings)',
            groupOpenings: 'Total opening area of the same wall group (wall part + brick + thickness)',
            groupArea: 'Total wall area of the same wall group',
            gross: 'Wall area, total',
            unmatchedOpenings: 'Openings with no matching wall (not deducted)',
            R179: 'Clay brick, half-brick, net area',
            R180: 'Clay brick, full-brick, net area',
            R181: 'Lightweight block, half-brick, net area',
            R182: 'Lightweight block, full-brick, net area',
            'net|ผนังภายในบ้าน': 'Net masonry area, wall part ผนังภายในบ้าน',
            'net|ผนังรอบบ้าน-พิเศษ': 'Net masonry area, wall part ผนังรอบบ้าน-พิเศษ',
            'net|ผนังรอบบ้าน': 'Net masonry area, wall part ผนังรอบบ้าน',
            'net|ผนังภายนอกบ้าน': 'Net masonry area, wall part ผนังภายนอกบ้าน',
            // other values of the door & window step (read together with the openings)
            R191: 'Wooden door frames',
            'opening.total': 'Total opening area',
            'aluminium.count': 'Number of aluminium leaves',
            'aluminium.amount': 'Aluminium leaves, total price',
            'wood.count': 'Number of wooden leaves',
            'wood.amount': 'Wooden leaves, total price',
            ...openingTerms('en'),
        },
        units: {
            length: 'm', height: 'm', area: 'sq.m', openings: 'sq.m', net: 'sq.m', groupOpenings: 'sq.m', groupArea: 'sq.m',
            gross: 'sq.m', unmatchedOpenings: 'sq.m', R179: 'sq.m', R180: 'sq.m', R181: 'sq.m', R182: 'sq.m',
            'net|ผนังภายในบ้าน': 'sq.m', 'net|ผนังรอบบ้าน-พิเศษ': 'sq.m', 'net|ผนังรอบบ้าน': 'sq.m', 'net|ผนังภายนอกบ้าน': 'sq.m', R191: 'sets', 'opening.total': 'sq.m', 'aluminium.count': 'leaves', 'aluminium.amount': 'baht', 'wood.count': 'leaves', 'wood.amount': 'baht',
            ...openingUnits('sq.m'),
        },
        steps: {
            area: { label: 'Wall area (rectangle)', formula: '{length} × {height}', unit: 'sq.m' },
            areaTriangle: { label: 'Wall area (triangular gable)', formula: '{triangleFactor} × {length} × {height}', unit: 'sq.m' },
            openings: { label: 'Opening area deducted', formula: '{groupOpenings}', unit: 'sq.m' },
            openingsShare: { label: 'Opening area deducted (shared by wall area within the same group)', formula: '{groupOpenings} × {area} ÷ {groupArea}', unit: 'sq.m' },
            openingsNone: { label: 'Opening area deducted (this group\'s openings are already deducted at its first wall row)', formula: 'not deducted twice → 0', unit: 'sq.m' },
            net: { label: 'Net masonry area', formula: '{area} − {openings}', unit: 'sq.m' },
            totalGross: { label: 'Wall area, all rows', formula: 'Σ {area}', unit: 'sq.m' },
            totalOpenings: { label: 'Opening area deducted, all rows', formula: 'Σ {openings}', unit: 'sq.m' },
            totalNet: { label: 'Net masonry area, all rows', formula: 'Σ {net}', unit: 'sq.m' },
            unmatchedOpenings: { label: 'Openings with no matching wall (not deducted)', formula: 'Σ {groupOpenings} (groups with no wall of the same wall part, brick and thickness)', unit: 'sq.m' },
            R179: { label: 'Clay brick, half-brick (sent to the BOQ)', formula: 'Σ {net} (clay brick, half-brick walls)', unit: 'sq.m' },
            R180: { label: 'Clay brick, full-brick (sent to the BOQ)', formula: 'Σ {net} (clay brick, full-brick walls)', unit: 'sq.m' },
            R181: { label: 'Lightweight block, half-brick (sent to the BOQ)', formula: 'Σ {net} (lightweight block, half-brick walls)', unit: 'sq.m' },
            R182: { label: 'Lightweight block, full-brick (sent to the BOQ)', formula: 'Σ {net} (lightweight block, full-brick walls)', unit: 'sq.m' },
            partNet: { label: 'Net masonry area, wall part {part} (used by plastering)', formula: 'Σ {net} (walls of part {part})', unit: 'sq.m' },
        },
    },
};

export const BRICK_TRACE_LABELS: CalcTraceLabels = withPrefix(BASE, 'walls');
