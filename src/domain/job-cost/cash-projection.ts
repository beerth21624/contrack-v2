// ─── Cash projection (WP-47, docs/erp/02-domain-model.md §9) ───
// Weekly cash in / out: actual money (fin_events.cash, + = in, − = out) by event date, planned money (CashPlanItem from
// the modules: what is still outstanding) by its expected date. Weeks start on Monday. The window is `pastWeeks` weeks
// before the current week (actual only) plus `weeks` weeks from the current one; planned items dated before the
// current week are still outstanding, so they land in the current week. Balance runs from `opening` (the balance at
// the start of the window).
import { addDays, compareDates, daysBetween } from '../dates/business-date';
import { round2 } from '../money/money';

export type CashPlanDirection = 'in' | 'out';

/** Money a module expects to move (never something that already moved). */
export interface CashPlanItem {
    projectId: string;
    /** Expected date (YYYY-MM-DD). */
    date: string;
    direction: CashPlanDirection;
    /** Baht, > 0. */
    amount: number;
    /** What it comes from (invoice, milestone, purchase_order, labour, subcontract, supplier_bill). */
    source: string;
    /** Document number / label shown with the item. */
    ref: string;
}

/** Money that moved: signed cash on a date. */
export interface CashActual {
    date: string;
    cash: number;
}

export interface CashWeek {
    weekStart: string;
    weekEnd: string;
    /** Before the current week: actual figures only. */
    past: boolean;
    plannedIn: number;
    plannedOut: number;
    actualIn: number;
    actualOut: number;
    /** Balance at the end of the week. */
    balance: number;
}

export interface CashProjectionInput {
    /** Balance at the start of the window (see openingBalance). */
    opening: number;
    planned: readonly CashPlanItem[];
    actual: readonly CashActual[];
    /** Bangkok business date. */
    today: string;
    /** Weeks from the current one (default 13). */
    weeks?: number;
    /** Weeks shown before the current one (default 0). */
    pastWeeks?: number;
    /** firstBelowMin: the first week (current or later) whose balance is below this (default 0). */
    minBalance?: number;
}

export interface CashProjection {
    opening: number;
    weeks: CashWeek[];
    /** weekStart of the first current-or-later week whose balance < minBalance; null when none. */
    firstBelowMin: string | null;
    /** Lowest end-of-week balance from the current week on (null without weeks). */
    lowestBalance: number | null;
}

/** Monday of the week of `date`. */
export function weekStartOf(date: string): string {
    // 2024-01-01 was a Monday.
    const offset = ((daysBetween('2024-01-01', date) % 7) + 7) % 7;
    return addDays(date, -offset);
}

/** First day of the projection window (Monday). */
export function windowStart(today: string, pastWeeks = 0): string {
    return addDays(weekStartOf(today), -7 * pastWeeks);
}

/**
 * Balance at `start` from a known balance `base` on `asOf` (start of that day) and the actual cash moved between them:
 * later start → base + Σ cash in [asOf, start); earlier start → base − Σ cash in [start, asOf). `asOf` null → base + Σ
 * cash before start.
 */
export function openingBalance(base: number, asOf: string | null, actual: readonly CashActual[], start: string): number {
    let total = base;
    for (const a of actual) {
        if (asOf === null || compareDates(asOf, start) <= 0) {
            if (compareDates(a.date, start) < 0 && (asOf === null || compareDates(a.date, asOf) >= 0)) total += a.cash;
        } else if (compareDates(a.date, start) >= 0 && compareDates(a.date, asOf) < 0) {
            total -= a.cash;
        }
    }
    return round2(total);
}

export function cashProjection(input: CashProjectionInput): CashProjection {
    const weeks = Math.max(1, Math.floor(input.weeks ?? 13));
    const pastWeeks = Math.max(0, Math.floor(input.pastWeeks ?? 0));
    const minBalance = input.minBalance ?? 0;
    const current = weekStartOf(input.today);
    const start = windowStart(input.today, pastWeeks);
    const total = pastWeeks + weeks;
    const end = addDays(start, 7 * total - 1);
    const index = (date: string): number => Math.floor(daysBetween(start, date) / 7);

    const rows = Array.from({ length: total }, (_, i) => ({ plannedIn: 0, plannedOut: 0, actualIn: 0, actualOut: 0, i }));
    for (const a of input.actual) {
        if (compareDates(a.date, start) < 0 || compareDates(a.date, end) > 0 || a.cash === 0) continue;
        const row = rows[index(a.date)];
        if (row === undefined) continue;
        if (a.cash > 0) row.actualIn += a.cash;
        else row.actualOut -= a.cash;
    }
    const currentIndex = pastWeeks;
    for (const p of input.planned) {
        if (!(p.amount > 0) || compareDates(p.date, end) > 0) continue;
        const i = compareDates(p.date, current) < 0 ? currentIndex : index(p.date);
        const row = rows[i];
        if (row === undefined) continue;
        if (p.direction === 'in') row.plannedIn += p.amount;
        else row.plannedOut += p.amount;
    }

    let balance = round2(input.opening);
    let firstBelowMin: string | null = null;
    let lowestBalance: number | null = null;
    const out: CashWeek[] = rows.map(r => {
        const weekStart = addDays(start, 7 * r.i);
        const week: Omit<CashWeek, 'balance'> = {
            weekStart,
            weekEnd: addDays(weekStart, 6),
            past: r.i < currentIndex,
            plannedIn: round2(r.plannedIn),
            plannedOut: round2(r.plannedOut),
            actualIn: round2(r.actualIn),
            actualOut: round2(r.actualOut),
        };
        balance = round2(balance + week.actualIn - week.actualOut + week.plannedIn - week.plannedOut);
        if (!week.past) {
            if (firstBelowMin === null && balance < minBalance) firstBelowMin = weekStart;
            if (lowestBalance === null || balance < lowestBalance) lowestBalance = balance;
        }
        return { ...week, balance };
    });
    return { opening: round2(input.opening), weeks: out, firstBelowMin, lowestBalance };
}
