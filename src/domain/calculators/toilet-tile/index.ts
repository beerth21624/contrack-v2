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

// ─── Bathroom view (journey page): the rows of one ตำแหน่ง read as one bathroom ───

export type ToiletRowKind = 'floor' | 'wall' | 'other';

/** F3 rows are the floor, P3 rows the wall (by the BOQ key, like the SUMIF); anything else is shown as is. */
export function toiletRowKind(r: ToiletTileRow): ToiletRowKind {
    const code = r.code.trim().toUpperCase();
    return code === 'F3' ? 'floor' : code === 'P3' ? 'wall' : 'other';
}

/** A new floor (F3) or wall (P3) row of a bathroom, dimensions blank. */
export function newToiletRow(kind: 'floor' | 'wall', location: string): ToiletTileRow {
    return kind === 'floor'
        ? { code: 'F3', surface: 'พื้น', item: TOILET_TILE_ITEMS[0], location }
        : { code: 'P3', surface: 'ผนัง', item: TOILET_TILE_ITEMS[1], location };
}

/** A new bathroom: one floor row and one wall row. */
export const newBathroomRows = (location: string): ToiletTileRow[] =>
    [newToiletRow('floor', location), newToiletRow('wall', location)];

export interface BathroomGroup {
    /** ตำแหน่ง shared by the rows (trimmed; '' = rows without a location). */
    name: string;
    /** Indexes into `input.rows`, in row order. */
    rows: number[];
}

/** Rows grouped by ตำแหน่ง, in order of first appearance. */
export function bathroomGroups(input: ToiletTileInput): BathroomGroup[] {
    const groups: BathroomGroup[] = [];
    input.rows.forEach((r, i) => {
        const name = r.location.trim();
        const g = groups.find(x => x.name === name);
        if (g) g.rows.push(i);
        else groups.push({ name, rows: [i] });
    });
    return groups;
}

/** Wall length of a rectangular room: 2 × (W + L); undefined until both are filled. */
export function roomPerimeter(r: Pick<ToiletTileRow, 'width' | 'length'>): number | undefined {
    return filled(r.width) && filled(r.length) ? 2 * (r.width + r.length) : undefined;
}

/** The perimeter offered to a bathroom's wall rows: from its floor row, when it has exactly one. */
export function bathroomPerimeter(input: ToiletTileInput, name: string): number | undefined {
    const floors = input.rows.filter(r => r.location.trim() === name && toiletRowKind(r) === 'floor');
    return floors.length === 1 && floors[0] ? roomPerimeter(floors[0]) : undefined;
}

const same = (a: number | undefined, b: number | undefined) =>
    a !== undefined && b !== undefined && Math.abs(a - b) < 1e-9;

/**
 * Changes a floor row's width / length. Wall rows of the same bathroom whose length is still blank or still the
 * old 2 × (W + L) follow the new size (a length the user typed differently is kept).
 */
export function setBathroomFloorSize(
    input: ToiletTileInput, index: number, patch: Partial<Pick<ToiletTileRow, 'width' | 'length'>>,
): ToiletTileInput {
    const floor = input.rows[index];
    if (!floor) return input;
    const name = floor.location.trim();
    const oldPerimeter = bathroomPerimeter(input, name);
    const next = input.rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    const newPerimeter = bathroomPerimeter({ rows: next }, name);
    return {
        rows: next.map(r => (
            toiletRowKind(r) === 'wall' && r.location.trim() === name && newPerimeter !== undefined
                && (r.length === undefined || same(r.length, oldPerimeter))
                ? { ...r, length: newPerimeter }
                : r
        )),
    };
}

/** Renames a bathroom: every row of that ตำแหน่ง. */
export function renameBathroom(input: ToiletTileInput, from: string, to: string): ToiletTileInput {
    return { rows: input.rows.map(r => (r.location.trim() === from ? { ...r, location: to } : r)) };
}

/** A name not used yet: ห้องน้ำ 1, ห้องน้ำ 2, … */
export function nextBathroomName(input: ToiletTileInput): string {
    const used = new Set(input.rows.map(r => r.location.trim()));
    let n = bathroomGroups(input).length + 1;
    while (used.has(`ห้องน้ำ ${n}`)) n++;
    return `ห้องน้ำ ${n}`;
}

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
    // A real project: no bathrooms yet (prices sit in the BOQ, the sheet has no constants of its own).
    blank: () => ({ rows: [] }),
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
