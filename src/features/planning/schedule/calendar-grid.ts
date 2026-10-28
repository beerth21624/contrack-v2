// Month-grid helpers of the ปฏิทินงาน (pure): used by the on-screen CrewCalendar and the printed calendar.
// Dates are ISO 'YYYY-MM-DD' and Excel serials (calendar.ts); the year stays Christian era like the rest of the app.
import { isoToSerial, serialToIso } from '@/domain/planning/calendar';

export const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** Monday first. */
export const WEEKDAYS_SHORT = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
export const WEEKDAYS = ['วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์', 'วันอาทิตย์'];

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

/** "กุมภาพันธ์ 2026" (same year as the dates elsewhere on the page). */
export const monthTitle = (key: number) => `${MONTHS[key % 12] ?? ''} ${Math.floor(key / 12)}`;

/** "วันอังคารที่ 10 กุมภาพันธ์ 2026". */
export function longDate(iso: string): string {
    const p = parts(iso);
    const serial = isoToSerial(iso);
    const wd = serial === null ? '' : `${WEEKDAYS[weekdayOf(serial)] ?? ''}ที่ `;
    return `${wd}${p.d} ${MONTHS[p.m] ?? ''} ${p.y}`;
}

export const crewText = (skilled: number, labourers: number) => `ช่าง ${skilled} · คนงาน ${labourers}`;

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
