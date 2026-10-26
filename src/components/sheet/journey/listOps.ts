// List helpers of the element cards (pure, so the card pages stay short).

/** `rows` with `copy` inserted right after row `i` (a "ทำซ้ำ" of that row). */
export function insertAfter<R>(rows: readonly R[], i: number, copy: R): R[] {
    return [...rows.slice(0, i + 1), copy, ...rows.slice(i + 1)];
}

/** `rows` with row `i` merged with `patch`. */
export function patchAt<R extends object>(rows: readonly R[], i: number, patch: Partial<R>): R[] {
    return rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
}

/** `rows` without row `i`. */
export function removeAt<R>(rows: readonly R[], i: number): R[] {
    return rows.filter((_, j) => j !== i);
}

/** The first of `names` no row uses yet ('' when every one is taken). */
export function nextFreeName(names: readonly string[], used: readonly string[]): string {
    return names.find(n => !used.includes(n)) ?? '';
}
