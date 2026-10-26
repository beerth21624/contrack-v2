// Sheet "ประตู-หน้าต่าง_Door&Window" (Excel v5 sheet 12) — the one shared door/window schedule. It feeds:
//  - BOQ section 24 งานประตู-หน้าต่างอลูมิเนียม (slot `aluminium`, Excel rows 234–242, FILTER C = บานอลูมิเนียม),
//  - BOQ section 30 งานประตู-หน้าต่างไม้ (slot `wood`, Excel rows 294–297, FILTER C = บานไม้),
//  - BOQ 18.3 วงกบประตูไม้ (R191 = SUMIF(C, "บานไม้", G)),
//  - the brick sheet's opening deduction (H = SUMIFS(K, D = wall part, E = brick, F = thickness)) through the
//    `opening|<wall part>|<brick>|<thickness>` outputs below.
// Spec: docs/excel-spec/03-roof-brick-plaster-doors.md §6.
import { defineCalculator, type SlotRow } from '../types';

// ─── Dropdown lists of the sheet (exact Excel strings, trailing spaces trimmed — spec oddity 5) ───

/** C ชนิดบาน. Excel's aluminium value is "บานอลูมิเนียม " (trailing space); compared trimmed. */
export const DOOR_TYPES = ['บานไม้', 'บานอลูมิเนียม'] as const;
export type DoorType = typeof DOOR_TYPES[number];
export const WOOD: DoorType = 'บานไม้';
export const ALUMINIUM: DoorType = 'บานอลูมิเนียม';

/** D ส่วนผนัง (same set as the brick sheet's B ส่วนผนัง; order as in this sheet). */
export const WALL_PARTS = ['ผนังภายในบ้าน', 'ผนังรอบบ้าน', 'ผนังรอบบ้าน-พิเศษ', 'ผนังภายนอกบ้าน'] as const;
/** E อิฐ (same list as the brick sheet's C รายการ). */
export const BRICK_TYPES = ['อิฐมวลเบา', 'อิฐมอญ'] as const;
/** Extra E option Excel offers on E6 only. No brick/plaster row uses it, so such openings are never deducted. */
export const LIGHT_WALL = 'ผนังเบา';
/** E options shown on this sheet (Excel E6's list; offered on every row since rows are unlimited, D5). */
export const OPENING_WALL_TYPES = [...BRICK_TYPES, LIGHT_WALL] as const;
/** F ความหนา (same list as the brick sheet's D ความหนา). */
export const BRICK_THICKNESSES = ['ครึ่งแผ่น', 'เต็มแผ่น'] as const;

/**
 * Output key of the opening area (m², Σ K) to deduct from brick walls with this wall part / brick / thickness.
 * Contract with the brick calculator: read `ctx.outputs('door-window')?.[openingKey(B, C, D)] ?? 0`.
 * Values are compared trimmed; an empty cell is ''.
 */
export const openingKey = (wallPart: string, brick: string, thickness: string): string =>
    `opening|${wallPart.trim()}|${brick.trim()}|${thickness.trim()}`;

// ─── Prices (Excel BOQ sections 24 / 30) ───

/** Excel I234–I242 = width × height × rate: 3,000 ฿/m² sliding/fixed (บานเลื่อน…), 3,500 ฿/m² awning (บานกระทุ้ง…). */
export const ALUMINIUM_RATES = { sliding: 3000, awning: 3500 } as const;
/** Excel I294–I296 / K294–K296: wood door 4,000 material, 800 labour per set. */
export const WOOD_DEFAULT_PRICE = { mat: 4000, lab: 800 } as const;
/** Excel N294–N296 (wood doors only; the wood round window W4 has no note). */
export const WOOD_DOOR_NOTE = 'ราคาบานไม่เกิน 3,000 .-';

/** One row of the schedule (Excel rows 6–16 doors, 18–25 windows; D5: unlimited). */
export interface OpeningRow {
    name: string;        // B รายการ — code + description, e.g. "D1-บานเลื่อนคู่ … ขนาด 2.6 x 2.05 ม." (BOQ D)
    type: string;        // C ชนิดบาน (DOOR_TYPES; '' = blank row, not sent to the BOQ)
    wallPart: string;    // D ส่วนผนัง (WALL_PARTS)
    brick: string;       // E อิฐ (OPENING_WALL_TYPES)
    thickness: string;   // F ความหนา (BRICK_THICKNESSES)
    count: number;       // G จำนวน (บาน) — BOQ E
    width: number;       // H กว้าง (ม.)
    height: number;      // I สูง (ม.)
    /** Aluminium rate ฿/m² (Excel's literal in I234…: 3,000 or 3,500). Unused for wood rows. */
    rate: number;
    /** Material price per set (BOQ I). null = default: aluminium W × H × rate, wood 4,000. */
    matPrice: number | null;
    /** Labour price per set (BOQ K). null = default: aluminium 0 (installation included), wood 800. */
    labPrice: number | null;
}

