// ─── Values in notification payloads, formatted for Thai readers (API-module1.md "Notifications") ───
const SHORT_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** The calendar date in Thailand (UTC+7), YYYY-MM-DD. */
export function bangkokDate(at: Date): string {
    return new Date(at.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** The year in Thailand (Gregorian), for contract numbers. */
export function bangkokYear(at: Date): number {
    return new Date(at.getTime() + BANGKOK_OFFSET_MS).getUTCFullYear();
}

/** 125000 → "125,000 บาท"; 1250.5 → "1,250.50 บาท". */
export function formatBaht(amount: number): string {
    const whole = Math.abs(amount % 1) < 0.005;
    const fixed = Math.abs(amount).toFixed(whole ? 0 : 2);
    const [int = '0', dec] = fixed.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${amount < 0 ? '-' : ''}${grouped}${dec === undefined ? '' : `.${dec}`} บาท`;
}

/** "2026-10-30" → "30 ต.ค. 69". */
export function formatThaiShortDate(date: string): string {
    const [y, m, d] = date.split('-').map(Number);
    if (y === undefined || m === undefined || d === undefined) return date;
    return `${d} ${SHORT_MONTHS[m - 1] ?? ''} ${String((y + 543) % 100).padStart(2, '0')}`;
}

/** A moment → "30 ต.ค. 69 17:00" (Thai time). */
export function formatThaiDateTime(at: Date): string {
    const local = new Date(at.getTime() + BANGKOK_OFFSET_MS).toISOString();
    return `${formatThaiShortDate(local.slice(0, 10))} ${local.slice(11, 16)}`;
}

export const INSPECTION_RESULT_TEXT = { pass: 'ผ่าน', pass_with_fixes: 'ผ่าน มีรายการแก้', fail: 'ไม่ผ่าน' } as const;
