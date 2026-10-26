// Row helpers shared by the Excel-mirror sheet and the journey page of the door/window schedule.
import { ALUMINIUM, ALUMINIUM_RATES, itemCode, type OpeningRow } from '@/domain/calculators/door-window';

/**
 * NumberCell commits on every blur, even when only focused (its draft is the value rounded to 6 decimals).
 * A commit equal to the shown default must not turn the default price into a typed (frozen) one.
 */
const sameValue = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
export const priceCommit = (typed: number | null, shown: number, v: number | undefined): number | null | 'unchanged' => {
    if (v === undefined) return null;
    if (typed === null && sameValue(v, shown)) return 'unchanged';
    return v;
};

/** Next code of a block, e.g. "D10-" after D1–D9 (the code is the row's key in the BOQ). */
export const nextName = (rows: OpeningRow[], prefix: string): string => {
    const used = rows.map(r => itemCode(r.name)).filter(c => c.startsWith(prefix)).map(c => Number(c.slice(prefix.length)));
    return `${prefix}${Math.max(0, ...used) + 1}-`;
};

/**
 * "ทำซ้ำ" of row `i`: a copy (size, type, wall, prices) inserted right after it, with the next free code of the
 * block so the copy gets its own BOQ row ("D1-บานเปิด" → "D3-บานเปิด").
 */
export const duplicateOpeningRow = (rows: OpeningRow[], i: number, prefix: string): OpeningRow[] => {
    const src = rows[i];
    if (src === undefined) return rows;
    const rest = src.name.replace(/^\s*[A-Za-z]+\d+\s*-?\s*/, '');
    const copy: OpeningRow = { ...src, name: `${nextName(rows, prefix)}${rest}` };
    return [...rows.slice(0, i + 1), copy, ...rows.slice(i + 1)];
};

/** A new row keeps the previous row's type and wall settings; size starts empty. */
export const newOpeningRow = (rows: OpeningRow[], prefix: string): OpeningRow => {
    const prev = rows[rows.length - 1];
    return {
        name: nextName(rows, prefix),
        type: prev?.type ?? ALUMINIUM,
        wallPart: prev?.wallPart ?? 'ผนังรอบบ้าน',
        brick: prev?.brick ?? 'อิฐมอญ',
        thickness: prev?.thickness ?? 'ครึ่งแผ่น',
        count: 1, width: 0, height: 0,
        rate: ALUMINIUM_RATES.sliding, matPrice: null, labPrice: null,
    };
};
