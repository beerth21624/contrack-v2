// Sheet "ฝ้าเพดาน_Ceiling" (Excel v5 sheet 15) → BOQ (Home) section 19, rows 199–202 (C1–C4).
// The paint-group totals (`paint.ภายนอก` / `paint.ภายใน` / `paint.ไม้ระแนง`) feed the paint sheet (sheet 19 C7/C8/C9).
// Spec: docs/excel-spec/04-ceiling-tiles-finishes-paint.md §1 (oddities O-1, O-13, O-14).
import { defineCalculator } from '../types';

/** Dropdown B5:B28 สัญลักษณ์ — the key BOQ E199–E202 SUMIF on. */
export const CEILING_CODES = ['C1', 'C2', 'C3', 'C4'] as const;
export type CeilingCode = typeof CEILING_CODES[number];

/** Column C รายการ for each code (Excel's dropdown C5:C28 strings, verbatim). */
export const CEILING_DESCRIPTIONS: Record<CeilingCode, string> = {
    C1: 'ฝ้าเพดานยิปซัมบอร์ด หนา 9 มม. โครงเคร่าซีลาย ทาสีอะคลีลิค',
    C2: 'ฝ้าเพดานยิปซัมบอร์ด ชนิดกันชื้น หนา 9 มม. โครงเคร่าซีลาย ทาสีอะคลีลิค',
    C3: 'ฝ้าเพดานไฟเบอร์ซีเมนต์ หนา 4 มม. โครงเคร่าซีลาย ทาสีอะคลีลิค',
    C4: 'ฝ้าเพดานระแนงไม้ไฟเบอร์ซีเมนต์ กว้าง 4 นิ้ว หนา 9 มม. โครงเคร่าเหล็กกล่อง ทาสีย้อมไม้',
};
/** Excel's C-column dropdown order (C1, C2, C4, C3 — oddity O-14). */
export const CEILING_DESCRIPTION_ORDER: CeilingCode[] = ['C1', 'C2', 'C4', 'C3'];

/** Dropdown H5:H28 แยกงานทาสี, in Excel's order. Stored as the group word; shown as the Excel label. */
export const CEILING_PAINT_GROUPS = ['ภายใน', 'ภายนอก', 'ไม้ระแนง'] as const;
export type CeilingPaintGroup = typeof CEILING_PAINT_GROUPS[number];
/** Excel labels (`ทาสีฝ้า - ไม้ระแนง ` has a trailing space in Excel — shown trimmed). */
export const paintGroupLabel = (g: CeilingPaintGroup) => `ทาสีฝ้า - ${g}`;

/** Paint-sheet output key for a group, e.g. `paint.ภายใน` (contract with the paint calculator). */
export const paintKey = (g: CeilingPaintGroup) => `paint.${g}`;

/**
 * Paint group that goes with each ceiling type in the Excel sample (C1/C2 painted as interior, C3 eaves as
 * exterior, C4 slats with wood stain). Used to pre-fill a row's แยกงานทาสี when its type is picked.
 */
export const CEILING_DEFAULT_PAINT: Record<CeilingCode, CeilingPaintGroup> = {
    C1: 'ภายใน', C2: 'ภายใน', C3: 'ภายนอก', C4: 'ไม้ระแนง',
};

/**
 * Picks a row's type (journey page). The paint group follows the type while it is empty or still the previous
 * type's usual group; a group the user chose differently is kept.
 */
export function setCeilingCode(r: CeilingRow, code: CeilingCode | ''): CeilingRow {
    const follows = r.paint === '' || (r.code !== '' && r.paint === CEILING_DEFAULT_PAINT[r.code]);
    const paint = follows && code !== '' ? CEILING_DEFAULT_PAINT[code] : r.paint;
    return { ...r, code, paint };
}

/** Excel rows 16–17 (sample rows 12–13) use `(D*E)/COS(RADIANS(40))` — the veranda ceiling under the 40° roof. */
export const SLOPED_CEILING_DEG = 40;

export interface CeilingRow {
    /** B สัญลักษณ์ ('' = not chosen yet; the row then feeds no BOQ line). Drives C รายการ (O-13). */
    code: CeilingCode | '';
    width: number;      // D กว้าง (ม.)
    length: number;     // E ยาว (ม.)
    location: string;   // G ตำแหน่ง
    /** H แยกงานทาสี ('' = no paint line). */
    paint: CeilingPaintGroup | '';
    /**
     * Slope of a sloped ceiling in degrees (O-1). Area = D×E ÷ cos(slope). 0 / undefined = flat (`D*E`).
     * Excel hard-codes 40° on rows 16–17 only; here it is a per-row input with those rows defaulting to 40.
     */
    slope?: number;
}

