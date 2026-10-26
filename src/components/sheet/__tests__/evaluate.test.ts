import { describe, expect, it } from 'vitest';
import { evaluateNumber } from '../evaluate';

describe('evaluateNumber', () => {
    it('reads plain numbers with thousands separators', () => {
        expect(evaluateNumber('1,250.5')).toBe(1250.5);
        expect(evaluateNumber(' 42 ')).toBe(42);
        expect(evaluateNumber('-3')).toBe(-3);
        expect(evaluateNumber('.5')).toBe(0.5);
    });

    it('evaluates arithmetic as typed in Excel', () => {
        expect(evaluateNumber('7*2.3')).toBeCloseTo(16.1);
        expect(evaluateNumber('=12+3.5')).toBe(15.5);
        expect(evaluateNumber('(4+2)*0.9')).toBeCloseTo(5.4);
        expect(evaluateNumber('10-2-3')).toBe(5);
        expect(evaluateNumber('8/2/2')).toBe(2);
        expect(evaluateNumber('2+3*4')).toBe(14);
        expect(evaluateNumber('3x4')).toBe(12);
    });

    it('rejects anything else', () => {
        expect(evaluateNumber('')).toBeUndefined();
        expect(evaluateNumber('abc')).toBeUndefined();
        expect(evaluateNumber('2+')).toBeUndefined();
        expect(evaluateNumber('(2+3')).toBeUndefined();
        expect(evaluateNumber('1/0')).toBeUndefined();
        expect(evaluateNumber('alert(1)')).toBeUndefined();
    });
});
