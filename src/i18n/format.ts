// ─── Locale-aware formatting of numbers, money and dates (docs/erp/03-i18n.md §5). Pure: the locale is a parameter ───
// ERP code formats through these (or useFormat()), never with toLocaleString / Intl directly.
// The UI always shows the Christian-era year; the Buddhist year is only for Thai printed documents (formatDocumentDate).
import { amountInWordsEn } from '../domain/money/amount-in-words';
import { bahtText } from '../features/export/baht-text';
import type { Locale } from './config';

const NUMBER_LOCALE: Record<Locale, string> = { th: 'th-TH-u-nu-latn', en: 'en-US' };
const DATE_LOCALE: Record<Locale, string> = { th: 'th-TH-u-ca-gregory-nu-latn', en: 'en-GB' };
const BUDDHIST_DATE_LOCALE = 'th-TH-u-ca-buddhist-nu-latn';
const TIME_ZONE = 'Asia/Bangkok';

export type DocumentYearStyle = 'ce' | 'be';

export interface NumberFormatOptions {
    /** Minimum fraction digits (default 0). */
    min?: number;
    /** Maximum fraction digits (default 2, at least `min`). */
    max?: number;
}

/** Some ICU versions use U+2212 for the minus sign; a rounded "-0.00" is shown as "0.00". */
function tidySign(text: string): string {
    const plain = text.replace(/−/g, '-');
    return /^-0([.,]0+)?(\D*)$/.test(plain) ? plain.slice(1) : plain;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
    const key = `${locale}|${JSON.stringify(options)}`;
    let format = numberFormats.get(key);
    if (format === undefined) {
        format = new Intl.NumberFormat(NUMBER_LOCALE[locale], options);
        numberFormats.set(key, format);
    }
    return format;
}

/** Grouped number, `max` fraction digits (default 0–2). Not a finite number → empty text. */
export function formatNumber(value: number, locale: Locale, options: NumberFormatOptions = {}): string {
    if (!Number.isFinite(value)) return '';
    const min = Math.max(0, Math.min(20, options.min ?? 0));
    const max = Math.max(min, Math.min(20, options.max ?? 2));
    return tidySign(numberFormat(locale, { minimumFractionDigits: min, maximumFractionDigits: max }).format(value));
}

/** Money: always two decimals, no currency (`1,234.50`, `-5.00`). */
export function formatMoney(value: number, locale: Locale): string {
    return formatNumber(value, locale, { min: 2, max: 2 });
}

/** Money with the currency: `1,234.50 บาท` / `THB 1,234.50`. */
export function formatBaht(value: number, locale: Locale): string {
    const amount = formatMoney(value, locale);
    if (amount === '') return '';
    return locale === 'th' ? `${amount} บาท` : `THB ${amount}`;
}

/** Amount in words for printed documents: Thai `bahtText` (`…บาทถ้วน`) or English (`… baht only`). */
export function amountInWords(value: number, locale: Locale): string {
    return locale === 'th' ? bahtText(value) : amountInWordsEn(value);
}

/** Quantity: up to four decimals, trailing zeros dropped (`12.5`). */
export function formatQty(value: number, locale: Locale): string {
    return formatNumber(value, locale, { min: 0, max: 4 });
}

/** A rate given as a fraction (0.05 → `5%`), up to `digits` decimals. */
export function formatPercent(rate: number, locale: Locale, digits = 2): string {
    if (!Number.isFinite(rate)) return '';
    const max = Math.max(0, Math.min(20, digits));
    return tidySign(numberFormat(locale, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: max }).format(rate));
}

// ── dates ──

const BUSINESS_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A business date `YYYY-MM-DD` is a calendar day (read in UTC so no time zone can move it); any other string or a
 * Date is an instant shown in Asia/Bangkok. Undefined when the value is not a valid date.
 */
function toInstant(value: string | Date): { date: Date; timeZone: string } | undefined {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : { date: value, timeZone: TIME_ZONE };
    const m = BUSINESS_DATE.exec(value);
    if (m !== null) {
        const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
        const date = new Date(Date.UTC(y, mo - 1, d));
        // 2026-02-30 is not a date (Date.UTC would roll it over to March).
        if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return undefined;
        return { date, timeZone: 'UTC' };
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : { date, timeZone: TIME_ZONE };
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** Day, month and year joined by spaces (`31 ต.ค. 2026`): built from parts so no ICU version adds an era or commas. */
function dayMonthYear(value: string | Date, intlLocale: string, month: 'short' | 'long'): string {
    const instant = toInstant(value);
    if (instant === undefined) return '';
    const key = `${intlLocale}|${month}|${instant.timeZone}`;
    let format = dateFormats.get(key);
    if (format === undefined) {
        format = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month, year: 'numeric', timeZone: instant.timeZone });
        dateFormats.set(key, format);
    }
    const parts = format.formatToParts(instant.date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? '';
    // en-GB says "Sept" since ICU 72 and "Sep" before: one spelling, so the server and every browser agree.
    const monthText = part('month') === 'Sept' ? 'Sep' : part('month');
    return `${part('day')} ${monthText} ${part('year')}`;
}

/** `31 ต.ค. 2026` / `31 Oct 2026` (Christian-era year). */
export function formatDate(value: string | Date, locale: Locale): string {
    return dayMonthYear(value, DATE_LOCALE[locale], 'short');
}

/** `31 ตุลาคม 2026` / `31 October 2026` (Christian-era year). */
export function formatDateLong(value: string | Date, locale: Locale): string {
    return dayMonthYear(value, DATE_LOCALE[locale], 'long');
}

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIME_ZONE });

/** A timestamp in Bangkok time: `31 ต.ค. 2026 14:05` / `31 Oct 2026, 14:05`. */
export function formatDateTime(value: string | Date, locale: Locale): string {
    const instant = toInstant(value);
    if (instant === undefined) return '';
    const date = formatDate(instant.date, locale);
    const parts = timeFormat.formatToParts(instant.date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? '';
    const time = `${part('hour')}:${part('minute')}`;
    return locale === 'th' ? `${date} ${time}` : `${date}, ${time}`;
}

/**
 * The date on a printed document: long month; Thai documents may use the Buddhist year (`31 ตุลาคม 2569`) when the
 * company chose `be`. English documents always use the Christian-era year (`yearStyle` is ignored).
 */
export function formatDocumentDate(value: string | Date, locale: Locale, yearStyle: DocumentYearStyle = 'ce'): string {
    if (locale === 'th' && yearStyle === 'be') return dayMonthYear(value, BUDDHIST_DATE_LOCALE, 'long');
    return formatDateLong(value, locale);
}

/** User-entered text kept in both languages (name_th / name_en …): the asked language, else the other one. */
export function pickLocalized(th: string | null | undefined, en: string | null | undefined, locale: Locale): string {
    const thText = th ?? '';
    const enText = en ?? '';
    if (locale === 'en') return enText.trim() !== '' ? enText : thText;
    return thText.trim() !== '' ? thText : enText;
}
