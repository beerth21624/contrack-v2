// ─── Pure helpers of the buyer screens: number/date formatting, labels, defaults of a new package ───
// Texts come from the `subcontracting` messages in the UI locale (the cookie unless a translator is passed in).
import type {
    DeclineReason, InstallmentDto, InvitationStatus, InviteChannel, PackageStatus, PricingMode, Provider, SourcingMode,
    SupplyMode, TradeId,
} from '@/shared/contract';
import type { Locale } from '@/i18n/config';
import { scLocale, scText, type ScT } from './text';

// ── numbers ──

const NUMBER_LOCALE: Record<Locale, string> = { th: 'th-TH', en: 'en-US' };
const DATE_LOCALE: Record<Locale, string> = { th: 'th-TH-u-ca-gregory', en: 'en-GB' };

const formatters = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
function numberFormat(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
    const locale = scLocale();
    const id = `${key}:${locale}`;
    let f = formatters.get(id) as Intl.NumberFormat | undefined;
    if (f === undefined) {
        f = new Intl.NumberFormat(NUMBER_LOCALE[locale], options);
        formatters.set(id, f);
    }
    return f;
}
function dateFormat(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const locale = scLocale();
    const id = `${key}:${locale}`;
    let f = formatters.get(id) as Intl.DateTimeFormat | undefined;
    if (f === undefined) {
        f = new Intl.DateTimeFormat(DATE_LOCALE[locale], options);
        formatters.set(id, f);
    }
    return f;
}
const MONEY = { format: (n: number) => numberFormat('money', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) };
const MONEY0 = { format: (n: number) => numberFormat('money0', { maximumFractionDigits: 0 }).format(n) };
const QTY = { format: (n: number) => numberFormat('qty', { maximumFractionDigits: 2 }).format(n) };

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

/** A count or amount with digit grouping in the UI locale (import limits, ratings). */
export function num(n: number, maxFractionDigits = 0): string {
    return numberFormat(`num${String(maxFractionDigits)}`, { maximumFractionDigits: maxFractionDigits }).format(finite(n));
}

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

// ── dates ── (month names in the UI language, Christian-era year, like the rest of the app)

const DATE = { format: (d: Date) => dateFormat('date', { day: 'numeric', month: 'short', year: '2-digit' }).format(d) };
const DATE_TIME = {
    format: (d: Date) => dateFormat('dateTime', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d),
};

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

/** "2 days 3 h left" / "45 min left" / "Closed" (Thai: "เหลือ 2 วัน 3 ชม." / "เหลือ 45 นาที" / "ปิดรับแล้ว"). */
export function countdown(deadlineIso: string, now: Date, t: ScT = scText()): { text: string; passed: boolean; soon: boolean } {
    const ms = new Date(deadlineIso).getTime() - now.getTime();
    if (!Number.isFinite(ms)) return { text: '', passed: false, soon: false };
    if (ms <= 0) return { text: t('buyer.format.closed'), passed: true, soon: false };
    const mins = Math.floor(ms / 60_000);
    const days = Math.floor(mins / 1440);
    const hours = Math.floor((mins % 1440) / 60);
    const soon = ms < 86_400_000;
    if (days > 0) return { text: hours > 0 ? t('buyer.format.daysHoursLeft', { days, hours }) : t('buyer.format.daysLeft', { days }), passed: false, soon };
    if (hours > 0) return { text: t('buyer.format.hoursMinutesLeft', { hours, minutes: mins % 60 }), passed: false, soon };
    return { text: t('buyer.format.minutesLeft', { minutes: Math.max(1, mins) }), passed: false, soon };
}

// ── installments (งวดจ่าย) ──

/** Plan §4.3: 2 × 50 % for short jobs (≤ 14 days, or unknown length treated as short), else 30/40/30. */
export function defaultInstallments(days: number | null, t: ScT = scText()): InstallmentDto[] {
    if (days !== null && days > 14) {
        return [
            { no: 1, pct: 0.3, condition: t('buyer.format.stageOneThird') },
            { no: 2, pct: 0.4, condition: t('buyer.format.stageTwoThirds') },
            { no: 3, pct: 0.3, condition: t('buyer.format.stageDone') },
        ];
    }
    return [
        { no: 1, pct: 0.5, condition: t('buyer.format.stageHalf') },
        { no: 2, pct: 0.5, condition: t('buyer.format.stageDone') },
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
export function invitationMessage(p: { buyerName: string; title: string; deadline: string; url: string }, t: ScT = scText()): string {
    const from = p.buyerName.trim() === '' ? '' : `${p.buyerName.trim()} `;
    return t('buyer.format.invitationMessage', { from, title: p.title, deadline: fmtDateTime(p.deadline), url: p.url });
}

/** LINE share link: opens LINE with the text ready to send to a chat the user picks. */
export function lineShareUrl(text: string): string {
    return `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
}

// ── labels ── (functions, because the text follows the UI language at the moment of the call)

export const packageStatusLabel = (status: PackageStatus, t: ScT = scText()): string => t(`buyer.labels.packageStatus.${status}`);

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

export const invitationStatusLabel = (status: InvitationStatus, t: ScT = scText()): string => t(`buyer.labels.invitationStatus.${status}`);

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

export const declineReasonLabel = (reason: DeclineReason, t: ScT = scText()): string => t(`buyer.labels.declineReason.${reason}`);

export const channelLabel = (channel: InviteChannel, t: ScT = scText()): string => t(`buyer.labels.channel.${channel}`);

export const supplyModeLabel = (mode: SupplyMode, t: ScT = scText()): string => t(`buyer.labels.supplyMode.${mode}`);

export const pricingModeLabel = (mode: PricingMode, t: ScT = scText()): string => t(`buyer.labels.pricingMode.${mode}`);

export const sourcingModeLabel = (mode: SourcingMode, t: ScT = scText()): string => t(`buyer.labels.sourcingMode.${mode}`);

export const providerLabel = (provider: Provider, t: ScT = scText()): string => t(`buyer.labels.provider.${provider}`);

export const PROVISIONS = ['water', 'power', 'lodging', 'scaffolding'] as const;

export const provisionLabel = (provision: (typeof PROVISIONS)[number], t: ScT = scText()): string => t(`buyer.labels.provision.${provision}`);

/** The name of a trade in the UI language (the domain keeps the Thai name). */
export const tradeName = (trade: string, t: ScT = scText()): string => t(`buyer.labels.trade.${trade as TradeId}`);