export interface DoorWindowInput {
    doors: OpeningRow[];     // ประตู (Door)
    windows: OpeningRow[];   // หน้าต่าง (Window)
}

const num = (v: number) => (Number.isFinite(v) ? v : 0);
const isType = (r: OpeningRow, t: DoorType) => r.type.trim() === t;

export interface OpeningRowCalc {
    area: number;       // J พื้นที่ ต่อบาน (ตร.ม.) = H × I
    total: number;      // K รวม (ตร.ม.) = J × G
    matUnit: number;    // BOQ I (material per set)
    labUnit: number;    // BOQ K (labour per set)
}

/** Default material price per set (BOQ I) when the row has no typed price. */
export function defaultMatPrice(r: OpeningRow): number {
    if (isType(r, ALUMINIUM)) return num(r.width) * num(r.height) * num(r.rate);   // e.g. `=2.6*2.05*3000`
    if (isType(r, WOOD)) return WOOD_DEFAULT_PRICE.mat;
    return 0;
}

/** Default labour price per set (BOQ K) when the row has no typed price. */
export function defaultLabPrice(r: OpeningRow): number {
    return isType(r, WOOD) ? WOOD_DEFAULT_PRICE.lab : 0;
}

export function openingRowCalc(r: OpeningRow): OpeningRowCalc {
    const area = num(r.width) * num(r.height);       // J6 = H6*I6
    return {
        area,
        total: area * num(r.count),                  // K6 = J6*G6 (Excel row 15 had no formula — fixed, oddity 3)
        matUnit: r.matPrice ?? defaultMatPrice(r),
        labUnit: r.labPrice ?? defaultLabPrice(r),
    };
}

/** Item code at the start of รายการ ("D1-บาน…" → "D1"), or '' when there is none. */
export function itemCode(name: string): string {
    return /^\s*([A-Za-z]+\d+)/.exec(name)?.[1]?.toUpperCase() ?? '';
}

interface TaggedRow { row: OpeningRow; block: 'doors' | 'windows'; key: string }

/** All rows in schedule order (doors, then windows — the order of Excel's FILTER spill), with stable keys. */
export function scheduleRows(input: DoorWindowInput): TaggedRow[] {
    const used = new Set<string>();
    const tagged: TaggedRow[] = [];
    const add = (rows: OpeningRow[], block: TaggedRow['block']) => rows.forEach((row, i) => {
        const base = itemCode(row.name) || `${block === 'doors' ? 'D' : 'W'}#${i + 1}`;
        let key = base;
        for (let n = 2; used.has(key); n++) key = `${base}~${n}`;
        used.add(key);
        tagged.push({ row, block, key });
    });
    add(input.doors, 'doors');
    add(input.windows, 'windows');
    return tagged;
}

export function computeDoorWindow(input: DoorWindowInput): Record<string, number> {
    const rows = scheduleRows(input);
    const out: Record<string, number> = {};
    // Every standard combination is present (0 when no opening), plus any other combination typed.
    for (const w of WALL_PARTS) for (const b of OPENING_WALL_TYPES) for (const t of BRICK_THICKNESSES) out[openingKey(w, b, t)] = 0;
    let openingTotal = 0, woodCount = 0, aluCount = 0, woodAmount = 0, aluAmount = 0;
    for (const { row } of rows) {
        const c = openingRowCalc(row);
        const key = openingKey(row.wallPart, row.brick, row.thickness);
        out[key] = (out[key] ?? 0) + c.total;            // brick H = SUMIFS(K, D, B, E, C, F, D)
        openingTotal += c.total;
        const n = num(row.count);
        if (isType(row, WOOD)) { woodCount += n; woodAmount += n * (c.matUnit + c.labUnit); }
        if (isType(row, ALUMINIUM)) { aluCount += n; aluAmount += n * (c.matUnit + c.labUnit); }
    }
    out['opening.total'] = openingTotal;
    out['aluminium.count'] = aluCount;
    out['aluminium.amount'] = aluAmount;
    out['wood.count'] = woodCount;
    out['wood.amount'] = woodAmount;
    // BOQ E191 วงกบประตูไม้ = SUMIF(C, "บานไม้", G) — doors and windows alike (Excel counts W4; open question).
    out.R191 = woodCount;
    return out;
}

/** BOQ rows for one door type: one row per schedule row of that type (Excel FILTER), numbered 1), 2), … */
export function slotRows(input: DoorWindowInput, type: DoorType): SlotRow[] {
    return scheduleRows(input)
        .filter(t => isType(t.row, type))
        .map((t, i): SlotRow => {
            const c = openingRowCalc(t.row);
            return {
                type: 'item', key: t.key, itemNo: `${i + 1})`, desc: t.row.name.trim(), unit: 'ชุด',
                qty: { kind: 'input', value: num(t.row.count) },
                waste: 0, gross: 'std', mat: c.matUnit, lab: c.labUnit,
                materialBasis: 'gross', labourBasis: 'net',
                ...(type === WOOD && t.block === 'doors' ? { note: WOOD_DOOR_NOTE } : {}),
            };
        });
}

