// ─── Wage sets (อัตราค่าแรง) of the Man-Day sheet ─────────────────────────────
// Excel hard-codes two sets in the R formulas: A 800/500 (งานทั่วไป) and B 1000/600 (หลังคา ไฟฟ้า ฝ้า สี
// อลูมิเนียม เบ็ดเตล็ด). The app keeps them as an ordered list: A and B are built in (name and rates
// editable, never removed) and a project may add its own sets. docs/workforce/00-crew-management-design.md §2.
//
// Stored inputs from before the list used `wageSets: { A: {skilled, labourer}, B: {...} }`;
// normaliseWageSets reads both shapes, so no data migration is needed.
import type { BuiltInWageSetId, WageSetId } from './tasks';

export interface WageRate {
    skilled: number;    // ฿/day per ช่าง
    labourer: number;   // ฿/day per คนงาน
}

/** One wage set: a name and the daily wage of one ช่าง and one คนงาน. */
export interface WageSet extends WageRate {
    /** 'A' / 'B' for the Excel sets; generated ('C', 'D', …) for the sets a user adds. */
    id: WageSetId;
    /** Thai name shown next to the id (may be empty for a user set). */
    name: string;
}

export const BUILT_IN_WAGE_SET_IDS: readonly BuiltInWageSetId[] = ['A', 'B'];

/** The Excel v5 sets (decision D16). */
export function builtInWageSets(): WageSet[] {
    return [
        { id: 'A', name: 'งานทั่วไป', skilled: 800, labourer: 500 },
        { id: 'B', name: 'หลังคา ไฟฟ้า ฝ้า สี อลูมิเนียม เบ็ดเตล็ด', skilled: 1000, labourer: 600 },
    ];
}

export const isBuiltInWageSet = (id: string): id is BuiltInWageSetId => id === 'A' || id === 'B';

/** Limits shared with the document validation (src/domain/sync). */
export const WAGE_SET_LIMITS = { maxSets: 50, maxIdLength: 40, maxNameLength: 100 } as const;

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** A stored rate field: a number as is, missing → the fallback, anything else → 0 (what the formula made of it before). */
function rateField(stored: Record<string, unknown>, key: keyof WageRate, fallback: number): number {
    if (!(key in stored) || stored[key] === undefined) return fallback;
    const v = stored[key];
    return typeof v === 'number' ? v : 0;
}

function readSet(id: string, stored: Record<string, unknown>, fallback: WageSet | undefined): WageSet {
    return {
        id,
        name: typeof stored.name === 'string' ? stored.name : fallback?.name ?? '',
        skilled: rateField(stored, 'skilled', fallback?.skilled ?? 0),
        labourer: rateField(stored, 'labourer', fallback?.labourer ?? 0),
    };
}

/**
 * Stored wage sets (the list, the older `{ A, B }` record, partial or missing) → a complete list:
 * every entry has id / name / rates, ids are unique, and A and B are always there (missing fields and
 * missing built-in sets come from `base`, default the Excel sets).
 */
export function normaliseWageSets(stored: unknown, base: readonly WageSet[] = builtInWageSets()): WageSet[] {
    const baseOf = (id: string) => base.find(s => s.id === id) ?? builtInWageSets().find(s => s.id === id);
    const out: WageSet[] = [];
    const seen = new Set<string>();
    const push = (set: WageSet) => {
        if (seen.has(set.id)) return;
        seen.add(set.id);
        out.push(set);
    };
    if (Array.isArray(stored)) {
        for (const entry of stored) {
            if (!isObject(entry) || typeof entry.id !== 'string' || entry.id === '') continue;
            push(readSet(entry.id, entry, baseOf(entry.id)));
        }
    } else if (isObject(stored)) {
        // Older shape: { A: {skilled, labourer}, B: {...} } — each entry over its default.
        for (const set of base) {
            const v = stored[set.id];
            push(isObject(v) ? readSet(set.id, v, set) : { ...set });
        }
        for (const [id, v] of Object.entries(stored)) if (isObject(v) && id !== '') push(readSet(id, v, baseOf(id)));
    } else {
        for (const set of base) push({ ...set });
    }
    // A and B can't be removed: put back the missing ones, in front, in their order.
    const missing = BUILT_IN_WAGE_SET_IDS.filter(id => !seen.has(id)).map(id => baseOf(id)).filter((s): s is WageSet => s !== undefined);
    return [...missing.map(s => ({ ...s })), ...out];
}

