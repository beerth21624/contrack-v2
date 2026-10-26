// Sheet "ก่ออิฐ_Brick" (Excel v5 sheet 13) → BOQ (Home) section 17, rows 179–182.
// R183 เสาเอ็นและคานทับหลัง (= SUM E179:E182) and the ×2 full-brick prices are BOQ formulas (template);
// R185 ท่อร้อยสายไฟ comes from the electrical-pipe sheet. Net areas by wall part also feed the plaster sheet.
// Spec: docs/excel-spec/03-roof-brick-plaster-doors.md §4 and §7 (oddities 1, 2, 5).
import { defineCalculator, type CalcContext } from '../types';
import { BRICK_THICKNESSES, BRICK_TYPES, WALL_PARTS, openingKey } from '../door-window';

// Dropdowns B/C/D share their values with the door-window sheet (D/E/F).
export { BRICK_THICKNESSES, BRICK_TYPES, WALL_PARTS, openingKey };
/** Dropdown B5:B20 ส่วนผนัง in sheet 13's own order (same values as the door-window WALL_PARTS). */
export const BRICK_WALL_PARTS = ['ผนังภายในบ้าน', 'ผนังรอบบ้าน-พิเศษ', 'ผนังรอบบ้าน', 'ผนังภายนอกบ้าน'] as const;

/** สี่เหลี่ยม: G = E × F. สามเหลี่ยม (gable): G = 0.5 × E × F. */
export type WallShape = 'rect' | 'triangle';
export const WALL_SHAPES: readonly { value: WallShape; label: string }[] = [
    { value: 'rect', label: 'สี่เหลี่ยม' },
    { value: 'triangle', label: 'สามเหลี่ยม' },
];

export interface BrickWall {
    wallPart: string;   // B ส่วนผนัง
    brickType: string;  // C รายการ (ชนิดอิฐ)
    thickness: string;  // D ความหนา
    length: number;     // E ความยาว (ม.)
    height: number;     // F ความสูง (ม.)
    /**
     * Not a column in Excel: rows 5–7 carry `=E*F`, rows 8–20 `=0.5*E*F` (gable triangles; the formula also
     * leaks into the blank rows 11–20 — oddity 1). Made an explicit per-row choice; rows added here (and rows
     * without a value) are rectangles (D1).
     */
    shape?: WallShape;
}

export interface BrickInput {
    /** Excel rows 5–20 (16 rows, 6 used in the sample); decision D5: unlimited rows. */
    walls: BrickWall[];
}

/** Key of a wall row's group (wall part + brick type + thickness), as in the door-window outputs. */
const wallKey = (w: BrickWall) => openingKey(w.wallPart, w.brickType, w.thickness);

const num = (v: number) => (Number.isFinite(v) ? v : 0);

/**
 * Opening area per group (`opening|part|brick|thickness` → m²) from the door-window calculator
 * (Excel `SUMIFS(Door&Window!K, D, part, E, brick, F, thickness)`). No door-window outputs → no openings.
 */
export function brickOpenings(ctx: CalcContext): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(ctx.outputs('door-window') ?? {})) {
        if (!k.startsWith('opening|') || !Number.isFinite(v) || v === 0) continue;
        // Re-key with trimmed parts so trailing spaces still match (oddity 5).
        const [, part = '', type = '', thick = ''] = k.split('|');
        const key = openingKey(part, type, thick);
        out[key] = (out[key] ?? 0) + v;
    }
    return out;
}

/** G พื้นที่ผนัง. */
export const wallArea = (w: BrickWall) =>
    (w.shape === 'triangle' ? 0.5 : 1) * num(w.length) * num(w.height);

export interface BrickWallResult {
    area: number;     // G พื้นที่ผนัง (ตร.ม.)
    openings: number; // H พื้นที่ช่องเปิด (ตร.ม.)
    net: number;      // I รวม (ตร.ม.) = G − H
}

/**
 * Per-row G/H/I.
 *
 * Excel H = SUMIFS(door-window K, part, brick, thickness) on every row, so when two wall rows share the same
 * part/brick/thickness both subtract the full opening total (oddity 2). Decision D1: each opening group is
 * deducted once, shared among its matching rows in proportion to their wall area G (all of it to the first
 * matching row while they have no area). No row loses more than its share, and the totals by part / brick /
 * thickness — all that the BOQ and the plaster sheet read — do not depend on how it is shared.
 * With a single matching row (the Excel sample) H is the group total, exactly as Excel.
 */
