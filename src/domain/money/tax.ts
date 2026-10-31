// ─── Thai VAT and withholding tax (docs/erp/01-architecture.md §12.2–§12.3) ───
// Rates are fractions (0.07 = 7 %). VAT is computed once per document on the amount before VAT; WHT on the amount
// before VAT as well.
import { round2 } from './money';

/** Thai value added tax rate. */
export const THAI_VAT_RATE = 0.07;

/** VAT on an amount before VAT, rounded to satang. */
export function vatOf(net: number, rate: number = THAI_VAT_RATE): number {
    return round2(net * rate);
}

export interface VatSplit {
    /** Amount before VAT. */
    net: number;
    vat: number;
}

/** Splits an amount that includes VAT: net = round2(gross / (1 + rate)), vat = gross − net (so net + vat = gross). */
export function splitVatInclusive(gross: number, rate: number = THAI_VAT_RATE): VatSplit {
    const total = round2(gross);
    const net = round2(total / (1 + rate));
    return { net, vat: round2(total - net) };
}

/** Withholding tax on the amount before VAT, rounded to satang. */
export function whtOf(base: number, rate: number): number {
    return round2(base * rate);
}

/** Common withholding rates (Revenue Department) by kind of payment. */
export const WHT_PRESETS = {
    /** Individual customer, or a purchase of goods. */
    none: 0,
    /** A government agency paying a contractor. */
    government: 0.01,
    transport: 0.01,
    advertising: 0.02,
    /** Hire of work / services paid by a juristic person. */
    service: 0.03,
    rent: 0.05,
} as const satisfies Record<string, number>;

export type WhtPresetKey = keyof typeof WHT_PRESETS;

export const WHT_PRESET_KEYS = Object.keys(WHT_PRESETS) as WhtPresetKey[];
