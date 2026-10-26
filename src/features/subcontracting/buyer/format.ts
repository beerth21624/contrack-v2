// ─── Pure helpers of the buyer screens: Thai number/date formatting, labels, defaults of a new package ───
import type {
    DeclineReason, InstallmentDto, InvitationStatus, InviteChannel, PackageStatus, PricingMode, Provider, SourcingMode,
    SupplyMode,
} from '@/shared/contract';

// ── numbers ──

const MONEY = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONEY0 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const QTY = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

/** 125000 → "125,000.00" (unit prices, line totals). */
export function money(n: number): string {
    return MONEY.format(finite(n));
}

/** 125000.4 → "125,000" (summaries, headers). */
export function money0(n: number): string {
    return MONEY0.format(Math.round(finite(n)));
}

/** 12.5 → "12.5", 3 → "3". */
export function qty(n: number): string {
    return QTY.format(finite(n));
}

/** 0.125 → "+12.5%" (signed) or "12.5%". null → "–". */
export function pct(fraction: number | null, signed = false): string {
    if (fraction === null || !Number.isFinite(fraction)) return '–';
    const v = Math.round(fraction * 1000) / 10;
    const s = `${QTY.format(Math.abs(v))}%`;
    if (!signed || v === 0) return v < 0 ? `-${s}` : s;
    return v > 0 ? `+${s}` : `-${s}`;
}

// ── dates ──

const DATE = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
const DATE_TIME = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

