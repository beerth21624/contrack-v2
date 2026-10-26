// ─── Small helpers for fan-out to the decision model (no dependency) ───

/** Splits `items` into consecutive groups of at most `size`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

/** `fn` over every item, at most `limit` running at once; results in input order. */
export async function mapConcurrent<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    let next = 0;
    const worker = async (): Promise<void> => {
        for (;;) {
            const i = next;
            next += 1;
            const item = items[i];
            if (i >= items.length || item === undefined) return;
            results[i] = await fn(item, i);
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
    return results;
}
