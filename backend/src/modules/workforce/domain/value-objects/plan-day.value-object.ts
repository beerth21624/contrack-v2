// ─── Planning days: 'YYYY-MM-DD' calendar days (no time zone), as the S-Curve plan; tasks "1.1" … "8.6" ───
import { DomainError, type Result, err, ok } from '../../../../shared/domain';

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TASK_ID = /^[1-9]\.[1-9]\d?$/;

/** A real calendar day ('2026-02-30' is refused, the contract's regex alone would let it through). */
export function planDay(raw: string, label: string): Result<string, DomainError> {
    const m = ISO_DAY.exec(raw);
    if (m !== null) {
        const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const date = new Date(Date.UTC(y, mo - 1, d));
        if (date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d) return ok(raw);
    }
    return err(DomainError.validation(`The ${label} must be a calendar day (YYYY-MM-DD)`));
}

/** First and last day, inclusive: the first may not come after the last. */
export function dayRange(start: string, end: string): Result<{ start: string; end: string }, DomainError> {
    const s = planDay(start, 'start');
    if (!s.ok) return s;
    const e = planDay(end, 'end');
    if (!e.ok) return e;
    if (s.value > e.value) return err(DomainError.validation('The start comes after the end'));
    return ok({ start: s.value, end: e.value });
}

export function planTaskId(raw: string): Result<string, DomainError> {
    return TASK_ID.test(raw) ? ok(raw) : err(DomainError.validation(`"${raw}" is not a planned task id ("1.1" … "8.6")`));
}

/** Thai sites work on Bangkok time (UTC+7, no daylight saving): "today" for the in-use rule. */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function bangkokToday(now: Date): string {
    return new Date(now.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Two inclusive day ranges share at least one day. */
export function overlaps(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
    return a.start <= b.end && b.start <= a.end;
}
