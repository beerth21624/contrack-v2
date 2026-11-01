// ─── Labour (docs/erp/02-domain-model.md §8.2): half-month pay periods, timesheet amounts, advance recovery ───
// Pure.
import { round2 } from '../money';

const KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])-([AB])$/;

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** True for `2026-10-A` / `2026-10-B`. */
export function isPayPeriodKey(key: string): boolean {
    return KEY_RE.test(key);
}

/** First and last day of a period: `2026-10-A` → 2026-10-01 … 2026-10-15, `2026-02-B` → 2026-02-16 … 2026-02-28. */
export function payPeriodRange(key: string): { startDate: string; endDate: string } {
    const m = KEY_RE.exec(key);
    if (m === null) throw new RangeError(`bad pay period ${key}`);
    const y = Number(m[1]);
    const month = Number(m[2]);
    const ym = `${pad(y, 4)}-${pad(month)}`;
    if (m[3] === 'A') return { startDate: `${ym}-01`, endDate: `${ym}-15` };
    const last = new Date(Date.UTC(y, month, 0)).getUTCDate();
    return { startDate: `${ym}-16`, endDate: `${ym}-${pad(last)}` };
}

/** Default ฿ per OT hour: daily wage / 8 × 1.5. */
export function defaultOtRate(dailyWage: number): number {
    return round2((dailyWage / 8) * 1.5);
}

/** round2(days × daily wage + OT hours × OT rate). */
export function timesheetAmount(days: number, dailyWage: number, otHours: number, otRate: number): number {
    return round2(days * dailyWage + otHours * otRate);
}

/** An advance still to recover, as the period build sees it. */
export interface OpenAdvance {
    id: string;
    advanceDate: string;
    createdAt: Date;
    /** amount − recovered by other pay lines. */
    outstanding: number;
}

/**
 * How much of each advance one pay line deducts: oldest advance first (date, then creation), never more than the
 * line's gross. Advances with nothing outstanding are skipped. Returns only the advances that get a deduction.
 */
export function recoverAdvances(gross: number, advances: readonly OpenAdvance[]): { advanceId: string; amount: number }[] {
    let left = round2(Math.max(0, gross));
    const out: { advanceId: string; amount: number }[] = [];
    const ordered = [...advances].sort((a, b) =>
        a.advanceDate !== b.advanceDate ? (a.advanceDate < b.advanceDate ? -1 : 1) : a.createdAt.getTime() - b.createdAt.getTime());
    for (const a of ordered) {
        if (left <= 0) break;
        const outstanding = round2(a.outstanding);
        if (outstanding <= 0) continue;
        const amount = round2(Math.min(left, outstanding));
        out.push({ advanceId: a.id, amount });
        left = round2(left - amount);
    }
    return out;
}
