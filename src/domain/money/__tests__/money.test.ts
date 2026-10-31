import { describe, expect, it } from 'vitest';
import { allocate, pctOf, round2, roundQty, sumMoney } from '../money';
import { round2 as legacyRound2 } from '../../subcontracting/snapshot';

const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0));

describe('round2 / roundQty', () => {
    it('rounds half away from zero on the decimal value', () => {
        expect(round2(512.565)).toBe(512.57);
        expect(round2(-512.565)).toBe(-512.57);
        expect(round2(1.005)).toBe(1.01);
        expect(round2(2.344)).toBe(2.34);
        expect(legacyRound2).toBe(round2);
    });

    it('rounds quantities to 4 decimals', () => {
        expect(roundQty(1.00005)).toBe(1.0001);
        expect(roundQty(-1.00005)).toBe(-1.0001);
        expect(roundQty(12.34564)).toBe(12.3456);
        expect(roundQty(1_234_567.12345)).toBe(1_234_567.1235);
    });

    it('sums and takes percentages to the satang', () => {
        expect(sumMoney([0.1, 0.2])).toBe(0.3);
        expect(sumMoney([1.005, 1.005])).toBe(2.02);
        expect(sumMoney([])).toBe(0);
        expect(pctOf(1000, 0.05)).toBe(50);
        expect(pctOf(333.33, 0.1)).toBe(33.33);
    });
});

describe('allocate', () => {
    it('lets the last part absorb the rounding', () => {
        expect(allocate(100, [1, 1, 1])).toEqual([33.33, 33.33, 33.34]);
        expect(allocate(1000, [0.3, 0.4, 0.3])).toEqual([300, 400, 300]);
    });

    it('splits equally when every weight is 0, and handles negatives and no weights', () => {
        expect(allocate(10, [0, 0])).toEqual([5, 5]);
        expect(allocate(-100, [1, 3])).toEqual([-25, -75]);
        expect(allocate(50, [])).toEqual([]);
        expect(allocate(7.77, [2, 0, 1])).toEqual([5.18, 0, 2.59]);
    });

    it('always adds up to the (rounded) total', () => {
        for (const [total, weights] of [[100, [1, 1, 1]], [-0.05, [1, 1, 1]], [123_456.78, [3, 7, 11, 13]], [0.01, [1, 1]]] as const) {
            expect(sum(allocate(total, weights))).toBe(round2(total));
        }
    });

    it('rejects negative weights', () => {
        expect(() => allocate(100, [1, -1])).toThrow(RangeError);
    });
});
