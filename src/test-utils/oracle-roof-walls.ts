// Oracle input mappings shared by the roof / wall oracle tests (TEST ONLY): roofing is driven by its own oracle
// test and by roof-structure's (which reads the slope area K7); door-window by its own, brick's chain and plaster's
// (plaster ← brick ← door-window). See docs/rebuild/ORACLE_TESTS.md.
import { type BrickInput, type BrickWall } from '../domain/calculators/brick';
import {
    ALUMINIUM, WOOD, WOOD_DEFAULT_PRICE, scheduleRows, type DoorWindowInput, type OpeningRow,
} from '../domain/calculators/door-window';
import { type RoofingInput, type RoofingTakeoff } from '../domain/calculators/roofing';
import type { OracleCellInput, OracleFormula } from './excel-oracle';

const blankToNull = (v: string | number | undefined): OracleCellInput => (v === undefined || v === '' ? null : v);
const formula = (f: string | null): OracleFormula => ({ formula: f });
/** A number as formula text (plan dimensions are typed to a few decimals: no exponent notation). */
const n = (x: number) => {
    const s = String(x);
    if (/e/i.test(s)) throw new Error(`oracle-roof-walls: ${s} cannot be typed into a formula`);
    return s;
};

// ─── มุงหลังคา_Roofing (sheet 23) ────────────────────────────────────────────

export const ROOFING_SHEET = 'มุงหลังคา_Roofing';
/** Table rows 5–21 (17 rows). */
export const ROOFING_FIRST_ROW = 5;
export const ROOFING_EXCEL_ROWS = 17;
/** G formula of the Excel row (fixed per row, oddity 16): G5:G11 and G18:G21 multiply, G12:G17 divide. */
export const roofingExcelOp = (i: number): 'mul' | 'div' => (i >= 7 && i <= 12 ? 'div' : 'mul');

/** Dropdown B5:B21, verbatim (several items carry a trailing space; the oracle trims text). */
const ROOFING_ITEM_EXCEL: Record<string, string> = Object.fromEntries([
    'กระเบื้องหลังคาซีแพคโมเนีย', 'ครอบข้างจั่ว ', 'ครอบข้างผนัง ', 'ครอบโค้ง 2 ทาง', 'ครอบโค้ง 3 ทาง', 'ครอบโค้ง 4 ทาง',
    'ครอบโค้งหางมน', 'ครอบปิดจั่ว', 'ครอบปิดชาย', 'ครอบสันโค้ง ', 'ชุดครอบข้างผนัง ', 'ชุดครอบระบบแห้ง DRYTECH ',
    'แผ่นปิดกันนก ', 'แผ่นสะท้อนความร้อน (1.25 x 60 ม./ม้วน)', 'ไม้เชิงชาย ', 'รางน้ำตะเข้ ',
].map(s => [s.trim(), s]));

/** E ปริมาณถอดแบบ as the user types it: `=K7`, a sum `=2.4+9.2`, the rake `=(…)/COS(RADIANS(40))`, a link `=E6`. */
function roofingTakeoffFormula(t: RoofingTakeoff, rowOfKey: (key: string) => number | undefined): OracleFormula {
    switch (t.kind) {
        case 'slope': return formula('=K7');
        case 'lengths': return formula(t.lengths.length === 0 ? null : `=${t.lengths.map(n).join('+')}`);
        case 'rake': return formula(`=(${t.lengths.length === 0 ? '0' : t.lengths.map(n).join('+')})/COS(RADIANS(${n(t.deg)}))`);
        case 'row': {
            const r = rowOfKey(t.ref);
            if (r === undefined) throw new Error(`roofing row reference ${t.ref} has no Excel row (Excel would show #REF!)`);
            return formula(`=E${r}`);
        }
    }
}

