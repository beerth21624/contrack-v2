// ─── Plain wording and number/date formats of the vendor (crew) screens, in the UI locale. Pure: no React, no browser. ───
import type {
    DeclineReason, InvitationStatus, MaterialBy, Penalty, PricingMode, Provider, SubcontractStatus, SupplyMode,
} from '@/shared/contract';
import { round2 } from '@/domain/subcontracting/snapshot';
import type { Locale } from '@/i18n/config';
import { PROVINCE_NAMES_EN } from '@/domain/subcontracting/provinces';
import { vLocale, vText, vendorTranslator, type VT } from './text';

// Thai: Thai months with the Christian-era year, like the rest of the app. English: day, short month, full year.
interface Formats { money: Intl.NumberFormat; qty: Intl.NumberFormat; date: Intl.DateTimeFormat; dateTime: Intl.DateTimeFormat; month: Intl.DateTimeFormat }
const FORMATS = new Map<Locale, Formats>();
function formats(locale: Locale): Formats {
    const hit = FORMATS.get(locale);
    if (hit !== undefined) return hit;
    const th = locale === 'th';
    const tag = th ? 'th-TH-u-ca-gregory' : 'en-GB';
    const year = th ? '2-digit' : 'numeric';
    const made: Formats = {
        money: new Intl.NumberFormat(th ? 'th-TH' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
        qty: new Intl.NumberFormat(th ? 'th-TH' : 'en-US', { maximumFractionDigits: 2 }),
        date: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year }),
        dateTime: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year, hour: '2-digit', minute: '2-digit', hour12: false }),
        month: new Intl.DateTimeFormat(tag, { month: 'short', year }),
    };
    FORMATS.set(locale, made);
    return made;
}

/** 125000 → "125,000" (up to 2 decimals). */
export function formatMoney(n: number, locale: Locale = vLocale()): string {
    return formats(locale).money.format(Number.isFinite(n) ? round2(n) : 0);
}

/** 125000 → "125,000 บาท" (English: "THB 125,000"). */
export function formatBaht(n: number, locale: Locale = vLocale()): string {
    return locale === 'th' ? `${formatMoney(n, locale)} ${vendorTranslator(locale)('units.baht')}` : `THB ${formatMoney(n, locale)}`;
}

export function formatQty(n: number, locale: Locale = vLocale()): string {
    return formats(locale).qty.format(n);
}

/** 0.05 → "5%" (up to 2 decimals). */
export function formatPct(fraction: number, locale: Locale = vLocale()): string {
    return `${formats(locale).qty.format(Math.round(fraction * 10000) / 100)}%`;
}

/** "2026-10-30" (local calendar day) → Date at local midnight; null when malformed. */
export function parseDay(day: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (m === null) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026-10-30" → "30 ต.ค. 69". */
export function formatDay(day: string | null, locale: Locale = vLocale()): string {
    if (day === null) return '';
    const d = parseDay(day);
    return d === null ? '' : formats(locale).date.format(d);
}

/** ISO date-time → "30 ต.ค. 69 17:00" (English: "30 Oct 2026, 17:00"). */
export function formatDateTime(iso: string, locale: Locale = vLocale()): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : formats(locale).dateTime.format(d);
}

/** "2026-11" → "พ.ย. 69". */
export function formatMonth(month: string, locale: Locale = vLocale()): string {
    const d = parseDay(`${month}-01`);
    return d === null ? month : formats(locale).month.format(d);
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
    /** "เหลือ 2 วัน", "เหลือ 5 ชม.", "เหลือ 12 นาที", "ปิดรับแล้ว" (English: "2 days left", …, "Closed"). */
    left: string;
}

/** Countdown to a deadline (ISO) seen at `nowMs`. */
export function deadlineInfo(deadlineIso: string, nowMs: number, t: VT = vText()): DeadlineInfo {
    const ms = new Date(deadlineIso).getTime() - nowMs;
    if (Number.isNaN(ms) || ms <= 0) return { passed: true, soon: false, left: t('deadline.closed') };
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 60) return { passed: false, soon: true, left: t('deadline.minutesLeft', { n: Math.max(1, minutes) }) };
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return { passed: false, soon: true, left: t('deadline.hoursLeft', { n: hours }) };
    return { passed: false, soon: false, left: t('deadline.daysLeft', { n: Math.floor(hours / 24) }) };
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

export const supplyModeText = (m: SupplyMode, t: VT = vText()): string => t(`labels.supplyMode.${m}`);

export const pricingModeText = (m: PricingMode, t: VT = vText()): string => t(`labels.pricingMode.${m}`);

export const providerText = (p: Provider, t: VT = vText()): string => t(`labels.provider.${p}`);

export const provisionLabel = (p: 'water' | 'power' | 'lodging' | 'scaffolding', t: VT = vText()): string => t(`labels.provision.${p}`);

export function materialByText(by: MaterialBy, t: VT = vText()): string {
    return by === 'vendor' ? t('labels.materialBy.vendor') : t('labels.materialBy.buyer');
}

export function penaltyText(p: Penalty, t: VT = vText(), locale: Locale = vLocale()): string {
    switch (p.kind) {
        case 'none': return t('labels.penalty.none');
        case 'per_day': return t('labels.penalty.perDay', { amount: formatBaht(p.amount, locale) });
        case 'pct_per_day': return t('labels.penalty.pctPerDay', { rate: formatPct(p.rate, locale) });
    }
}

export const declineReasonText = (r: DeclineReason, t: VT = vText()): string => t(`labels.declineReason.${r}`);

export const invitationStatusText = (s: InvitationStatus, t: VT = vText()): string => t(`labels.invitationStatus.${s}`);

export const subcontractStatusText = (s: SubcontractStatus, t: VT = vText()): string => t(`labels.subcontractStatus.${s}`);

export const outcomeText = (o: 'pending' | 'won' | 'lost' | 'cancelled', t: VT = vText()): string => (o === 'pending' ? '' : t(`labels.outcome.${o}`));

/** Schedule in one line: "เริ่ม 1 พ.ย. 69 · เสร็จ 30 พ.ย. 69 · 30 วัน". */
export function scheduleText(s: { start: string | null; finish: string | null; days: number | null }, t: VT = vText(), locale: Locale = vLocale()): string {
    const parts: string[] = [];
    if (s.start !== null) parts.push(t('labels.schedule.start', { date: formatDay(s.start, locale) }));
    if (s.finish !== null) parts.push(t('labels.schedule.finish', { date: formatDay(s.finish, locale) }));
    if (s.days !== null && s.days > 0) parts.push(t('labels.schedule.days', { n: s.days }));
    return parts.join(' · ');
}

/** "อ.เมือง จ.ขอนแก่น" (either part may be missing). English: "Mueang district, Khon Kaen". */
export function locationText(l: { district: string; province: string }, t: VT = vText(), locale: Locale = vLocale()): string {
    const province = provinceName(l.province, locale);
    return [
        l.district === '' ? '' : t('labels.location.district', { name: l.district }),
        province === '' ? '' : t('labels.location.province', { name: province }),
    ].filter(s => s !== '').join(locale === 'th' ? ' ' : ', ');
}

/** Display name of a stored (Thai) province: the English name in the English interface. */
export function provinceName(province: string, locale: Locale = vLocale()): string {
    return locale === 'en' ? PROVINCE_NAMES_EN[province] ?? province : province;
}
