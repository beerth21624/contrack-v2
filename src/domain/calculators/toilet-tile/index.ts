// Sheet "ปูกระเบื้องห้องน้ำ_Toilet" (Excel v5 sheet 17) → BOQ (Home) section 21, rows 210 (F3 floor) and 211 (P3 wall).
// The water-pipe rows R213–R215 of the same section come from the water-pipe calculator (sheet 06), not from here.
// Spec: docs/excel-spec/04-ceiling-tiles-finishes-paint.md §3.
import { defineCalculator } from '../types';

/** Dropdown B5:B15 สัญลักษณ์ — the BOQ key. F3 = floor non-slip granito, P3 = wall granito. */
export const TOILET_TILE_CODES = ['F3', 'P3'] as const;
/** Dropdown C5:C15 พื้น/ผนัง (informational, not used by any formula). */
export const TOILET_TILE_SURFACES = ['พื้น', 'ผนัง'] as const;
/** Dropdown D5:D15 รายการ. Excel's values end with a space — stored trimmed. */
export const TOILET_TILE_ITEMS = ['ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น', 'กรุกระเบื้องแกรนิตโต้'] as const;

export interface ToiletTileRow {
    code: string;        // B สัญลักษณ์ (F3 / P3)
    surface: string;     // C พื้น/ผนัง
    item: string;        // D รายการ
    /** E กว้าง (ม.) — blank (undefined) on wall rows. */
    width?: number;
    /** F ยาว (ม.) — floor: length; wall: perimeter of the room (Excel types `=2*(2.3+3)`). */
    length?: number;
    /** G สูง (ม.) — wall tile height; blank on floor rows. */
    height?: number;
    /** H ช่องเปิด (ตร.ม.) — openings to deduct, per row (Excel H8 is a shared copy of H7's `=(0.7*2)+(0.5*1.8)`). */
    openings?: number;
    location: string;    // J ตำแหน่ง
}

export interface ToiletTileInput {
    /** Excel rows 5–15 (11 rows, 4 filled). Decision D5: unlimited rows. */
    rows: ToiletTileRow[];
}

const filled = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v);

/**
 * I รวม (ตร.ม.) = `IF(COUNTA(E:G)=0, "", PRODUCT(E, F, G) − H)`: the product of whichever of W / L / H are filled
 * (PRODUCT skips blanks), minus the openings (blank = 0). `null` (Excel "") when W, L and H are all blank.
 */
export function toiletTileArea(r: ToiletTileRow): number | null {
    const dims = [r.width, r.length, r.height].filter(filled);
    if (dims.length === 0) return null;
    return dims.reduce((p, v) => p * v, 1) - (filled(r.openings) ? r.openings : 0);
}

/** BOQ `SUMIF(Toilet!B:B, code, Toilet!I:I)` (code compared trimmed, case-insensitive like Excel). */
export function toiletTileTotal(input: ToiletTileInput, code: string): number {
    const key = code.toUpperCase();
    return input.rows.reduce((s, r) => s + (r.code.trim().toUpperCase() === key ? (toiletTileArea(r) ?? 0) : 0), 0);
}

/** Excel sample openings of each bathroom wall row: door 0.7 × 2 + window 0.5 × 1.8 = 2.3 m². */
export const SAMPLE_OPENINGS = 0.7 * 2 + 0.5 * 1.8;

export const toiletTile = defineCalculator<ToiletTileInput>({
    id: 'toilet-tile',
    sheetName: 'ปูกระเบื้องห้องน้ำ_Toilet',
    title: 'โปรแกรมถอดแบบ – งานปูกระเบื้องห้องน้ำ_Toilet Tile',
    titleEn: 'Toilet Tile',
    sections: [21],
    deps: [],
    defaults: () => ({
        rows: [
            { code: 'F3', surface: 'พื้น', item: 'ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น', width: 2.3, length: 3, location: 'ห้องน้ำ 1' },
            { code: 'F3', surface: 'พื้น', item: 'ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น', width: 1.8, length: 2, location: 'ห้องน้ำ 2' },
            // F7 `=2*(2.3+3)`, H7 `=(0.7*2)+(0.5*1.8)`
            { code: 'P3', surface: 'ผนัง', item: 'กรุกระเบื้องแกรนิตโต้', length: 2 * (2.3 + 3), height: 2.4, openings: SAMPLE_OPENINGS, location: 'ห้องน้ำ 1' },
            // F8 `=2*(1.8+2)`, H8 = shared copy of H7 (its own input here)
            { code: 'P3', surface: 'ผนัง', item: 'กรุกระเบื้องแกรนิตโต้', length: 2 * (1.8 + 2), height: 2.4, openings: SAMPLE_OPENINGS, location: 'ห้องน้ำ 2' },
        ],
    }),
    compute: (input) => {
        const floorArea = toiletTileTotal(input, 'F3');
        const wallArea = toiletTileTotal(input, 'P3');
        return {
            floorArea,
            wallArea,
            R210: floorArea,  // E210 = SUMIF(B,"F3",I)
            R211: wallArea,   // E211 = SUMIF(B,"P3",I)
        };
    },
    boqLinks: [
        { line: 'R210', field: 'qty', output: 'R210' },
        { line: 'R211', field: 'qty', output: 'R211' },
    ],
});