/** The roofing cells a user would type in Excel (K5, K6 and table rows 5–21; unused rows cleared). */
export function roofingExcelInputs(input: RoofingInput): Record<string, OracleCellInput> {
    if (input.rows.length > ROOFING_EXCEL_ROWS) throw new Error(`Excel has ${ROOFING_EXCEL_ROWS} roofing rows`);
    const out: Record<string, OracleCellInput> = {
        [`${ROOFING_SHEET}!K5`]: input.planArea,
        [`${ROOFING_SHEET}!K6`]: input.slopeDeg,
    };
    const rowOf = new Map(input.rows.map((r, i) => [r.key, ROOFING_FIRST_ROW + i]));
    for (let i = 0; i < ROOFING_EXCEL_ROWS; i++) {
        const row = ROOFING_FIRST_ROW + i;
        const r = input.rows[i];
        const at = (col: string) => `${ROOFING_SHEET}!${col}${row}`;
        out[at('B')] = r ? blankToNull(ROOFING_ITEM_EXCEL[r.item.trim()] ?? r.item) : null;
        out[at('C')] = r ? r.factor : null;
        out[at('D')] = r ? blankToNull(r.factorUnit) : null;
        out[at('E')] = r ? roofingTakeoffFormula(r.takeoff, k => rowOf.get(k)) : formula(null);
        out[at('F')] = r ? blankToNull(r.takeoffUnit) : null;
        out[at('H')] = r ? blankToNull(r.unit) : null;
    }
    return out;
}

// ─── ประตู-หน้าต่าง_Door&Window (sheet 12) + its BOQ price cells ─────────────

export const DOORS_SHEET = 'ประตู-หน้าต่าง_Door&Window';
/** Door rows 6–16 (row 15 has no J/K formula — oddity 3) and window rows 18–25. */
export const DOOR_ROWS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
export const DOOR_ROWS_WITH_FORMULA = [6, 7, 8, 9, 10, 11, 12, 13, 14, 16];
export const WINDOW_ROWS = [18, 19, 20, 21, 22, 23, 24, 25];
/** BOQ (Home) rows of the FILTER spills: section 24 aluminium 234–242, section 30 wood 294–297. */
export const ALUMINIUM_BOQ_ROWS = Array.from({ length: 9 }, (_, i) => 234 + i);
export const WOOD_BOQ_ROWS = [294, 295, 296, 297];
/** Dropdown C6:C25, verbatim (the aluminium value has a trailing space; FILTER/SUMIF still match it trimmed). */
const DOOR_TYPE_EXCEL: Record<string, string> = { [WOOD]: 'บานไม้', [ALUMINIUM]: 'บานอลูมิเนียม ' };

/**
 * Excel row of each door and window (same order as the input). Up to 10 doors skip row 15 (no J/K formula), so
 * every opening computes, in schedule order; an 11th door needs row 15 (Excel then leaves its area out — D1).
 */
export function doorWindowExcelRows(input: DoorWindowInput): { doors: number[]; windows: number[] } {
    if (input.doors.length > DOOR_ROWS.length) throw new Error(`Excel has ${DOOR_ROWS.length} door rows`);
    if (input.windows.length > WINDOW_ROWS.length) throw new Error(`Excel has ${WINDOW_ROWS.length} window rows`);
    const doors = input.doors.length <= DOOR_ROWS_WITH_FORMULA.length ? DOOR_ROWS_WITH_FORMULA : DOOR_ROWS;
    return { doors: doors.slice(0, input.doors.length), windows: WINDOW_ROWS.slice(0, input.windows.length) };
}

/** BOQ I (material per set) as the owner types it: aluminium `=W*H*rate` (Excel I234 `=2.6*2.05*3000`), wood 4,000. */
function matPriceCell(r: OpeningRow): OracleCellInput {
    if (r.matPrice !== null) return r.matPrice;
    if (r.type.trim() === ALUMINIUM) return formula(`=${n(r.width)}*${n(r.height)}*${n(r.rate)}`);
    return WOOD_DEFAULT_PRICE.mat;
}
const labPriceCell = (r: OpeningRow): OracleCellInput => r.labPrice ?? (r.type.trim() === WOOD ? WOOD_DEFAULT_PRICE.lab : 0);

