// ─── Business dates (docs/erp/01-architecture.md §13) ───
// A business date (document date, due date, report day, work day) is a calendar day `YYYY-MM-DD` in Asia/Bangkok.
// "Today" always comes from bangkokToday(clock.now()), never new Date().toISOString().slice(0, 10) (that is the UTC
// day, wrong before 07:00 in Bangkok). All arithmetic here is on calendar days in UTC, so no time zone can shift it.

/** Bangkok is UTC+7 all year (no daylight saving). */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Half-month pay period: `2026-10-A` = days 1–15, `2026-10-B` = day 16 to the end of the month. */
export type PayPeriod = `${number}-${string}-${'A' | 'B'}`;

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

function fromUtcMs(ms: number): string {
    const d = new Date(ms);
    return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

interface Ymd {
    y: number;
    m: number;
    d: number;
}

function parse(date: string): Ymd | undefined {
    const match = DATE_RE.exec(date);
    if (match === null) return undefined;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (m < 1 || m > 12 || d < 1) return undefined;
    if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return undefined;
    return { y, m, d };
}

function parseOrThrow(date: string): Ymd {
    const ymd = parse(date);
    if (ymd === undefined) throw new RangeError(`bad date ${date}`);
    return ymd;
}

function utcMs({ y, m, d }: Ymd): number {
    const ms = Date.UTC(y, m - 1, d);
    // Date.UTC maps years 0–99 to 1900–1999; set the year explicitly so every 4-digit year is exact.
    return y < 100 ? new Date(ms).setUTCFullYear(y) : ms;
}

function assertInteger(n: number, what: string): void {
    if (!Number.isInteger(n)) throw new RangeError(`${what} must be a whole number, got ${n}`);
}

/** True for a real calendar day written `YYYY-MM-DD` (`2026-02-30` → false). */
export function isBusinessDate(s: string): boolean {
    return parse(s) !== undefined;
}

/** The calendar day in Bangkok at instant `now`. */
export function bangkokToday(now: Date): string {
    const ms = now.getTime();
    if (!Number.isFinite(ms)) throw new RangeError('bangkokToday: invalid date');
    return fromUtcMs(ms + BANGKOK_OFFSET_MS);
}

/** `date` plus `n` days (n may be negative). */
export function addDays(date: string, n: number): string {
    assertInteger(n, 'days');
    return fromUtcMs(utcMs(parseOrThrow(date)) + n * DAY_MS);
}

/**
 * `date` plus whole months; the day is clamped to the end of the target month (31 Jan + 1 month → 28/29 Feb).
 * Same arithmetic as addMonthsToDate (src/domain/subcontracting/claims.ts).
 */
export function addMonths(date: string, months: number): string {
    assertInteger(months, 'months');
    const { y, m, d } = parseOrThrow(date);
    const index = y * 12 + (m - 1) + months;
    const year = Math.floor(index / 12);
    const month = index - year * 12 + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${pad(year, 4)}-${pad(month)}-${pad(Math.min(d, lastDay))}`;
}

/** Whole days from `a` to `b` (positive when b is later; 0 for the same day). */
export function daysBetween(a: string, b: string): number {
    return Math.round((utcMs(parseOrThrow(b)) - utcMs(parseOrThrow(a))) / DAY_MS);
}

/** −1 / 0 / 1 like a sort comparator (earlier first). */
export function compareDates(a: string, b: string): -1 | 0 | 1 {
    const diff = daysBetween(a, b);
    return diff > 0 ? -1 : diff < 0 ? 1 : 0;
}

/** The half-month pay period a day falls in: `2026-10-16` → `2026-10-B`. */
export function payPeriodOf(date: string): PayPeriod {
    const { y, m, d } = parseOrThrow(date);
    return `${pad(y, 4)}-${pad(m)}-${d <= 15 ? 'A' : 'B'}` as PayPeriod;
}
