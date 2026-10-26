// Sheet "ปูกระเบื้องพื้น_Floor Tile" (Excel v5 sheet 16) → BOQ (Home) section 20, rows 205 (F1), 206 (F3), 207 (F4).
// The BOQ note "ราคากระเบื้องไม่เกิน 300.-/ตร.ม." on R205/R206 is template text.
// Spec: docs/excel-spec/04-ceiling-tiles-finishes-paint.md §2 (oddities O-11, O-13).
import { defineCalculator } from '../types';

/** Dropdown B5:B34 สัญลักษณ์ — the key BOQ E205–E207 SUMIF on. Excel has no F2. */
export const FLOOR_TILE_CODES = ['F1', 'F3', 'F4'] as const;
export type FloorTileCode = typeof FLOOR_TILE_CODES[number];

/** Column C รายการ for each code (Excel's dropdown strings; `ปูกระเบื้องแกรนิตโต้ ` etc. have a trailing space — trimmed). */
export const FLOOR_TILE_DESCRIPTIONS: Record<FloorTileCode, string> = {
    F1: 'ปูกระเบื้องแกรนิตโต้',
    F3: 'ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น',
    F4: 'ปรับระดับ ทำกันซึม',
};
/** Excel's C-column dropdown order (F4, F1, F3). */
export const FLOOR_TILE_DESCRIPTION_ORDER: FloorTileCode[] = ['F4', 'F1', 'F3'];

export interface FloorTileRow {
    /** B สัญลักษณ์ ('' = not chosen yet; the row then feeds no BOQ line). Drives C รายการ (O-13). */
    code: FloorTileCode | '';
    width: number;      // D กว้าง (ม.)
    length: number;     // E ยาว (ม.) — Excel types some as arithmetic (E20:E22 `=0.9+0.45`); stored as the value
    location: string;   // G ตำแหน่ง
}

export interface FloorTileInput {
    /** Excel rows 5–34 (30 rows, 21 used). Decision D5: unlimited rows. */
    rows: FloorTileRow[];
}

const num = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : 0);

/** F รวม (ตร.ม.) = `D*E`. */
export const floorTileRowArea = (r: FloorTileRow) => num(r.width) * num(r.length);

/** `SUMIF(B:B, code, F:F)`. */
export function floorTileAreaByCode(input: FloorTileInput, code: FloorTileCode): number {
    return input.rows.reduce((s, r) => s + (r.code === code ? floorTileRowArea(r) : 0), 0);
}

/** Stair length of the sample: E20 `=0.9+0.45`, shared into E21:E22 (typed arithmetic, no cell refs). */
export const STAIR_RUN = 0.9 + 0.45;

const row = (code: FloorTileCode, width: number, length: number, location: string): FloorTileRow =>
    ({ code, width, length, location });

export const floorTile = defineCalculator<FloorTileInput>({
    id: 'floor-tile',
    sheetName: 'ปูกระเบื้องพื้น_Floor Tile',
    title: 'โปรแกรมถอดแบบ – งานปูกระเบื้องพื้น Floor Tile',
    titleEn: 'Floor Tile',
    sections: [20],
    deps: [],
    defaults: () => ({
        rows: [
            row('F1', 3, 3, 'ทานอาหาร'),
            row('F1', 3, 3, 'ครัว'),
            row('F1', 3, 5, 'รับแขก'),
            row('F1', 1.2, 2, 'โถงทางเดิน (1)'),
            row('F1', 1.2, 1.5, 'โถงทางเดิน (2)'),
            row('F1', 3.5, 3.5, 'ห้องนอน 1 (1)'),
            row('F1', 1.2, 1.5, 'ห้องนอน 1 (2)'),
            row('F1', 3, 4, 'ห้องนอน 2'),
            row('F1', 3, 3, 'ห้องนอน 3'),
            row('F3', 1, 3.5, 'เฉลียง 1'),
            row('F3', 1, 4, 'เฉลียง 2'),
            row('F3', 1, 3, 'เฉลียง 3'),
            row('F3', 1, 1, 'เฉลียงพักผ่อน (1)'),
            row('F3', 3.5, 4, 'เฉลียงพักผ่อน (2)'),
            row('F3', 1.5, 3, 'เฉลียงพักผ่อน (3)'),
            row('F3', 3.3, STAIR_RUN, 'บันได (1)'),
            row('F3', 2, STAIR_RUN, 'บันได (2)'),
            row('F3', 2.9, STAIR_RUN, 'บันได (3)'),
            // Excel labels all three "(1)" (oddity O-11) — kept verbatim.
            row('F4', 1, 1, 'ดาดฟ้า ค.ส.ล. (1)'),
            row('F4', 3.5, 4, 'ดาดฟ้า ค.ส.ล. (1)'),
            row('F4', 1.5, 3, 'ดาดฟ้า ค.ส.ล. (1)'),
        ],
    }),
    // A real project: no rooms yet (prices sit in the BOQ, the sheet has no constants of its own).
    blank: () => ({ rows: [] }),
    compute: input => {
        const f1 = floorTileAreaByCode(input, 'F1');
        const f3 = floorTileAreaByCode(input, 'F3');
        const f4 = floorTileAreaByCode(input, 'F4');
        return {
            F1: f1, F3: f3, F4: f4,
            total: input.rows.reduce((s, r) => s + floorTileRowArea(r), 0),
            R205: f1,   // E205 = IFERROR(SUMIF(FloorTile!B:B,"F1",FloorTile!F:F),0)
            R206: f3,
            R207: f4,
        };
    },
    boqLinks: [
        { line: 'R205', field: 'qty', output: 'R205' },
        { line: 'R206', field: 'qty', output: 'R206' },
        { line: 'R207', field: 'qty', output: 'R207' },
    ],
});
