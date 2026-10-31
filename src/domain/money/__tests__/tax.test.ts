import { describe, expect, it } from 'vitest';
import { THAI_VAT_RATE, WHT_PRESETS, splitVatInclusive, vatOf, whtOf } from '../tax';

describe('tax', () => {
    it('computes VAT and WHT on the amount before VAT', () => {
        expect(THAI_VAT_RATE).toBe(0.07);
        expect(vatOf(100)).toBe(7);
        expect(vatOf(1234.56)).toBe(86.42);
        expect(whtOf(10_000, WHT_PRESETS.service)).toBe(300);
        expect(whtOf(10_000, WHT_PRESETS.none)).toBe(0);
    });

    it('splits a VAT-inclusive amount so the parts add back up', () => {
        expect(splitVatInclusive(107, 0.07)).toEqual({ net: 100, vat: 7 });
        expect(splitVatInclusive(100)).toEqual({ net: 93.46, vat: 6.54 });
        const { net, vat } = splitVatInclusive(1_000_000.01);
        expect(Math.round((net + vat) * 100)).toBe(100_000_001);
    });
});
