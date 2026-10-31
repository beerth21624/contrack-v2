import { describe, expect, it } from 'vitest';
import { isThaiTaxId } from '../tax-id';

describe('isThaiTaxId', () => {
    it('checks the 13-digit check digit', () => {
        expect(isThaiTaxId('0105536000313')).toBe(true);
        expect(isThaiTaxId('0105536000315')).toBe(false);
    });

    it('rejects other lengths and non-digits', () => {
        expect(isThaiTaxId('010553600031')).toBe(false);
        expect(isThaiTaxId('01055360003130')).toBe(false);
        expect(isThaiTaxId('0105536000a13')).toBe(false);
        expect(isThaiTaxId('0-1055-36000-31-3')).toBe(false);
        expect(isThaiTaxId('')).toBe(false);
    });
});
