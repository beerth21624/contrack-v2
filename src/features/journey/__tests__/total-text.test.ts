import { describe, expect, it } from 'vitest';
import { NO_TOTAL_TEXT, totalText } from '../total-text';

describe('totalText', () => {
    it('rounds a total to whole baht with grouping', () => {
        expect(totalText(1855162.248)).toBe((1855162).toLocaleString('th-TH'));
        expect(totalText(0)).toBe('0');
    });

    it('keeps a negative total readable', () => {
        expect(totalText(-1250.4)).toBe((-1250).toLocaleString('th-TH'));
    });

    it('shows a dash, not a blank, for a total beyond the number range', () => {
        expect(totalText(Infinity)).toBe(NO_TOTAL_TEXT);
        expect(totalText(-Infinity)).toBe(NO_TOTAL_TEXT);
        expect(totalText(Number.NaN)).toBe(NO_TOTAL_TEXT);
    });
});