export function brickWallResults(input: BrickInput, openings: Record<string, number>): BrickWallResult[] {
    const areas = input.walls.map(wallArea);
    const groups = new Map<string, number[]>();
    input.walls.forEach((w, i) => {
        const k = wallKey(w);
        groups.set(k, [...(groups.get(k) ?? []), i]);
    });
    const deducted = input.walls.map(() => 0);
    for (const [k, rows] of groups) {
        const total = openings[k] ?? 0;
        if (total === 0) continue;
        const sum = rows.reduce((s, i) => s + (areas[i] ?? 0), 0);
        let rest = total;
        rows.forEach((i, n) => {
            const last = n === rows.length - 1;
            const share = sum === 0 ? (n === 0 ? total : 0) : last ? rest : total * (areas[i] ?? 0) / sum;
            deducted[i] = share;
            rest -= share;
        });
    }
    return areas.map((area, i) => {
        const h = deducted[i] ?? 0;
        return { area, openings: h, net: area - h };
    });
}

/** Opening groups with no wall row of the same part/brick/thickness — Excel silently never deducts them. */
export function unmatchedOpenings(input: BrickInput, openings: Record<string, number>): Record<string, number> {
    const keys = new Set(input.walls.map(wallKey));
    return Object.fromEntries(Object.entries(openings).filter(([k, v]) => v !== 0 && !keys.has(k)));
}

/** What Excel's column H would deduct in total (each row subtracts its whole group) — for the D1 delta. */
export function excelStyleOpenings(input: BrickInput, openings: Record<string, number>): number {
    return input.walls.reduce((s, w) => s + (openings[wallKey(w)] ?? 0), 0);
}

/** BOQ rows 179–182: `SUMIFS(Brick!I:I, Brick!C:C, brick, Brick!D:D, thickness)`. */
export const BRICK_BOQ_ROWS = [
    { line: 'R179', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น' },
    { line: 'R180', brickType: 'อิฐมอญ', thickness: 'เต็มแผ่น' },
    { line: 'R181', brickType: 'อิฐมวลเบา', thickness: 'ครึ่งแผ่น' },
    { line: 'R182', brickType: 'อิฐมวลเบา', thickness: 'เต็มแผ่น' },
] as const;

/** Output key of the net brick area of one wall part (read by the plaster sheet's SUMIF on B). */
export const netByPartKey = (wallPart: string) => `net|${wallPart.trim()}`;

export const brick = defineCalculator<BrickInput>({
    id: 'brick',
    sheetName: 'ก่ออิฐ_Brick',
    title: 'โปรแกรมถอดแบบ – งานก่ออิฐ Brick',
    titleEn: 'Brickwork',
    sections: [17],
    deps: ['door-window'],
    defaults: () => ({
        walls: [
            // E5 typed `=9.5+7+2+3+8+3+2+3+1.5+3.5`
            { wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 42.5, height: 3.5, shape: 'rect' },
            // E6 typed `=2.2+3+1.3+3.4+4+3+3+3+2+1.8`
            { wallPart: 'ผนังภายในบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 26.7, height: 3.5, shape: 'rect' },
            // E7 typed `=1-1+1+1+0.5`
            { wallPart: 'ผนังภายนอกบ้าน', brickType: 'อิฐมอญ', thickness: 'เต็มแผ่น', length: 2.5, height: 3.5, shape: 'rect' },
            // Rows 8–10: gable triangles (G = 0.5*E*F).
            { wallPart: 'ผนังรอบบ้าน-พิเศษ', brickType: 'อิฐมวลเบา', thickness: 'ครึ่งแผ่น', length: 7, height: 3, shape: 'triangle' },
            { wallPart: 'ผนังรอบบ้าน-พิเศษ', brickType: 'อิฐมวลเบา', thickness: 'ครึ่งแผ่น', length: 6, height: 2.65, shape: 'triangle' },
            { wallPart: 'ผนังรอบบ้าน-พิเศษ', brickType: 'อิฐมวลเบา', thickness: 'ครึ่งแผ่น', length: 7, height: 3, shape: 'triangle' },
        ],
    }),
    compute: (input, ctx) => {
        const openings = brickOpenings(ctx);
        const rows = brickWallResults(input, openings);
        const out: Record<string, number> = {
            gross: rows.reduce((s, r) => s + r.area, 0),
            openings: rows.reduce((s, r) => s + r.openings, 0),
            net: rows.reduce((s, r) => s + r.net, 0),
            unmatchedOpenings: Object.values(unmatchedOpenings(input, openings)).reduce((s, v) => s + v, 0),
        };
        for (const b of BRICK_BOQ_ROWS) out[b.line] = 0;
        input.walls.forEach((w, i) => {
            const net = rows[i]?.net ?? 0;
            const k = netByPartKey(w.wallPart);
            out[k] = (out[k] ?? 0) + net;
            const b = BRICK_BOQ_ROWS.find(x => x.brickType === w.brickType.trim() && x.thickness === w.thickness.trim());
            if (b) out[b.line] = (out[b.line] ?? 0) + net;
        });
        return out;
    },
    boqLinks: BRICK_BOQ_ROWS.map(b => ({ line: b.line, field: 'qty' as const, output: b.line })),
});
