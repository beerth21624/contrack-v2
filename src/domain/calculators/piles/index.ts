// Section 5 "งานเสาเข็ม" → BOQ (Home) row 35 (เสาเข็ม, ต้น). Excel v5 has no calculator sheet:
// the row is qty 21 ต้น × labour 2,500 บาท/ต้น (lump sum per pile, material 0) with the spec in note N35
// "เสาเข็มตอก (I - 22 x 22 ยาว 6 ม.)". Deck p22: "ประเมินราคาแบบเหมา แต่ต้องใส่ spec ให้ครบ" — so this is a
// small spec form whose fields compose that note. BOQ R39 ตัดหัวเสาเข็ม = E35 through the template.
// Spec: docs/excel-spec/01-boq-home-and-steps-00-05.md, Section 5.
import { defineCalculator } from '../types';

export interface PilesInput {
    pileType: string;      // ชนิดเสาเข็ม
    section: string;       // หน้าตัด / รูปทรง
    length: number;        // ความยาว (ม.)
    count: number;         // จำนวน (ต้น)          → BOQ E35
    pricePerPile: number;  // ราคาเหมาต่อต้น (บาท)  → BOQ K35
    /** Extra spec, optional (e.g. load, brand). Appended to the note. */
    extraSpec: string;
}

export const PILE_TYPES = ['เสาเข็มตอก', 'เสาเข็มเจาะ', 'เสาเข็มไมโครไพล์', 'เสาเข็มสปัน'] as const;

/** Section / shape options, grouped for the dropdown. Values are written into the BOQ note verbatim. */
export const PILE_SECTION_GROUPS: { label: string; options: string[] }[] = [
    {
        label: 'หน้าตัดรูปตัวไอ (I)',
        options: ['I - 18 x 18', 'I - 22 x 22', 'I - 26 x 26', 'I - 30 x 30', 'I - 35 x 35', 'I - 40 x 40'],
    },
    {
        label: 'สี่เหลี่ยมตัน',
        options: ['สี่เหลี่ยม 15 x 15', 'สี่เหลี่ยม 18 x 18', 'สี่เหลี่ยม 22 x 22', 'สี่เหลี่ยม 25 x 25', 'สี่เหลี่ยม 30 x 30'],
    },
    {
        label: 'กลม',
        options: ['กลม Ø 21 ซม.', 'กลม Ø 25 ซม.', 'กลม Ø 30 ซม.', 'กลม Ø 35 ซม.', 'กลม Ø 40 ซม.', 'กลม Ø 50 ซม.', 'กลม Ø 60 ซม.'],
    },
];

const num = (v: number) => (Number.isFinite(v) ? v : 0);

/** 6 → "6", 6.5 → "6.5" (as typed in the Excel note). */
const formatLength = (v: number) => String(Number(num(v).toFixed(2)));

/**
 * The BOQ note in Excel's style: `<ชนิด> (<หน้าตัด> ยาว <L> ม.)` + optional extra text.
 * Empty fields are left out (the page warns about them).
 */
export function composePileSpec(input: PilesInput): string {
    const inner = [input.section.trim(), num(input.length) > 0 ? `ยาว ${formatLength(input.length)} ม.` : '']
        .filter(Boolean).join(' ');
    return [input.pileType.trim(), inner ? `(${inner})` : '', input.extraSpec.trim()].filter(Boolean).join(' ');
}

/** Labels of the required spec fields that are empty ("ต้องใส่ spec ให้ครบ"). */
export function missingPileSpec(input: PilesInput): string[] {
    const missing: string[] = [];
    if (!input.pileType.trim()) missing.push('ชนิดเสาเข็ม');
    if (!input.section.trim()) missing.push('หน้าตัด/รูปทรง');
    if (!(num(input.length) > 0)) missing.push('ความยาว');
    return missing;
}

export const piles = defineCalculator<PilesInput>({
    id: 'piles',
    sheetName: 'BOQ (Home) แถว 35 (ไม่มีชีตคำนวณ)',
    title: 'งานเสาเข็ม (ราคาเหมา + spec)',
    titleEn: 'Piling Works',
    sections: [5],
    deps: [],
    defaults: () => ({
        pileType: 'เสาเข็มตอก',
        section: 'I - 22 x 22',
        length: 6,
        count: 21,
        pricePerPile: 2500,
        extraSpec: '',
    }),
    // A real project: the spec and the count come from the foundation plan; the lump price keeps Excel's 2,500.
    blank: () => ({
        pileType: '',
        section: '',
        length: 0,
        count: 0,
        pricePerPile: 2500,
        extraSpec: '',
    }),
    compute: (input) => ({
        count: num(input.count),               // E35 จำนวน (ต้น)
        pricePerPile: num(input.pricePerPile), // K35 ราคาเหมาต่อต้น (labour column, material 0)
    }),
    boqLinks: [
        { line: 'R35', field: 'qty', output: 'count' },
        { line: 'R35', field: 'lab', output: 'pricePerPile' },
    ],
    boqText: (input) => ({ R35: { note: composePileSpec(input) } }),
});
