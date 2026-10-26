import { describe, expect, it } from 'vitest';
import {
    computePickList, isCountUnit, needsPrice, pickRow, qtyDigits, setOptionQty, splitByOption, type Catalogue,
} from './pick-list';

const OPTIONS = ['A ', 'B', 'C'] as const;
const CAT: Catalogue = { 'A': { unit: 'ชุด', mat: 10, lab: 5 }, B: { unit: 'ม.', mat: 2, lab: 1 }, C: { unit: 'ตัว', mat: 3, lab: 0 } };

describe('pick-list journey helpers', () => {
    it('whole counts show as integers; lengths and fractions keep 2 decimals', () => {
        expect(qtyDigits(1, 'ชุด')).toBe(0);
        expect(qtyDigits(18, ' ตัว ')).toBe(0);
        expect(qtyDigits(1.5, 'ตัว')).toBe(2);
        expect(qtyDigits(50, 'ม.')).toBe(2);
        expect(isCountUnit('ท่อน')).toBe(true);
        expect(isCountUnit('ม.')).toBe(false);
    });

    it('splits the first row of each option from duplicates, free text and empty rows', () => {
        const rows = [pickRow('B', 1, ''), pickRow('ป้าย', 1, 'ชุด'), pickRow('B', 2, ''), pickRow('A', 1, ''), pickRow('', 0, '')];
        const { first, others } = splitByOption(rows, OPTIONS);
        expect([...first.entries()]).toEqual([[1, 0], [0, 3]]);
        expect(others).toEqual([1, 2, 4]);
    });

    it('setting an option qty: updates its first row, or inserts a catalogue row in dropdown order', () => {
        const rows = [pickRow('C', 2, 'ตัว'), pickRow('ป้าย', 1, 'ชุด')];
        const withA = setOptionQty(rows, OPTIONS, 0, 3, CAT);
        expect(withA.map(r => r.item)).toEqual(['A ', 'C', 'ป้าย']);
        expect(withA[0]).toEqual({ item: 'A ', qty: 3, unit: 'ชุด', mat: null, lab: null });
        const withB = setOptionQty(withA, OPTIONS, 1, 4, CAT);
        expect(withB.map(r => r.item)).toEqual(['A ', 'B', 'C', 'ป้าย']);
        expect(setOptionQty(withB, OPTIONS, 2, 5, CAT)[2]?.qty).toBe(5);
        // qty 0 for an unlisted option adds nothing; for a listed one keeps the row at 0
        expect(setOptionQty(rows, OPTIONS, 1, 0, CAT)).toEqual(rows);
        const zeroC = setOptionQty(rows, OPTIONS, 2, 0, CAT);
        expect(zeroC).toHaveLength(2);
        expect(zeroC[0]?.qty).toBe(0);
        expect(computePickList(withB, CAT)).toEqual({ rows: 4, mat: 3 * 10 + 4 * 2 + 2 * 3, lab: 3 * 5 + 4 * 1, total: 30 + 8 + 6 + 15 + 4 });
        // a free-text-only list: new options go before it
        expect(setOptionQty([pickRow('ป้าย', 1, 'ชุด')], OPTIONS, 2, 1, CAT).map(r => r.item)).toEqual(['C', 'ป้าย']);
        expect(setOptionQty([], OPTIONS, 7, 1, CAT)).toEqual([]);
    });

    it('free text with no price typed is flagged; typed or catalogue prices are not', () => {
        expect(needsPrice(pickRow('ป้าย', 1, 'ชุด'), CAT)).toBe(true);
        expect(needsPrice(pickRow('ป้าย', 0, 'ชุด'), CAT)).toBe(true);
        expect(needsPrice({ ...pickRow('ป้าย', 1, 'ชุด'), lab: 300 }, CAT)).toBe(false);
        expect(needsPrice(pickRow('A', 1, ''), CAT)).toBe(false);
        expect(needsPrice(pickRow('', 1, ''), CAT)).toBe(false);
    });
});