export const findWageSet = (sets: readonly WageSet[], id: string): WageSet | undefined => sets.find(s => s.id === id);

/**
 * The set a block uses: its own id, or — when that id is unknown (a deleted set, a typo in a stored
 * document) — the task's Excel default set, or the Excel constants of that set.
 */
export function resolveWageSet(sets: readonly WageSet[], id: string, fallbackId: BuiltInWageSetId): WageSet {
    const fallback = builtInWageSets().find(s => s.id === fallbackId) ?? { id: fallbackId, name: '', skilled: 0, labourer: 0 };
    return findWageSet(sets, id) ?? findWageSet(sets, fallbackId) ?? fallback;
}

/** Spreadsheet-style letters after A and B: C, D, …, Z, AA, AB, … — the first one not in use. */
export function nextWageSetId(sets: readonly WageSet[]): WageSetId {
    const used = new Set(sets.map(s => s.id));
    const letters = (n: number): string => (n < 26 ? '' : letters(Math.floor(n / 26) - 1)) + String.fromCharCode(65 + (n % 26));
    let n = 2;
    while (used.has(letters(n))) n++;
    return letters(n);
}

/** "A · งานทั่วไป" (the id alone when the set has no name). */
export function wageSetLabel(set: WageSet): string {
    const name = set.name.trim();
    return name === '' ? `ชุด ${set.id}` : `${set.id} · ${name}`;
}

// ─── Edits on the Man-Day input ─────────────────────────────────────────────
// Generic over the input so this file needs nothing from ./manday (which imports it).
interface WageSetsHolder { wageSets: WageSet[]; blocks: Record<string, { wageSet: WageSetId }> }

/** Adds a set at the end with a generated id (rates default to set A). Returns the input and the new id. */
export function addWageSet<T extends WageSetsHolder>(
    input: T, init: Partial<Omit<WageSet, 'id'>> = {},
): { input: T; id: WageSetId } {
    const id = nextWageSetId(input.wageSets);
    const a = resolveWageSet(input.wageSets, 'A', 'A');
    const set: WageSet = { id, name: init.name ?? '', skilled: init.skilled ?? a.skilled, labourer: init.labourer ?? a.labourer };
    return { input: { ...input, wageSets: [...input.wageSets, set] }, id };
}

/** Renames a set or changes its rates (built-in sets too). Unknown ids leave the input unchanged. */
export function updateWageSet<T extends WageSetsHolder>(input: T, id: WageSetId, patch: Partial<Omit<WageSet, 'id'>>): T {
    if (!input.wageSets.some(s => s.id === id)) return input;
    return { ...input, wageSets: input.wageSets.map(s => (s.id === id ? { ...s, ...patch, id } : s)) };
}

/** Task ids of the blocks that use a set. */
export function wageSetUsage(input: WageSetsHolder, id: WageSetId): string[] {
    return Object.entries(input.blocks).filter(([, b]) => b.wageSet === id).map(([taskId]) => taskId);
}

/**
 * Deletes a user set; the blocks that used it move to set A (the UI asks first and says how many).
 * Built-in sets (A, B) can't be deleted: the input comes back unchanged.
 */
export function removeWageSet<T extends WageSetsHolder>(input: T, id: WageSetId): T {
    if (isBuiltInWageSet(id) || !input.wageSets.some(s => s.id === id)) return input;
    const blocks = Object.fromEntries(Object.entries(input.blocks).map(([taskId, b]) => [taskId, b.wageSet === id ? { ...b, wageSet: 'A' } : b])) as T['blocks'];
    return { ...input, wageSets: input.wageSets.filter(s => s.id !== id), blocks };
}
