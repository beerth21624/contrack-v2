// ─── Site diary progress (docs/erp/02-domain-model.md §8.1): latest cumulative progress per cost code, budget-weighted ───
// Pure. Progress values are fractions 0–1.

/** One work item of a submitted report. */
export interface ReportedProgress {
    reportDate: string;
    costCodeId: string;
    progressAfter: number;
}

/** A cost code's weight (its budget_total; codes ≤ 0 weigh nothing). */
export interface ProgressWeight {
    costCodeId: string;
    budget: number;
}

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Latest `progressAfter` per cost code (the latest report date wins; items given in any order). */
export function latestProgress(items: readonly ReportedProgress[]): Map<string, { progress: number; reportDate: string }> {
    const out = new Map<string, { progress: number; reportDate: string }>();
    for (const i of items) {
        const cur = out.get(i.costCodeId);
        if (cur === undefined || i.reportDate > cur.reportDate) out.set(i.costCodeId, { progress: clamp01(i.progressAfter), reportDate: i.reportDate });
    }
    return out;
}

/** Σ budget × progress / Σ budget (null when no budget). */
export function weightedProgress(progress: ReadonlyMap<string, number>, weights: readonly ProgressWeight[]): number | null {
    let total = 0;
    let done = 0;
    for (const w of weights) {
        if (!(w.budget > 0)) continue;
        total += w.budget;
        done += w.budget * clamp01(progress.get(w.costCodeId) ?? 0);
    }
    return total > 0 ? Math.round((done / total) * 1e6) / 1e6 : null;
}

/**
 * The actual S-curve: after each report date (oldest first), the budget-weighted progress using every cost code's
 * latest `progressAfter` on or before that date. [] when there is no budget.
 */
export function actualProgressSeries(items: readonly ReportedProgress[], weights: readonly ProgressWeight[]): { date: string; pct: number }[] {
    const dates = [...new Set(items.map(i => i.reportDate))].sort();
    const sorted = [...items].sort((a, b) => (a.reportDate < b.reportDate ? -1 : a.reportDate > b.reportDate ? 1 : 0));
    const current = new Map<string, number>();
    const out: { date: string; pct: number }[] = [];
    let k = 0;
    for (const date of dates) {
        while (k < sorted.length && (sorted[k]?.reportDate ?? '') <= date) {
            const i = sorted[k];
            if (i !== undefined) current.set(i.costCodeId, clamp01(i.progressAfter));
            k += 1;
        }
        const pct = weightedProgress(current, weights);
        if (pct === null) return [];
        out.push({ date, pct });
    }
    return out;
}
