import { describe, expect, it } from 'vitest';
import { amountInWordsEn } from '../amount-in-words';

describe('amountInWordsEn', () => {
    it('writes baht and satang', () => {
        expect(amountInWordsEn(1250.5)).toBe('One thousand two hundred fifty baht and fifty satang only');
        expect(amountInWordsEn(21)).toBe('Twenty-one baht only');
        expect(amountInWordsEn(0.25)).toBe('Twenty-five satang only');
        expect(amountInWordsEn(1_850_317.34)).toBe('One million eight hundred fifty thousand three hundred seventeen baht and thirty-four satang only');
        expect(amountInWordsEn(100_000_000_000)).toBe('One hundred billion baht only');
    });

    it('handles zero, rounding and negatives', () => {
        expect(amountInWordsEn(0)).toBe('Zero baht only');
        expect(amountInWordsEn(1.005)).toBe('One baht and one satang only');
        expect(amountInWordsEn(-100)).toBe('Minus one hundred baht only');
        expect(amountInWordsEn(-0.001)).toBe('Zero baht only');
        expect(amountInWordsEn(Number.NaN)).toBe('');
        expect(amountInWordsEn(1e21)).toBe('');
    });
});
