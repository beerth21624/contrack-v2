// Sheet "ฉาบปูน_Plaster" (Excel v5 sheet 14) → BOQ (Home) section 18, rows 189 (ภายนอก) and 190 (ภายใน).
// R191 วงกบประตูไม้ comes from the door-window sheet, R193–R195 from the electrical-cable sheet.
// Outputs `exterior` / `interior` also feed the paint sheet (sheet 19 C5/C6).
// Spec: docs/excel-spec/03-roof-brick-plaster-doors.md §5 and §7 (oddities 5, 11).
import { defineCalculator, type CalcContext } from '../types';
import { netByPartKey } from '../brick';

/** The wall part of the hard-coded structure row (columns/beams); it has no brick source. */
export const STRUCTURAL_WALL = 'ผนังโครงสร้าง';

/** Dropdown B5:B22, in the sheet's order. */
export const PLASTER_WALL_PARTS = ['ผนังภายในบ้าน', 'ผนังรอบบ้าน', 'ผนังรอบบ้าน-พิเศษ', 'ผนังภายนอกบ้าน', STRUCTURAL_WALL] as const;
/** Dropdown C5:C22. Excel's second value is `ฉาบภายใน ` (trailing space, oddity 5) — stored trimmed. */
export const PLASTER_KINDS = ['ฉาบภายนอก', 'ฉาบภายใน'] as const;
/** Dropdown D5:D22 ฉาบกี่ด้าน. */
export const PLASTER_SIDES = [1, 2] as const;

export interface PlasterRow {
    wallPart: string;   // B แยกส่วนผนัง
    kind: string;       // C รายการ (ฉาบภายนอก / ฉาบภายใน)
    sides: number;      // D ฉาบกี่ด้าน
    /**
     * Area of one face (ตร.ม.), typed — used only for ผนังโครงสร้าง, which Excel hard-codes as
     * `E11 = ((1*25)+(0.8*2.6*3))*D11` (= 31.24 per side; oddity 11). Kept as an editable default.
     */
    manualArea?: number;
}

export interface PlasterInput {
    /** Excel rows 5–22 (18 rows; only 5–11 have a formula). Decision D5: unlimited rows, every row computes. */
    rows: PlasterRow[];
}

const num = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : 0);

/** `1*25 + 0.8*2.6*3` — the Excel structure-wall area per side. */
export const STRUCTURAL_WALL_DEFAULT_AREA = 31.24;

/**
 * E รวม (ตร.ม.) = `IFERROR(SUMIF(Brick!B5:B1000, B, Brick!I5:I1000), 0) * D` — the net brick area of every brick
 * row with this wall part (any brick type / thickness) × the number of faces. The structure row uses its typed
 * area per side instead. A row with no wall part is 0.
 */
export function plasterRowArea(r: PlasterRow, ctx: CalcContext): number {
    const part = r.wallPart.trim();
    if (part === '') return 0;
    const perSide = part === STRUCTURAL_WALL
        ? num(r.manualArea)
        : num(ctx.outputs('brick')?.[netByPartKey(part)]);
    return perSide * num(r.sides);
}

/** BOQ `SUMIF(Plaster!C:C, kind, Plaster!E:E)` (compared trimmed). */
export function plasterTotal(input: PlasterInput, ctx: CalcContext, kind: string): number {
    return input.rows.reduce((s, r) => s + (r.kind.trim() === kind ? plasterRowArea(r, ctx) : 0), 0);
}

export const plaster = defineCalculator<PlasterInput>({
    id: 'plaster',
    sheetName: 'ฉาบปูน_Plaster',
    title: 'โปรแกรมถอดแบบ – งานฉาบปูน Plaster',
    titleEn: 'Plastering',
    sections: [18],
    deps: ['brick'],
    defaults: () => ({
        rows: [
            { wallPart: 'ผนังรอบบ้าน', kind: 'ฉาบภายใน', sides: 1 },
            { wallPart: 'ผนังรอบบ้าน', kind: 'ฉาบภายนอก', sides: 1 },
            { wallPart: 'ผนังภายในบ้าน', kind: 'ฉาบภายใน', sides: 2 },
            { wallPart: 'ผนังภายนอกบ้าน', kind: 'ฉาบภายนอก', sides: 2 },
            { wallPart: 'ผนังรอบบ้าน-พิเศษ', kind: 'ฉาบภายใน', sides: 1 },
            { wallPart: 'ผนังรอบบ้าน-พิเศษ', kind: 'ฉาบภายนอก', sides: 1 },
            { wallPart: STRUCTURAL_WALL, kind: 'ฉาบภายนอก', sides: 1, manualArea: STRUCTURAL_WALL_DEFAULT_AREA },
        ],
    }),
    compute: (input, ctx) => {
        const exterior = plasterTotal(input, ctx, 'ฉาบภายนอก');
        const interior = plasterTotal(input, ctx, 'ฉาบภายใน');
        return {
            exterior,
            interior,
            total: exterior + interior,
            R189: exterior,  // E189 = SUMIF(C,"ฉาบภายนอก",E)
            R190: interior,  // E190 = SUMIF(C,"ฉาบภายใน",E)
        };
    },
    boqLinks: [
        { line: 'R189', field: 'qty', output: 'R189' },
        { line: 'R190', field: 'qty', output: 'R190' },
    ],
});
