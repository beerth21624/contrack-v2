// ─── Calendar helpers for the planning sheets ─────────────────────────────────
// Dates are kept as ISO strings ('YYYY-MM-DD') in inputs/outputs and as Excel day serials
// (days since 1899-12-30, so 46023 = 2026-01-01) inside the computation. Everything is UTC and
// counts calendar days, like the Excel (no weekends or holidays skipped — decision D17 default).

const MS_PER_DAY = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** 'YYYY-MM-DD' → Excel serial. Returns null for an empty / invalid date. */
export function isoToSerial(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!m) return null;
    const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isFinite(t) ? Math.round((t - EXCEL_EPOCH) / MS_PER_DAY) : null;
}

/** Excel serial → 'YYYY-MM-DD'. */
export function serialToIso(serial: number): string {
    return new Date(EXCEL_EPOCH + Math.round(serial) * MS_PER_DAY).toISOString().slice(0, 10);
}

function serialToParts(serial: number): { y: number; m: number; d: number } {
    const dt = new Date(EXCEL_EPOCH + Math.round(serial) * MS_PER_DAY);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
}

function partsToSerial(y: number, m: number, d: number): number {
    return Math.round((Date.UTC(y, m, d) - EXCEL_EPOCH) / MS_PER_DAY);
}

/** Thai month abbreviations, as Excel TEXT(…, "mmm-yy") renders them in the v5 workbook ("ม.ค.-26"). */
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** Day of the month on which W1..W4 start (S-Curve J9: 1st of the month + {0, 7, 15, 22}). */
const WEEK_START_DAYS = [1, 8, 16, 23] as const;

/** One "week" column of the S-Curve / CashFlow: a quarter of a calendar month. */
export interface WeekBucket {
    index: number;           // 0-based column index (S-Curve J = 0, CashFlow D = 0)
    monthIndex: number;      // 0-based month from the axis start
    week: 1 | 2 | 3 | 4;     // W1..W4 (row 12 label)
    weekLabel: string;       // "W1".."W4"
    monthLabel: string;      // "ม.ค.-26" (row 11, merged over the month's 4 columns)
    start: string;           // ISO, S-Curve row 9
    end: string;             // ISO, S-Curve row 10
    startSerial: number;
    endSerial: number;
    days: number;            // 7, 8, 7, 6–9
}

export interface MonthBucket {
    index: number;
    label: string;
    start: string;
    end: string;
    /** Index of the month's first week bucket. */
    firstBucket: number;
}

/**
 * Builds `months` × 4 week buckets starting at the month containing `startSerial`.
 * W1 = 1–7, W2 = 8–15, W3 = 16–22, W4 = 23–end of month.
 * (D1: Excel's last column BE ends at BE9+6 because of a #REF!, losing the 29th–31st of the last
 * month; here every W4 ends on the last day of its month.)
 */
export function buildWeekBuckets(startSerial: number, months: number): WeekBucket[] {
    const { y, m } = serialToParts(startSerial);
    const out: WeekBucket[] = [];
    for (let mi = 0; mi < months; mi++) {
        const yy = y + Math.floor((m + mi) / 12);
        const mm = (m + mi) % 12;
        const eom = partsToSerial(yy, mm + 1, 0);
        const monthLabel = `${THAI_MONTHS[mm] ?? ''}-${String(yy % 100).padStart(2, '0')}`;
        for (let w = 0; w < 4; w++) {
            const startS = partsToSerial(yy, mm, WEEK_START_DAYS[w] ?? 1);
            const next = WEEK_START_DAYS[w + 1];
            const endS = next === undefined ? eom : partsToSerial(yy, mm, next) - 1;
            out.push({
                index: out.length,
                monthIndex: mi,
                week: (w + 1) as 1 | 2 | 3 | 4,
                weekLabel: `W${w + 1}`,
                monthLabel,
                start: serialToIso(startS),
                end: serialToIso(endS),
                startSerial: startS,
                endSerial: endS,
                days: endS - startS + 1,
            });
        }
    }
    return out;
}

/** Month headers of a bucket axis (every 4th bucket). */
export function monthsOf(buckets: WeekBucket[]): MonthBucket[] {
    const out: MonthBucket[] = [];
    for (const b of buckets) {
        if (b.week !== 1) continue;
        const last = buckets[b.index + 3] ?? b;
        out.push({ index: b.monthIndex, label: b.monthLabel, start: b.start, end: last.end, firstBucket: b.index });
    }
    return out;
}

/** Number of months from the month of `fromSerial` to the month of `toSerial`, inclusive. */
export function monthSpan(fromSerial: number, toSerial: number): number {
    const a = serialToParts(fromSerial);
    const b = serialToParts(toSerial);
    return (b.y - a.y) * 12 + (b.m - a.m) + 1;
}

/** Calendar days of [aStart, aEnd] that fall in [bStart, bEnd] (S-Curve grid `ov`). */
export function overlapDays(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
    return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart) + 1);
}

/**
 * Index of the bucket containing `serial`, Excel MATCH(serial, bucketStarts, 1) style:
 * the last bucket starting on or before the date; -1 when the date is before the axis.
 */
export function bucketIndexOf(buckets: WeekBucket[], serial: number): number {
    let idx = -1;
    for (const b of buckets) if (b.startSerial <= serial) idx = b.index;
    return idx;
}
