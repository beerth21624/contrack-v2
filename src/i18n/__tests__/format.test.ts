import { describe, expect, it } from 'vitest';
import {
    amountInWords, formatBaht, formatDate, formatDateLong, formatDateTime, formatDocumentDate, formatMoney, formatNumberInput,
    formatPercent, formatQty, parseNumberInput,
    pickLocalized,
} from '../format';

describe('format', () => {
    it('amount in words follows the document language', () => {
        expect(amountInWords(21, 'th')).toBe('ยี่สิบเอ็ดบาทถ้วน');
        expect(amountInWords(21, 'en')).toBe('Twenty-one baht only');
    });

    it('dates: Christian-era year in the UI, Buddhist year only on Thai documents that ask for it', () => {
        expect(formatDate('2026-10-31', 'th')).toBe('31 ต.ค. 2026');
        expect(formatDate('2026-10-31', 'en')).toBe('31 Oct 2026');
        expect(formatDateLong('2026-10-31', 'th')).toBe('31 ตุลาคม 2026');
        expect(formatDocumentDate('2026-10-31', 'th', 'be')).toBe('31 ตุลาคม 2569');
        expect(formatDocumentDate('2026-10-31', 'th', 'ce')).toBe('31 ตุลาคม 2026');
        expect(formatDocumentDate('2026-10-31', 'en', 'be')).toBe('31 October 2026');
        expect(formatDate('2026-02-30', 'th')).toBe('');
        expect(formatDate('2026-09-30', 'en')).toBe('30 Sep 2026');
    });

    it('timestamps are shown in Bangkok time', () => {
        expect(formatDateTime('2026-10-31T07:05:00Z', 'th')).toBe('31 ต.ค. 2026 14:05');
        expect(formatDateTime('2026-10-31T07:05:00Z', 'en')).toBe('31 Oct 2026, 14:05');
        expect(formatDate('2026-10-30T18:00:00Z', 'en')).toBe('31 Oct 2026');
    });

    it('money, quantities and rates', () => {
        expect(formatBaht(1234.5, 'en')).toBe('THB 1,234.50');
        expect(formatBaht(1234.5, 'th')).toBe('1,234.50 บาท');
        expect(formatMoney(-5, 'th')).toBe('-5.00');
        expect(formatMoney(-0.001, 'en')).toBe('0.00');
        expect(formatQty(12.5, 'th')).toBe('12.5');
        expect(formatPercent(0.05, 'en')).toBe('5%');
    });

    it('pickLocalized falls back to the other language', () => {
        expect(pickLocalized('ไทย', '', 'en')).toBe('ไทย');
        expect(pickLocalized('', 'English', 'th')).toBe('English');
        expect(pickLocalized('ไทย', 'English', 'en')).toBe('English');
    });

    it('number inputs: digits grouped while typing, decimals left as typed, and parsed back', () => {
        for (const locale of ['th', 'en'] as const) {
            expect(formatNumberInput('1234567.5', locale)).toBe('1,234,567.5');
            expect(formatNumberInput('1234.', locale)).toBe('1,234.');
            expect(formatNumberInput('-1000.50', locale)).toBe('-1,000.50');
            expect(formatNumberInput('', locale)).toBe('');
            expect(formatNumberInput('12a', locale)).toBe('12a');
            expect(parseNumberInput('1,234,567.5', locale)).toBe('1234567.5');
            expect(parseNumberInput(undefined, locale)).toBe('');
            expect(formatMoney(1234.5, locale)).toBe('1,234.50');
        }
    });
});
