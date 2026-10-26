// ─── Plain Thai wording and number/date formats of the vendor (crew) screens. Pure: no React, no browser. ───
import type {
    DeclineReason, InvitationStatus, MaterialBy, Penalty, PricingMode, Provider, SubcontractStatus, SupplyMode,
} from '@/shared/contract';
import { round2 } from '@/domain/subcontracting/snapshot';

const MONEY = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const QTY = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const DATE = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
const DATE_TIME = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const MONTH = new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' });

/** 125000 → "125,000" (up to 2 decimals). */
export function formatMoney(n: number): string {
    return MONEY.format(Number.isFinite(n) ? round2(n) : 0);
}

/** 125000 → "125,000 บาท". */
export function formatBaht(n: number): string {
    return `${formatMoney(n)} บาท`;
}

export function formatQty(n: number): string {
    return QTY.format(n);
}

/** 0.05 → "5%" (up to 2 decimals). */
export function formatPct(fraction: number): string {
    return `${QTY.format(Math.round(fraction * 10000) / 100)}%`;
}

/** "2026-10-30" (local calendar day) → Date at local midnight; null when malformed. */
export function parseDay(day: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (m === null) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026-10-30" → "30 ต.ค. 69". */
export function formatDay(day: string | null): string {
    if (day === null) return '';
    const d = parseDay(day);
    return d === null ? '' : DATE.format(d);
}

/** ISO date-time → "30 ต.ค. 69 17:00". */
export function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : DATE_TIME.format(d);
}

/** "2026-11" → "พ.ย. 69". */
export function formatMonth(month: string): string {
    const d = parseDay(`${month}-01`);
    return d === null ? month : MONTH.format(d);
}

/** Date → "2026-10-30" (local calendar day). */
export function toDay(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${String(d.getFullYear())}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The next `count` months from `from` as "YYYY-MM" (the current month first). */
export function nextMonths(from: Date, count: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < count; i += 1) {
        const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
        out.push(toDay(d).slice(0, 7));
    }
    return out;
}

export interface DeadlineInfo {
    passed: boolean;
    /** Less than a day left. */
    soon: boolean;
    /** "เหลือ 2 วัน", "เหลือ 5 ชม.", "เหลือ 12 นาที", "ปิดรับแล้ว". */
    left: string;
}

/** Countdown to a deadline (ISO) seen at `nowMs`. */
export function deadlineInfo(deadlineIso: string, nowMs: number): DeadlineInfo {
    const ms = new Date(deadlineIso).getTime() - nowMs;
    if (Number.isNaN(ms) || ms <= 0) return { passed: true, soon: false, left: 'ปิดรับแล้ว' };
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 60) return { passed: false, soon: true, left: `เหลือ ${String(Math.max(1, minutes))} นาที` };
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return { passed: false, soon: true, left: `เหลือ ${String(hours)} ชม.` };
    return { passed: false, soon: false, left: `เหลือ ${String(Math.floor(hours / 24))} วัน` };
}

/**
 * Last digits of a masked phone ("08x-xxx-5678", "••••••5678", "+66•••••5678") for a hint; '' when it has fewer
 * than 3 visible trailing digits.
 */
export function maskedPhoneTail(masked: string): string {
    const m = /(\d{3,4})\D*$/.exec(masked);
    return m?.[1] ?? '';
}

/** True when the typed phone could be the invited one (same trailing digits), or when there is nothing to compare. */
export function phoneMatchesMasked(typed: string, masked: string): boolean {
    const tail = maskedPhoneTail(masked);
    if (tail === '') return true;
    return typed.replace(/\D/g, '').endsWith(tail);
}

/** "+66812345678" → "081-xxx-5678" (shown when a full number is not needed). */
export function maskPhone(e164: string): string {
    const digits = e164.replace(/\D/g, '');
    const local = digits.startsWith('66') ? `0${digits.slice(2)}` : digits;
    if (local.length < 7) return local;
    return `${local.slice(0, 3)}-xxx-${local.slice(-4)}`;
}