/** 'YYYY-MM-DD' (local calendar day) → Date at local midnight, or null. */
export function parseDay(day: string | null | undefined): Date | null {
    if (day === null || day === undefined) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (m === null) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → 'YYYY-MM-DD' in local time. */
export function toDay(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${String(d.getFullYear())}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 'YYYY-MM-DD' → "30 ต.ค. 69"; '' when empty. */
export function fmtDay(day: string | null | undefined): string {
    const d = parseDay(day);
    return d === null ? '' : DATE.format(d);
}

/** ISO date-time → "30 ต.ค. 69 17:00"; '' when invalid. */
export function fmtDateTime(iso: string | null | undefined): string {
    if (iso === null || iso === undefined) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : DATE_TIME.format(d);
}

/** Days from `start` to `finish` inclusive (both 'YYYY-MM-DD'), or null. */
export function daysBetween(start: string | null, finish: string | null): number | null {
    const a = parseDay(start);
    const b = parseDay(finish);
    if (a === null || b === null) return null;
    const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
    return days > 0 ? days : null;
}

/** 'YYYY-MM-DD' + n days. */
export function addDays(day: string, n: number): string {
    const d = parseDay(day) ?? new Date();
    d.setDate(d.getDate() + n);
    return toDay(d);
}

/** Default bid deadline: 5 days from now at 17:00 local time (ISO with offset Z). */
export function defaultBidDeadline(now: Date): string {
    const d = new Date(now);
    d.setDate(d.getDate() + 5);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
}

/** Default "price valid until": 30 days from now. */
export function defaultPriceValidUntil(now: Date): string {
    const d = new Date(now);
    d.setDate(d.getDate() + 30);
    return toDay(d);
}

/** "เหลือ 2 วัน 3 ชม." / "เหลือ 45 นาที" / "ปิดรับแล้ว". */
export function countdown(deadlineIso: string, now: Date): { text: string; passed: boolean; soon: boolean } {
    const ms = new Date(deadlineIso).getTime() - now.getTime();
    if (!Number.isFinite(ms)) return { text: '', passed: false, soon: false };
    if (ms <= 0) return { text: 'ปิดรับแล้ว', passed: true, soon: false };
    const mins = Math.floor(ms / 60_000);
    const days = Math.floor(mins / 1440);
    const hours = Math.floor((mins % 1440) / 60);
    const soon = ms < 86_400_000;
    if (days > 0) return { text: hours > 0 ? `เหลือ ${String(days)} วัน ${String(hours)} ชม.` : `เหลือ ${String(days)} วัน`, passed: false, soon };
    if (hours > 0) return { text: `เหลือ ${String(hours)} ชม. ${String(mins % 60)} นาที`, passed: false, soon };
    return { text: `เหลือ ${String(Math.max(1, mins))} นาที`, passed: false, soon };
}

// ── installments (งวดจ่าย) ──

/** Plan §4.3: 2 × 50 % for short jobs (≤ 14 days, or unknown length treated as short), else 30/40/30. */
export function defaultInstallments(days: number | null): InstallmentDto[] {
    if (days !== null && days > 14) {
        return [
            { no: 1, pct: 0.3, condition: 'ทำงานได้ประมาณ 1 ใน 3' },
            { no: 2, pct: 0.4, condition: 'ทำงานได้ประมาณ 2 ใน 3' },
            { no: 3, pct: 0.3, condition: 'งานเสร็จ ตรวจรับครบ' },
        ];
    }
    return [
        { no: 1, pct: 0.5, condition: 'ทำงานได้ครึ่งหนึ่ง' },
        { no: 2, pct: 0.5, condition: 'งานเสร็จ ตรวจรับครบ' },
    ];
}

/** Σ pct (fractions). */
export function installmentsTotal(list: readonly Pick<InstallmentDto, 'pct'>[]): number {
    return list.reduce((s, i) => s + i.pct, 0);
}

/** Σ = 100 % (± 0.01 %), every pct > 0 and every condition typed. */
export function installmentsValid(list: readonly InstallmentDto[]): boolean {
    return list.length > 0
        && Math.abs(installmentsTotal(list) - 1) <= 0.0001
        && list.every(i => i.pct > 0 && i.condition.trim() !== '');
}

/** Numbers 1..n in order (after adding / removing a row). */
export function renumber(list: readonly InstallmentDto[]): InstallmentDto[] {
    return list.map((i, k) => ({ ...i, no: k + 1 }));
}

// ── invitations sent by hand ──

/** Text sent with an invitation link (LINE / SMS / chat). */
export function invitationMessage(p: { buyerName: string; title: string; deadline: string; url: string }): string {
    const from = p.buyerName.trim() === '' ? '' : `${p.buyerName.trim()} `;
    return `${from}ขอเชิญเสนอราคางาน "${p.title}" ปิดรับ ${fmtDateTime(p.deadline)}\nดูรายละเอียดและเสนอราคา: ${p.url}`;
}

/** LINE share link: opens LINE with the text ready to send to a chat the user picks. */
export function lineShareUrl(text: string): string {
    return `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
}

// ── labels ──

export const PACKAGE_STATUS_LABEL: Record<PackageStatus, string> = {
    draft: 'ร่าง',
    open: 'รอราคา',
    reviewing: 'กำลังเทียบราคา',
    awarded: 'ตกลงจ้างแล้ว',
    closed: 'ปิดแล้ว',
    cancelled: 'ยกเลิก',
    expired: 'เลยกำหนดรับราคา',
};

/** Tag colour by state (colour means state: grey not yet, amber waiting, green done, red problem). */
export const PACKAGE_STATUS_COLOR: Record<PackageStatus, string> = {
    draft: 'default',
    open: 'warning',
    reviewing: 'warning',
    awarded: 'success',
    closed: 'success',
    cancelled: 'default',
    expired: 'error',
};

/** Packages that still hold their BOQ rows (a row can be in one live package only). */
export const LIVE_PACKAGE_STATUSES: readonly PackageStatus[] = ['draft', 'open', 'reviewing', 'awarded', 'expired'];

export const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
    sent: 'ยังไม่เปิด',
    viewed: 'เปิดดูแล้ว',
    declined: 'ปฏิเสธ',
    submitted: 'ส่งราคาแล้ว',
    withdrawn: 'ถอนคำเชิญแล้ว',
    won: 'ได้งาน',
    lost: 'ไม่ได้งาน',
    closed: 'ปิดแล้ว',
};

export const INVITATION_STATUS_COLOR: Record<InvitationStatus, string> = {
    sent: 'default',
    viewed: 'warning',
    declined: 'error',
    submitted: 'success',
    withdrawn: 'default',
    won: 'success',
    lost: 'default',
    closed: 'default',
};

export const DECLINE_REASON_LABEL: Record<DeclineReason, string> = {
    busy: 'คิวงานเต็ม',
    too_far: 'ไกลเกินไป',
    not_my_trade: 'ไม่ใช่งานที่รับ',
    price_too_low: 'ราคาประเมินต่ำไป',
    other: 'อื่น ๆ',
};

export const CHANNEL_LABEL: Record<InviteChannel, string> = {
    link: 'คัดลอกลิงก์ส่งเอง',
    sms: 'SMS',
    line: 'LINE',
};

export const SUPPLY_MODE_LABEL: Record<SupplyMode, string> = {
    labour_only: 'ค่าแรงอย่างเดียว',
    with_materials: 'รวมวัสดุทั้งหมด',
    per_line: 'กำหนดต่อแถว',
};

export const PRICING_MODE_LABEL: Record<PricingMode, string> = {
    unit: 'ต่อหน่วยรายแถว',
    lump: 'เหมารวมทั้งแพ็กเกจ',
    vendor_choice: 'ให้ผู้รับเลือกเอง',
};

export const SOURCING_MODE_LABEL: Record<SourcingMode, string> = {
    direct: 'จ้างตรง',
    rfq: 'ขอราคาเทียบ',
    open: 'ประกาศเปิดรับ',
};

export const PROVIDER_LABEL: Record<Provider, string> = {
    buyer: 'เราจัดหา',
    vendor: 'ผู้รับจัดหา',
    none: 'ไม่มี',
};

export const PROVISION_LABEL = {
    water: 'น้ำใช้',
    power: 'ไฟฟ้า',
    lodging: 'ที่พักคนงาน',
    scaffolding: 'นั่งร้าน',
} as const;
