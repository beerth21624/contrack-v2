import { describe, expect, it } from 'vitest';
import { numberCellEditText, numberCellText } from '../NumberCell';

describe('numberCellText', () => {
    it('formats like before by default', () => {
        expect(numberCellText(0)).toBe(formatted(0, 2));
        expect(numberCellText(1250.5)).toBe(formatted(1250.5, 2));
        expect(numberCellText(3, { digits: 0 })).toBe(formatted(3, 0));
        expect(numberCellText(0.15, { percent: true })).toBe(`${formatted(15, 0)}%`);
    });

    it('shows an empty cell for 0 with blankZero', () => {
        expect(numberCellText(0, { blankZero: true })).toBe('');
        expect(numberCellText(0, { blankZero: true, percent: true })).toBe('');
        expect(numberCellText(2.5, { blankZero: true })).toBe(formatted(2.5, 2));
    });
});

describe('numberCellEditText', () => {
    it('starts editing from the plain number', () => {
        expect(numberCellEditText(0)).toBe('0');
        expect(numberCellEditText(1250.5)).toBe('1250.5');
        expect(numberCellEditText(0.15, { percent: true })).toBe('15');
    });

    it('starts empty for 0 with blankZero (leaving without typing commits nothing)', () => {
        expect(numberCellEditText(0, { blankZero: true })).toBe('');
        expect(numberCellEditText(7, { blankZero: true })).toBe('7');
    });
});

function formatted(v: number, digits: number) {
    return v.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
