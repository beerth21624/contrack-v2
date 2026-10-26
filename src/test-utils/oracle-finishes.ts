// Oracle input mappings shared by the finishes oracle tests (TEST ONLY): the ceiling and wall-finishing sheets are
// driven by their own oracle tests and by the paint oracle test (paint reads both). See docs/rebuild/ORACLE_TESTS.md.
import {
    CEILING_CODES, CEILING_DEFAULT_PAINT, CEILING_DESCRIPTIONS, CEILING_PAINT_GROUPS, SLOPED_CEILING_DEG,
    type CeilingInput, type CeilingPaintGroup, type CeilingRow,
} from '../domain/calculators/ceiling';
import {
    MOULDING_0_1, MOULDING_0_3, SLAT_WALL, WALL_FINISHING_CODES, wallFinishingKind,
    type WallFinishingInput, type WallFinishingRow,
} from '../domain/calculators/wall-finishing';
import type { OracleInput } from './excel-oracle';
import type { Random } from './oracle-helpers';

const blankToNull = (v: string | number | undefined): OracleInput => (v === undefined || v === '' ? null : v);

// ─── ฝ้าเพดาน_Ceiling (sheet 15) ─────────────────────────────────────────────

export const CEILING_SHEET = 'ฝ้าเพดาน_Ceiling';
/** F = D*E on rows 5–15 and 18–28; F = (D*E)/COS(RADIANS(40)) on rows 16–17 only (oddity O-1). */
export const CEILING_FLAT_ROWS = [...Array.from({ length: 11 }, (_, i) => 5 + i), ...Array.from({ length: 11 }, (_, i) => 18 + i)];
export const CEILING_SLOPED_ROWS = [16, 17];
export const CEILING_ALL_ROWS = Array.from({ length: 24 }, (_, i) => 5 + i);

/** Dropdown H5:H28, verbatim (the ไม้ระแนง option has a trailing space; the oracle trims text). */
export const CEILING_PAINT_EXCEL: Record<CeilingPaintGroup, string> = {
    ภายใน: 'ทาสีฝ้า - ภายใน', ภายนอก: 'ทาสีฝ้า - ภายนอก', ไม้ระแนง: 'ทาสีฝ้า - ไม้ระแนง ',
};

const isSloped = (r: CeilingRow) => {
    const s = r.slope ?? 0;
    if (s === 0) return false;
    if (s === SLOPED_CEILING_DEG) return true;
    throw new Error(`Excel has no ${s}° ceiling row (only 0° and the 40° rows 16–17)`);
};

/**
 * Excel row of each ceiling row (same order as input.rows). The slope is a per-row input in the app but a per-row
 * formula in Excel, so a 40° row goes to the next free row of 16–17 and a flat row to the next of 5–15, 18–28.
 */
export function ceilingExcelRows(input: CeilingInput): number[] {
    let flat = 0;
    let sloped = 0;
    return input.rows.map(r => {
        const row = isSloped(r) ? CEILING_SLOPED_ROWS[sloped++] : CEILING_FLAT_ROWS[flat++];
        if (row === undefined) throw new Error('Excel has 22 flat ceiling rows and 2 sloped (40°) rows');
        return row;
    });
}

/** The ceiling cells a user would type in Excel (unused rows cleared). */
export function ceilingExcelInputs(input: CeilingInput): Record<string, OracleInput> {
    const out: Record<string, OracleInput> = {};
    for (const row of CEILING_ALL_ROWS) for (const col of ['B', 'C', 'D', 'E', 'G', 'H']) out[`${CEILING_SHEET}!${col}${row}`] = null;
    const rows = ceilingExcelRows(input);
    input.rows.forEach((r, i) => {
        const at = (col: string) => `${CEILING_SHEET}!${col}${rows[i] ?? 0}`;
        out[at('B')] = blankToNull(r.code);
        out[at('C')] = r.code === '' ? null : CEILING_DESCRIPTIONS[r.code];
        out[at('D')] = r.width;
        out[at('E')] = r.length;
        out[at('G')] = blankToNull(r.location);
        out[at('H')] = r.paint === '' ? null : CEILING_PAINT_EXCEL[r.paint];
    });
    return out;
}

const ROOMS = ['ห้องนอน', 'ครัว', 'รับแขก', 'ห้องน้ำ', 'เฉลียง', 'ชายคา', ''];