export interface CeilingInput {
    /** Excel rows 5–28 (24 rows, 17 used). Decision D5: unlimited rows. */
    rows: CeilingRow[];
}

const num = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : 0);

/** F รวม (ตร.ม.) = `D*E`, or `(D*E)/COS(RADIANS(slope))` for a sloped row. An impossible slope (≥ 90°) gives 0. */
export function ceilingRowArea(r: CeilingRow): number {
    const plan = num(r.width) * num(r.length);
    const slope = num(r.slope);
    if (slope === 0) return plan;
    const cos = Math.cos((slope * Math.PI) / 180);
    return cos > 1e-9 ? plan / cos : 0;
}

/** `SUMIF(B:B, code, F:F)`. */
export function ceilingAreaByCode(input: CeilingInput, code: CeilingCode): number {
    return input.rows.reduce((s, r) => s + (r.code === code ? ceilingRowArea(r) : 0), 0);
}

/** Paint sheet `SUMIF(Ceiling!H:H, "ทาสีฝ้า - …", Ceiling!F:F)`. */
export function ceilingAreaByPaint(input: CeilingInput, group: CeilingPaintGroup): number {
    return input.rows.reduce((s, r) => s + (r.paint === group ? ceilingRowArea(r) : 0), 0);
}

const row = (code: CeilingCode, width: number, length: number, location: string, paint: CeilingPaintGroup, slope?: number): CeilingRow =>
    (slope === undefined ? { code, width, length, location, paint } : { code, width, length, location, paint, slope });

export const ceiling = defineCalculator<CeilingInput>({
    id: 'ceiling',
    sheetName: 'ฝ้าเพดาน_Ceiling',
    title: 'โปรแกรมถอดแบบ – งานฝ้าเพดาน Ceiling',
    titleEn: 'Ceiling',
    sections: [19],
    deps: [],
    defaults: () => ({
        rows: [
            row('C1', 3, 3, 'ทานอาหาร', 'ภายใน'),
            row('C1', 3, 3, 'ครัว', 'ภายใน'),
            row('C1', 3, 5, 'รับแขก', 'ภายใน'),
            row('C1', 1.2, 2, 'โถงทางเดิน (1)', 'ภายใน'),
            row('C1', 1.2, 1.5, 'โถงทางเดิน (2)', 'ภายใน'),
            row('C1', 3.5, 3.5, 'ห้องนอน 1 (1)', 'ภายใน'),
            row('C1', 1.2, 1.5, 'ห้องนอน 1 (2)', 'ภายใน'),
            row('C1', 3, 4, 'ห้องนอน 2', 'ภายใน'),
            row('C1', 3, 3, 'ห้องนอน 3', 'ภายใน'),
            row('C2', 2.3, 3, 'ห้องน้ำ 1', 'ภายใน'),
            row('C2', 1.8, 2, 'ห้องน้ำ 2', 'ภายใน'),
            row('C2', 1, 3.5, 'เฉลียง 1', 'ภายใน', SLOPED_CEILING_DEG),
            row('C2', 1, 4, 'เฉลียง 2', 'ภายใน', SLOPED_CEILING_DEG),
            row('C3', 0.6, 62.3, 'ชายคาภายนอก', 'ภายนอก'),
            row('C4', 1, 1, 'เฉลียงพักผ่อน (1)', 'ไม้ระแนง'),
            row('C4', 3.5, 4, 'เฉลียงพักผ่อน (2)', 'ไม้ระแนง'),
            row('C4', 1.5, 3, 'เฉลียงพักผ่อน (3)', 'ไม้ระแนง'),
        ],
    }),
    // A real project: no rooms yet (the sheet has no prices or constants of its own — they sit in the BOQ).
    blank: () => ({ rows: [] }),
    compute: input => {
        const c1 = ceilingAreaByCode(input, 'C1');
        const c2 = ceilingAreaByCode(input, 'C2');
        const c3 = ceilingAreaByCode(input, 'C3');
        const c4 = ceilingAreaByCode(input, 'C4');
        const out: Record<string, number> = {
            C1: c1, C2: c2, C3: c3, C4: c4,
            total: input.rows.reduce((s, r) => s + ceilingRowArea(r), 0),
            R199: c1,   // E199 = IFERROR(SUMIF(Ceiling!B:B,"C1",Ceiling!F:F),0)
            R200: c2,
            R201: c3,
            R202: c4,
        };
        for (const g of CEILING_PAINT_GROUPS) out[paintKey(g)] = ceilingAreaByPaint(input, g);
        return out;
    },
    boqLinks: [
        { line: 'R199', field: 'qty', output: 'R199' },
        { line: 'R200', field: 'qty', output: 'R200' },
        { line: 'R201', field: 'qty', output: 'R201' },
        { line: 'R202', field: 'qty', output: 'R202' },
    ],
});
