// ─── Formatting of raw payload values of the ERP notification templates, per recipient language (Gregorian calendar) ───
// Money and dates arrive raw (`amount: 1250000`, `date: '2026-10-30'`); an invalid or missing value formats as ''.
import type { UserLocale } from '@contrack/contract';

const MONTHS: Record<UserLocale, readonly string[]> = {
    th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const NUMBER = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INTEGER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** A finite number from a payload value (number or numeric string), else undefined. */
export function numberOf(raw: string | number | undefined): number | undefined {
    if (raw === undefined || raw === '') return undefined;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

/** `1,250,000.00 บาท` / `THB 1,250,000.00`. */
export function formatNotificationMoney(raw: string | number | undefined, locale: UserLocale): string {
    const n = numberOf(raw);
    if (n === undefined) return '';
    const text = NUMBER.format(n);
    return locale === 'th' ? `${text} บาท` : `THB ${text}`;
}

/** `1,234` (whole numbers, e.g. days). */
export function formatNotificationCount(raw: string | number | undefined): string {
    const n = numberOf(raw);
    return n === undefined ? '' : INTEGER.format(n);
}

/** `30 ต.ค. 2026` / `30 Oct 2026` from `YYYY-MM-DD` (no time zone shift); '' when not a real date. */
export function formatNotificationDate(raw: string | number | undefined, locale: UserLocale): string {
    if (typeof raw !== 'string') return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (m === null) return '';
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return '';
    return `${day} ${MONTHS[locale][month - 1] ?? ''} ${year}`;
}