export function randomCeilingRow(rng: Random, sloped: boolean): CeilingRow {
    const code = rng.chance(0.1) ? '' : rng.pick(CEILING_CODES);
    const p = rng.next();
    // mostly the type's usual group, sometimes another group or none (the groups are independent of the code)
    const paint: CeilingPaintGroup | '' = p < 0.15 ? '' : p < 0.35 || code === '' ? rng.pick(CEILING_PAINT_GROUPS) : CEILING_DEFAULT_PAINT[code];
    const row: CeilingRow = {
        code,
        width: rng.chance(0.05) ? 0 : rng.step(0.5, 5, 0.05),
        length: rng.step(0.5, 8, 0.05),
        location: rng.pick(ROOMS),
        paint,
    };
    if (sloped) row.slope = SLOPED_CEILING_DEG;
    else if (rng.chance(0.2)) row.slope = 0;   // explicit 0° = flat
    return row;
}

export function randomCeilingInput(rng: Random): CeilingInput {
    const full = rng.chance(0.05);
    const nFlat = full ? CEILING_FLAT_ROWS.length : rng.pick([0, 1, 2, 3, 4, 6, 8, 12]);
    const nSloped = full ? 2 : rng.pick([0, 0, 1, 2]);
    const rows = [
        ...Array.from({ length: nFlat }, () => randomCeilingRow(rng, false)),
        ...Array.from({ length: nSloped }, () => randomCeilingRow(rng, true)),
    ];
    return { rows: shuffle(rng, rows) };
}

// ─── ตกแต่งผนัง_Wall Finishing (sheet 18) ───────────────────────────────────

export const WF_SHEET = 'ตกแต่งผนัง_Wall Finishing';
/** F = D+E only on rows 5–6 (moulding rows); G = D*E only on rows 7–15 (slat rows). */
export const WF_MOULDING_ROWS = [5, 6];
export const WF_AREA_ROWS = Array.from({ length: 9 }, (_, i) => 7 + i);

/**
 * Excel row of each wall-finishing row. Excel's formula depends on the row (F only on 5–6, G only on 7–15), so a
 * moulding row goes to the next free row of 5–6 and any other row (slat, or no item) to the next of 7–15.
 */
export function wallFinishingExcelRows(input: WallFinishingInput): number[] {
    let m = 0;
    let a = 0;
    return input.rows.map(r => {
        const row = wallFinishingKind(r) === 'moulding' ? WF_MOULDING_ROWS[m++] : WF_AREA_ROWS[a++];
        if (row === undefined) throw new Error('Excel has 2 moulding rows (5–6) and 9 area rows (7–15)');
        return row;
    });
}

export function wallFinishingExcelInputs(input: WallFinishingInput): Record<string, OracleInput> {
    const out: Record<string, OracleInput> = {};
    for (const row of [...WF_MOULDING_ROWS, ...WF_AREA_ROWS]) for (const col of ['B', 'C', 'D', 'E', 'H']) out[`${WF_SHEET}!${col}${row}`] = null;
    const rows = wallFinishingExcelRows(input);
    input.rows.forEach((r, i) => {
        const at = (col: string) => `${WF_SHEET}!${col}${rows[i] ?? 0}`;
        out[at('B')] = blankToNull(r.code);
        out[at('C')] = blankToNull(r.item);
        out[at('D')] = r.width;
        out[at('E')] = r.length;
        out[at('H')] = blankToNull(r.location);
    });
    return out;
}

export function randomWallFinishingInput(rng: Random): WallFinishingInput {
    const rows: WallFinishingRow[] = [];
    const nMoulding = rng.pick([0, 1, 1, 2, 2, 2]);
    for (let i = 0; i < nMoulding; i++) {
        rows.push({
            code: 'P2',
            item: rng.pick([MOULDING_0_3, MOULDING_0_1]),
            width: rng.chance(0.75) ? 0 : rng.step(0.1, 2, 0.1),    // F = D + E
            length: rng.step(1, 40, 0.1),
            location: rng.pick(['ผนังภายนอก', 'ผนังภายใน', '']),
        });
    }
    const nSlat = rng.chance(0.05) ? WF_AREA_ROWS.length : rng.pick([0, 1, 2, 2, 3, 4]);
    for (let i = 0; i < nSlat; i++) {
        const other = rng.chance(0.08);   // a row with no item: G = D*E in Excel, but no SUMIF matches it
        rows.push({
            code: rng.pick(WALL_FINISHING_CODES),
            item: other ? '' : SLAT_WALL,
            width: rng.step(0.5, 3, 0.05),
            length: rng.step(0.5, 6, 0.05),
            location: rng.pick(['ผนังเฉลียง', 'ผนังห้องนั่งเล่น', '']),
        });
    }
    return { rows: shuffle(rng, rows) };
}

function shuffle<T>(rng: Random, items: T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        const t = a[i];
        const u = a[j];
        if (t === undefined || u === undefined) continue;
        a[i] = u;
        a[j] = t;
    }
    return a;
}
