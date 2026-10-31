// ─── AR aging (docs/erp/02-domain-model.md §4.5) ───
// Open invoices (issued / partially_paid) by days past `due_date`, counted from today in Bangkok.
import { daysBetween } from '../dates/business-date';
import { round2 } from '../money/money';

export const AGING_BUCKETS = ['current', '1_30', '31_60', '61_90', 'over_90'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

/** Days past due (≤ 0 = not due yet). Dates are YYYY-MM-DD; `today` from `bangkokToday`. */
export function daysOverdue(dueDate: string, today: string): number {
    return daysBetween(dueDate, today);
}

export function agingBucket(dueDate: string, today: string): AgingBucket {
    const days = daysOverdue(dueDate, today);
    if (days <= 0) return 'current';
    if (days <= 30) return '1_30';
    if (days <= 60) return '31_60';
    if (days <= 90) return '61_90';
    return 'over_90';
}

export interface AgingItem {
    dueDate: string;
    /** Amount still to be received. */
    outstanding: number;
}

export interface AgingSummary {
    buckets: Record<AgingBucket, number>;
    total: number;
    /** Outstanding past due (everything but `current`). */
    overdue: number;
}

export function agingSummary(items: readonly AgingItem[], today: string): AgingSummary {
    const buckets = Object.fromEntries(AGING_BUCKETS.map(b => [b, 0])) as Record<AgingBucket, number>;
    for (const it of items) {
        const b = agingBucket(it.dueDate, today);
        buckets[b] = round2(buckets[b] + round2(it.outstanding));
    }
    const total = round2(AGING_BUCKETS.reduce((s, b) => s + buckets[b], 0));
    return { buckets, total, overdue: round2(total - buckets.current) };
}
