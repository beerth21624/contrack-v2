// Month-grid helpers of the ปฏิทินงาน (pure): used by the on-screen CrewCalendar and the printed calendar.
// Dates are ISO 'YYYY-MM-DD' and Excel serials (calendar.ts); the year stays Christian era like the rest of the app.
import { isoToSerial, serialToIso } from '@/domain/planning/calendar';
import type { Locale } from '@/i18n/config';
import { planningTranslator } from '../text';

const MONTH_KEYS = [
    'calendar.months.m1', 'calendar.months.m2', 'calendar.months.m3', 'calendar.months.m4', 'calendar.months.m5', 'calendar.months.m6',
    'calendar.months.m7', 'calendar.months.m8', 'calendar.months.m9', 'calendar.months.m10', 'calendar.months.m11', 'calendar.months.m12',
] as const;
const WEEKDAY_SHORT_KEYS = [
    'calendar.weekdaysShort.d1', 'calendar.weekdaysShort.d2', 'calendar.weekdaysShort.d3', 'calendar.weekdaysShort.d4',
    'calendar.weekdaysShort.d5', 'calendar.weekdaysShort.d6', 'calendar.weekdaysShort.d7',
] as const;
const WEEKDAY_KEYS = [
    'calendar.weekdays.d1', 'calendar.weekdays.d2', 'calendar.weekdays.d3', 'calendar.weekdays.d4',
    'calendar.weekdays.d5', 'calendar.weekdays.d6', 'calendar.weekdays.d7',
] as const;

/** Month name (0-based) in the locale. */
export const monthName = (m: number, locale: Locale = 'th'): string => {
    const k = MONTH_KEYS[m];
    return k === undefined ? '' : planningTranslator(locale)(k);
};
/** Monday-first short weekday names. */
export const weekdaysShort = (locale: Locale = 'th'): string[] => {
    const t = planningTranslator(locale);
    return WEEKDAY_SHORT_KEYS.map(k => t(k));
};
/** Monday-first weekday names. */
export const weekdayNames = (locale: Locale = 'th'): string[] => {
    const t = planningTranslator(locale);
    return WEEKDAY_KEYS.map(k => t(k));
};

export interface Ymd { y: number; m: number; d: number }

/** 'YYYY-MM-DD' → { y, m (0-based), d }. */
export function parts(iso: string): Ymd {
    const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
    return { y, m: m - 1, d };
}

/** Months counted from year 0, so consecutive months differ by 1. */
export const monthKey = (iso: string) => { const p = parts(iso); return p.y * 12 + p.m; };
/** First day of the month `key` ('YYYY-MM-01'). */
export const keyToIso = (key: number) => `${Math.floor(key / 12)}-${String((key % 12) + 1).padStart(2, '0')}-01`;
/** Monday = 0 … Sunday = 6. */
export const weekdayOf = (serial: number) => (new Date(Date.UTC(1899, 11, 30 + serial)).getUTCDay() + 6) % 7;

/** "February 2026" (same year as the dates elsewhere on the page). */
export const monthTitle = (key: number, locale: Locale = 'th') => `${monthName(key % 12, locale)} ${Math.floor(key / 12)}`;

/** "Tuesday, 10 February 2026" (Thai: "วันอังคารที่ 10 กุมภาพันธ์ 2026"). */
export function longDate(iso: string, locale: Locale = 'th'): string {
    const t = planningTranslator(locale);
    const p = parts(iso);
    const serial = isoToSerial(iso);
    const base = { day: p.d, month: monthName(p.m, locale), year: p.y };
    const k = serial === null ? undefined : WEEKDAY_KEYS[weekdayOf(serial)];
    return k === undefined ? t('calendar.longDateNoWeekday', base) : t('calendar.longDate', { ...base, weekday: t(k) });
}

export const crewText = (skilled: number, labourers: number, locale: Locale = 'th') =>
    planningTranslator(locale)('calendar.crew', { skilled, labourers });

/** The days of a month grid, Monday first, padded with the neighbouring months' days to whole weeks. */
export function monthCells(key: number): { iso: string; inMonth: boolean }[] {
    const first = isoToSerial(keyToIso(key));
    const next = isoToSerial(keyToIso(key + 1));
    if (first === null || next === null) return [];
    const from = first - weekdayOf(first);
    const count = Math.ceil((next - from) / 7) * 7;
    return Array.from({ length: count }, (_, i) => {
        const serial = from + i;
        return { iso: serialToIso(serial), inMonth: serial >= first && serial < next };
    });
}

/** First day of the month that is inside the plan (the plan start in its own month). */
export function firstPlanDayOf(key: number, start: string): string {
    const first = keyToIso(key);
    return first < start ? start : first;
}
