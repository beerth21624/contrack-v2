// Sheet "ตกแต่งผนัง_Wall Finishing" (Excel v5 sheet 18) → BOQ (Home) section 22, rows 218 (บัว 0.3), 219 (บัว 0.1)
// and 220 (ระแนง). Outputs `slatWallArea` and `moulding.*` also feed the paint sheet (sheet 19 C10 / C11).
// Spec: docs/excel-spec/04-ceiling-tiles-finishes-paint.md §4 and oddity O-2.
//
// Excel headers are swapped: column C is headed "ตำแหน่ง" but holds the item, H is headed "รายการ" but holds the
// location — the app labels them by meaning (C = รายการ, H = ตำแหน่ง).
//
// Decision D1 (oddity O-2): Excel's E218 sums the 0.1 moulding and E219 the 0.3 moulding although the rows'
// description and prices are the other way round. Here R218 (0.3, 400/200) = length of the 0.3 moulding and
// R219 (0.1, 180/100) = length of the 0.1 moulding. Section 22 with the sample: 15,693 → 16,377 (+684).
import { defineCalculator } from '../types';

export const MOULDING_0_3 = 'บัวตกแต่งผนัง ขนาด 0.3 หนา 0.1 ม.';
export const MOULDING_0_1 = 'บัวตกแต่งผนัง ขนาด 0.1 หนา 0.1 ม.';
export const SLAT_WALL = 'กรุไม้ระแนงไฟเบอร์ซีเมนต์บอร์ด กว้าง 4 นิ้ว หนา 9 มม.';

/** Dropdown C5:C15, in the sheet's order. */
export const WALL_FINISHING_ITEMS = [MOULDING_0_1, MOULDING_0_3, SLAT_WALL] as const;
/** Dropdown B5:B15 สัญลักษณ์ (not used by any formula). */
export const WALL_FINISHING_CODES = ['P1', 'P2', 'P3', 'P4'] as const;

/** The moulding items: size (face) and thickness in m, as named in the description. */
export const MOULDINGS = [
    { item: MOULDING_0_3, key: '0.3', face: 0.3, thickness: 0.1 },
    { item: MOULDING_0_1, key: '0.1', face: 0.1, thickness: 0.1 },
] as const;

export interface WallFinishingRow {
    code: string;      // B สัญลักษณ์
    item: string;      // C (Excel header "ตำแหน่ง") รายการ
    width: number;     // D กว้าง (ม.) — 0 on moulding rows
    length: number;    // E ยาว (ม.)
    location: string;  // H (Excel header "รายการ") ตำแหน่ง
}

export interface WallFinishingInput {
    /** Excel rows 5–15 (11 rows, 4 filled). Decision D5: unlimited rows. */
    rows: WallFinishingRow[];
}

const num = (v: number) => (Number.isFinite(v) ? v : 0);
const isMoulding = (item: string) => MOULDINGS.some(m => m.item === item.trim());
const isSlat = (item: string) => item.trim() === SLAT_WALL;

/**
 * F ยาว (ม.) = `D + E` for moulding rows (Excel has the F formula only on rows 5–6; here every moulding row);
 * `null` (blank) for other rows.
 */
export function wallFinishingLength(r: WallFinishingRow): number | null {
    return isMoulding(r.item) ? num(r.width) + num(r.length) : null;
}

/**
 * G พื้นที่ (ตร.ม.) = `D × E` for slat rows (Excel has the G formula only on rows 7–15; here every slat row);
 * `null` (blank) for other rows.
 */
export function wallFinishingArea(r: WallFinishingRow): number | null {
    return isSlat(r.item) ? num(r.width) * num(r.length) : null;
}

/** `SUMIF(WF!C:C, item, WF!F:F)` — total length of one moulding item. */
export function mouldingLength(input: WallFinishingInput, item: string): number {
    return input.rows.reduce((s, r) => s + (r.item.trim() === item ? (wallFinishingLength(r) ?? 0) : 0), 0);
}

/** `SUMIF(WF!C:C, SLAT_WALL, WF!G:G)` — total slat cladding area. */
export function slatArea(input: WallFinishingInput): number {
    return input.rows.reduce((s, r) => s + (wallFinishingArea(r) ?? 0), 0);
}

export const wallFinishing = defineCalculator<WallFinishingInput>({
    id: 'wall-finishing',
    sheetName: 'ตกแต่งผนัง_Wall Finishing',
    title: 'โปรแกรมถอดแบบ – งานตกแต่งผนัง_Wall Finishing',
    titleEn: 'Wall Finishing',
    sections: [22],
    deps: [],
    defaults: () => ({
        rows: [
            { code: 'P2', item: MOULDING_0_3, width: 0, length: 13, location: 'ผนังภายนอก' },
            { code: 'P2', item: MOULDING_0_1, width: 0, length: 11, location: 'ผนังภายนอก' },
            { code: 'P4', item: SLAT_WALL, width: 1.65, length: 2, location: 'ผนังเฉลียง 1' },
            { code: 'P4', item: SLAT_WALL, width: 1.2, length: 4, location: 'ผนังเฉลียง 2' },
        ],
    }),
    compute: (input) => {
        const out: Record<string, number> = {};
        let mouldingPaintArea = 0;
        for (const m of MOULDINGS) {
            const len = mouldingLength(input, m.item);
            out[`moulding.${m.item}`] = len;
            out[`moulding.${m.key}`] = len;
            // Paint sheet C11 `=(0.5*13)+(0.3*11)`: length × girth (face + 2 × thickness).
            mouldingPaintArea += len * (m.face + 2 * m.thickness);
        }
        const slatWallArea = slatArea(input);
        return {
            ...out,
            slatWallArea,
            mouldingPaintArea,
            R218: out['moulding.0.3'] ?? 0,   // D1 fix: Excel sums the 0.1 moulding here
            R219: out['moulding.0.1'] ?? 0,   // D1 fix: Excel sums the 0.3 moulding here
            R220: slatWallArea,               // E220 = SUMIF(C, ระแนง, G)
        };
    },
    boqLinks: [
        { line: 'R218', field: 'qty', output: 'R218' },
        { line: 'R219', field: 'qty', output: 'R219' },
        { line: 'R220', field: 'qty', output: 'R220' },
    ],
});
