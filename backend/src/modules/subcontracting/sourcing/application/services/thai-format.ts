// ─── Values in notification payloads, formatted for Thai readers (money "125,000 บาท", dates "30 ต.ค. 69 17:00") ───
import type { DeclineReason } from '@contrack/contract';

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** Thailand has no daylight saving: always UTC+7. */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatBaht(amount: number): string {
    return `${money.format(amount)} บาท`;
}

/** Bangkok time, Buddhist year in two digits. */
export function formatThaiDateTime(at: Date): string {
    const d = new Date(at.getTime() + BANGKOK_OFFSET_MS);
    const year = (d.getUTCFullYear() + 543) % 100;
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()] ?? ''} ${String(year).padStart(2, '0')} ${hh}:${mm}`;
}

export const DECLINE_REASON_LABEL: Record<DeclineReason, string> = {
    busy: 'คิวงานเต็ม',
    too_far: 'ไกลเกินไป',
    not_my_trade: 'งานไม่ตรงกับที่รับ',
    price_too_low: 'งบประมาณไม่เหมาะ',
    other: 'อื่น ๆ',
};