/**
 * The door/window cells a user would type (rows 6–25, unused rows cleared), plus the unit prices typed on the BOQ
 * rows the FILTER spills fill (I/K 234–242 aluminium, 294–297 wood — Excel keeps prices by position, oddity 7).
 */
export function doorWindowExcelInputs(input: DoorWindowInput): Record<string, OracleCellInput> {
    const out: Record<string, OracleCellInput> = {};
    for (const row of [...DOOR_ROWS, ...WINDOW_ROWS]) {
        for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) out[`${DOORS_SHEET}!${col}${row}`] = null;
    }
    const rows = doorWindowExcelRows(input);
    const put = (r: OpeningRow, row: number) => {
        const at = (col: string) => `${DOORS_SHEET}!${col}${row}`;
        out[at('B')] = blankToNull(r.name);
        out[at('C')] = blankToNull(DOOR_TYPE_EXCEL[r.type.trim()] ?? r.type);
        out[at('D')] = blankToNull(r.wallPart);
        out[at('E')] = blankToNull(r.brick);
        out[at('F')] = blankToNull(r.thickness);
        out[at('G')] = r.count;
        out[at('H')] = r.width;
        out[at('I')] = r.height;
    };
    input.doors.forEach((r, i) => put(r, rows.doors[i] ?? 0));
    input.windows.forEach((r, i) => put(r, rows.windows[i] ?? 0));
    const sched = scheduleRows(input).map(t => t.row);
    const prices = (type: string, boqRows: number[]) => {
        const of = sched.filter(r => r.type.trim() === type);
        boqRows.forEach((er, k) => {
            const r = of[k];
            out[`BOQ (Home)!I${er}`] = r ? matPriceCell(r) : null;
            out[`BOQ (Home)!K${er}`] = r ? labPriceCell(r) : null;
        });
    };
    prices(ALUMINIUM, ALUMINIUM_BOQ_ROWS);
    prices(WOOD, WOOD_BOQ_ROWS);
    return out;
}

// ─── ก่ออิฐ_Brick (sheet 13) ─────────────────────────────────────────────────

export const BRICK_SHEET = 'ก่ออิฐ_Brick';
/** Rows 5–7 hold G = E*F (rectangles), rows 8–20 G = 0.5*E*F (gable triangles; oddity 1). */
export const BRICK_RECT_ROWS = [5, 6, 7];
export const BRICK_TRIANGLE_ROWS = Array.from({ length: 13 }, (_, i) => 8 + i);
const BRICK_COLUMNS: readonly [keyof BrickWall, string][] = [
    ['wallPart', 'B'], ['brickType', 'C'], ['thickness', 'D'], ['length', 'E'], ['height', 'F'],
];

/** Excel row of each wall: a rectangle to the next free row of 5–7, a triangle to the next of 8–20. */
export function brickExcelRows(input: BrickInput): number[] {
    let rect = 0;
    let tri = 0;
    return input.walls.map(w => {
        const row = w.shape === 'triangle' ? BRICK_TRIANGLE_ROWS[tri++] : BRICK_RECT_ROWS[rect++];
        if (row === undefined) throw new Error('Excel has 3 rectangle rows (5–7) and 13 triangle rows (8–20)');
        return row;
    });
}

/** The brick cells a user would type in Excel (unused rows cleared). */
export function brickExcelInputs(input: BrickInput): Record<string, OracleCellInput> {
    const out: Record<string, OracleCellInput> = {};
    for (const row of [...BRICK_RECT_ROWS, ...BRICK_TRIANGLE_ROWS]) for (const [, col] of BRICK_COLUMNS) out[`${BRICK_SHEET}!${col}${row}`] = null;
    const rows = brickExcelRows(input);
    input.walls.forEach((w, i) => {
        for (const [field, col] of BRICK_COLUMNS) {
            const v = w[field];
            out[`${BRICK_SHEET}!${col}${rows[i] ?? 0}`] = typeof v === 'number' || typeof v === 'string' ? blankToNull(v) : null;
        }
    });
    return out;
}
