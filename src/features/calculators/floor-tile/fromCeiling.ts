// "คัดลอกห้องจากฝ้าเพดาน": the rooms typed on the ceiling step become new, editable floor rows (names and sizes only).
import type { CeilingCode, CeilingRow } from '@/domain/calculators/ceiling';
import type { FloorTileCode, FloorTileRow } from '@/domain/calculators/floor-tile';

export interface RoomsFromCeiling {
    /** New floor rows, in ceiling order. */
    rows: FloorTileRow[];
    /** Bathrooms left out (their floor is on the bathroom-tile step). */
    skippedBathrooms: number;
    /** Exterior eaves left out (no floor under them). */
    skippedEaves: number;
    /** Rooms the floor list already has (same name). */
    skippedExisting: number;
}

/** A bathroom by its name (the bathroom-tile step has its own floor). */
export const isBathroomName = (name: string): boolean => /ห้องน้ำ|ห้องส้วม|ส้วม|toilet|bath|wc/i.test(name);

/**
 * Usual floor of a room by its ceiling: plain gypsum → granito; moisture-resistant gypsum and slat ceilings sit over
 * verandas → non-slip granito (as in the Excel sample). A row without a type gets granito; the user checks it.
 */
const FLOOR_FOR: Record<CeilingCode, FloorTileCode | undefined> = { C1: 'F1', C2: 'F3', C3: undefined, C4: 'F3' };

/** Ceiling rooms as new floor rows, leaving out eaves, bathrooms, empty rows and names already on the floor list. */
export function roomsFromCeiling(ceilingRows: readonly CeilingRow[], floorRows: readonly FloorTileRow[]): RoomsFromCeiling {
    const existing = new Set(floorRows.map(r => r.location.trim()).filter(n => n !== ''));
    const out: RoomsFromCeiling = { rows: [], skippedBathrooms: 0, skippedEaves: 0, skippedExisting: 0 };
    for (const r of ceilingRows) {
        const name = r.location.trim();
        if (r.code === 'C3') { out.skippedEaves++; continue; }
        if (isBathroomName(name)) { out.skippedBathrooms++; continue; }
        if (name !== '' && existing.has(name)) { out.skippedExisting++; continue; }
        if (name === '' && !(r.width > 0) && !(r.length > 0)) continue;
        const code = r.code === '' ? 'F1' : FLOOR_FOR[r.code] ?? 'F1';
        out.rows.push({ code, width: r.width, length: r.length, location: name });
    }
    return out;
}
