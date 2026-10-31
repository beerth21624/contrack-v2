import { describe, expect, it } from 'vitest';
import {
    formatBaht, formatDate, formatDateLong, formatDateTime, formatDocumentDate, formatMoney, formatPercent, formatQty,
    pickLocalized,
} from '../format';

describe('format', () => {
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
});