export const SUPPLY_MODE_TEXT: Record<SupplyMode, string> = {
    labour_only: 'ค่าแรงอย่างเดียว ผู้ว่าจ้างจัดหาวัสดุ',
    with_materials: 'รวมวัสดุ คุณจัดหาวัสดุเองทั้งหมด',
    per_line: 'บางรายการรวมวัสดุ (ดูที่แต่ละรายการ)',
};

export const PRICING_MODE_TEXT: Record<PricingMode, string> = {
    unit: 'เสนอราคาต่อหน่วย ทีละรายการ',
    lump: 'เสนอราคาเหมารวมทั้งงาน',
    vendor_choice: 'เสนอต่อหน่วยหรือเหมารวมก็ได้',
};

export const PROVIDER_TEXT: Record<Provider, string> = {
    buyer: 'ผู้ว่าจ้างจัดให้',
    vendor: 'คุณจัดเอง',
    none: 'ไม่ต้องใช้',
};

export const PROVISION_LABEL = { water: 'น้ำใช้', power: 'ไฟฟ้า', lodging: 'ที่พักคนงาน', scaffolding: 'นั่งร้าน' } as const;

export function materialByText(by: MaterialBy): string {
    return by === 'vendor' ? 'คุณจัดหาวัสดุ' : 'ผู้ว่าจ้างจัดหาวัสดุ';
}

export function penaltyText(p: Penalty): string {
    switch (p.kind) {
        case 'none': return 'ไม่มีค่าปรับ';
        case 'per_day': return `ปรับวันละ ${formatBaht(p.amount)} เมื่อเสร็จช้า`;
        case 'pct_per_day': return `ปรับวันละ ${formatPct(p.rate)} ของค่างาน เมื่อเสร็จช้า`;
    }
}

export const DECLINE_REASON_TEXT: Record<DeclineReason, string> = {
    busy: 'คิวงานเต็ม',
    too_far: 'ไกลเกินไป',
    not_my_trade: 'ไม่ใช่งานที่ทีมทำ',
    price_too_low: 'งบน่าจะไม่พอ',
    other: 'เหตุผลอื่น',
};

export const INVITATION_STATUS_TEXT: Record<InvitationStatus, string> = {
    sent: 'ยังไม่ได้เปิดดู',
    viewed: 'ยังไม่ได้เสนอราคา',
    declined: 'ไม่รับงานนี้',
    submitted: 'ส่งราคาแล้ว',
    withdrawn: 'ผู้ว่าจ้างถอนคำเชิญ',
    won: 'ได้งาน',
    lost: 'ไม่ได้งาน',
    closed: 'ปิดแล้ว',
};

export const SUBCONTRACT_STATUS_TEXT: Record<SubcontractStatus, string> = {
    pending_acceptance: 'รอคุณยอมรับเงื่อนไข',
    active: 'กำลังทำงาน',
    completed: 'งานเสร็จ รอคืนเงินประกัน',
    closed: 'ปิดสัญญาแล้ว',
    cancelled: 'ยกเลิกแล้ว',
    terminated: 'เลิกสัญญาแล้ว',
};

export const OUTCOME_TEXT = {
    pending: '',
    won: 'คุณได้งานนี้',
    lost: 'ผู้ว่าจ้างเลือกทีมอื่น ขอบคุณที่เสนอราคา',
    cancelled: 'ผู้ว่าจ้างยกเลิกงานนี้',
} as const;

/** Schedule in one line: "เริ่ม 1 พ.ย. 69 · เสร็จ 30 พ.ย. 69 · 30 วัน". */
export function scheduleText(s: { start: string | null; finish: string | null; days: number | null }): string {
    const parts: string[] = [];
    if (s.start !== null) parts.push(`เริ่ม ${formatDay(s.start)}`);
    if (s.finish !== null) parts.push(`เสร็จ ${formatDay(s.finish)}`);
    if (s.days !== null && s.days > 0) parts.push(`${String(s.days)} วัน`);
    return parts.join(' · ');
}

/** "อ.เมือง จ.ขอนแก่น" (either part may be missing). */
export function locationText(l: { district: string; province: string }): string {
    return [l.district === '' ? '' : `อ.${l.district}`, l.province === '' ? '' : `จ.${l.province}`].filter(s => s !== '').join(' ');
}