/** A schedule row with the sheet's usual wall settings (ผนังรอบบ้าน / อิฐมอญ / ครึ่งแผ่น). */
export function openingRow(p: Partial<OpeningRow> & Pick<OpeningRow, 'name' | 'type' | 'count' | 'width' | 'height'>): OpeningRow {
    return {
        wallPart: 'ผนังรอบบ้าน', brick: 'อิฐมอญ', thickness: 'ครึ่งแผ่น',
        rate: ALUMINIUM_RATES.sliding, matPrice: null, labPrice: null,
        ...p,
    };
}

const A = ALUMINIUM, W = WOOD, IN = 'ผนังภายในบ้าน';
const AWNING = ALUMINIUM_RATES.awning;

export const doorWindow = defineCalculator<DoorWindowInput>({
    id: 'door-window',
    sheetName: 'ประตู-หน้าต่าง_Door&Window',
    title: 'โปรแกรมถอดแบบ – งานประตู-หน้าต่าง Door&Window',
    titleEn: 'Door & Window Schedule',
    // 24 aluminium, 30 wood, 18 for 18.3 วงกบประตูไม้ (the brick openings go to the brick sheet, section 17).
    sections: [24, 30, 18],
    deps: [],
    // Rows 6–14 and 18–21 of the sheet (blank rows 15–16, 22–25 left out; rows can be added, D5).
    defaults: () => ({
        doors: [
            openingRow({ name: 'D1-บานเลื่อนคู่ และช่องแสงติดตาย ขนาด 2.6 x 2.05 ม.', type: A, count: 1, width: 2.6, height: 2.05 }),
            openingRow({ name: 'D2-บานเลื่อนสลับ ขนาด 1.5 x 2.05 ม.', type: A, count: 1, width: 1.5, height: 2.05 }),
            openingRow({ name: 'D3-บานเปิดเดี่ยว ขนาด 0.8 x 2 ม.', type: W, wallPart: IN, count: 3, width: 0.8, height: 2 }),
            openingRow({ name: 'D4-บานเปิดเดี่ยว ขนาด 0.8 x 2 ม.', type: W, count: 1, width: 0.8, height: 2 }),
            openingRow({ name: 'D5-บานเปิดเดี่ยว มีเกล็ดระบายอากาศ ขนาด 0.7 x 2 ม.', type: W, wallPart: IN, count: 2, width: 0.7, height: 2 }),
            openingRow({ name: 'D6-บานเลื่อนสลับ ขนาด 1.6 x 2.05 ม.', type: A, count: 1, width: 1.6, height: 2.05 }),
            openingRow({ name: 'D7-บานเลื่อนสลับ และช่องแสงติดตาย ขนาด 1.65 x 2.65 ม.', type: A, count: 1, width: 1.65, height: 2.65 }),
            openingRow({ name: 'D8-บานกระทุ้งข้าง ขนาด 0.6 x 2.65 ม.', type: A, count: 1, width: 0.6, height: 2.65, rate: AWNING }),
            openingRow({ name: 'D9-บานเลื่อนสลับ ขนาด 2.4 x 2.05 ม.', type: A, count: 1, width: 2.4, height: 2.05 }),
        ],
        windows: [
            openingRow({ name: 'W1-บานเลื่อนสลับ ขนาด 1.3 x 1.2 ม.', type: A, count: 2, width: 1.3, height: 1.2 }),
            openingRow({ name: 'W2-บานกระทุ้งข้าง และช่องแสงติดตาย ขนาด 0.6 x 1.8 ม.', type: A, count: 4, width: 0.6, height: 1.8, rate: AWNING }),
            openingRow({ name: 'W3-บานกระทุ้งล่าง ขนาด 1.8 x 0.5 ม.', type: A, count: 2, width: 1.8, height: 0.5, rate: AWNING }),
            // Excel I297 / K297: the round window is priced 5,000 / 500 (typed in the BOQ).
            openingRow({ name: 'W4-บานวงกลม ช่องแสงติดตาย ขนาด Dia.1.1 ม.', type: W, count: 1, width: 1.1, height: 1.1, matPrice: 5000, labPrice: 500 }),
        ],
    }),
    // A real project starts with an empty schedule: every opening is read off the plan's door/window table.
    // Prices are per row (aluminium rate, typed prices) and come with each new row (ALUMINIUM_RATES, WOOD_DEFAULT_PRICE).
    blank: () => ({ doors: [], windows: [] }),
    compute: (input) => computeDoorWindow(input),
    boqLinks: [{ line: 'R191', field: 'qty', output: 'R191' }],
    boqSlots: (input) => ({
        aluminium: slotRows(input, ALUMINIUM),   // BOQ 24 rows 234…
        wood: slotRows(input, WOOD),             // BOQ 30 rows 294…
    }),
});
