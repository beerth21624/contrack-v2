import { SUPPLIER_WHT_PRESET_RATE, type DocLanguage, type SupplierSnapshot } from '@contrack/contract';
import type { Supplier } from '../../../shared/application/ports';

/** Withholding rate of the supplier's default preset. */
export const supplierWhtRate = (s: Pick<Supplier, 'defaultWhtPreset'>): number => SUPPLIER_WHT_PRESET_RATE[s.defaultWhtPreset];

/** Case-insensitive match on names, tax id, contact, phone, email and LINE id. */
export function matchesSupplierQuery(s: Supplier, q: string): boolean {
    const needle = q.trim().toLowerCase();
    return [s.nameTh, s.nameEn, s.taxId, s.contactName, s.phone, s.email, s.lineId].some(v => v.toLowerCase().includes(needle));
}

/** Average of 1–5 scores, 2 decimals; null without scores. */
export function averageScore(scores: readonly number[]): number | null {
    if (scores.length === 0) return null;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

/** `+66812345678` → `0812345678` (how people write Thai numbers); anything else unchanged. */
export const localThaiPhone = (phone: string): string => (phone.startsWith('+66') ? `0${phone.slice(3)}` : phone);

/** Supplier block for a purchasing document in `language`; an empty name/address falls back to the other language. */
export function supplierSnapshot(s: Supplier, language: DocLanguage): SupplierSnapshot {
    const pick = (th: string, en: string) => (language === 'en' ? (en || th) : (th || en));
    return {
        id: s.id,
        kind: s.kind,
        name: pick(s.nameTh, s.nameEn),
        taxId: s.taxId,
        branchCode: s.branchCode,
        isJuristic: s.isJuristic,
        vatRegistered: s.vatRegistered,
        address: pick(s.addressTh, s.addressEn),
        contactName: s.contactName,
        phone: s.phone,
        email: s.email,
        creditTermDays: s.creditTermDays,
        whtPreset: s.defaultWhtPreset,
        whtRate: supplierWhtRate(s),
        language,
    };
}
