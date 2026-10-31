import { describe, expect, it } from 'vitest';
import { addMonthsToDate } from '../../subcontracting/claims';
import { addDays, addMonths, bangkokToday, compareDates, daysBetween, isBusinessDate, payPeriodOf } from '../business-date';

describe('business dates', () => {
    it('takes today in Bangkok, not UTC', () => {
        expect(bangkokToday(new Date('2026-10-30T18:00:00Z'))).toBe('2026-10-31');
        expect(bangkokToday(new Date('2026-10-30T16:59:59Z'))).toBe('2026-10-30');
    });

    it('validates calendar days', () => {
        expect(isBusinessDate('2026-10-31')).toBe(true);
        expect(isBusinessDate('2028-02-29')).toBe(true);
        expect(isBusinessDate('2026-02-29')).toBe(false);
        expect(isBusinessDate('2026-2-01')).toBe(false);
        expect(isBusinessDate('2026-10-31T00:00:00Z')).toBe(false);
    });

    it('adds days and months', () => {
        expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
        expect(addMonths('2026-01-31', 1)).toBe(addMonthsToDate('2026-01-31', 1));
        expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
        expect(addMonths('2026-03-31', -13)).toBe(addMonthsToDate('2026-03-31', -13));
        expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
    });

    it('compares days and finds the pay period', () => {
        expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30);
        expect(daysBetween('2026-10-31', '2026-10-01')).toBe(-30);
        expect(compareDates('2026-01-02', '2026-01-10')).toBe(-1);
        expect(compareDates('2026-01-10', '2026-01-10')).toBe(0);
        expect(payPeriodOf('2026-10-15')).toBe('2026-10-A');
        expect(payPeriodOf('2026-10-16')).toBe('2026-10-B');
    });
});
