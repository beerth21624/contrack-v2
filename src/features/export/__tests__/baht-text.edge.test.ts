// QA edge tests for BAHTTEXT-style Thai amounts: เอ็ด / ยี่สิบ rules, ล้าน groups, satang rounding, signs.
import { describe, expect, it } from 'vitest';
import { bahtText } from '../baht-text';

describe('bahtText: whole baht', () => {
    it.each([
        [0, 'ศูนย์บาทถ้วน'],
        [1, 'หนึ่งบาทถ้วน'],
        [2, 'สองบาทถ้วน'],
        [9, 'เก้าบาทถ้วน'],
        [10, 'สิบบาทถ้วน'],
        [11, 'สิบเอ็ดบาทถ้วน'],
        [12, 'สิบสองบาทถ้วน'],
        [20, 'ยี่สิบบาทถ้วน'],
        [21, 'ยี่สิบเอ็ดบาทถ้วน'],
        [22, 'ยี่สิบสองบาทถ้วน'],
        [30, 'สามสิบบาทถ้วน'],
        [31, 'สามสิบเอ็ดบาทถ้วน'],
        [99, 'เก้าสิบเก้าบาทถ้วน'],
        [100, 'หนึ่งร้อยบาทถ้วน'],
        [101, 'หนึ่งร้อยเอ็ดบาทถ้วน'],
        [110, 'หนึ่งร้อยสิบบาทถ้วน'],
        [111, 'หนึ่งร้อยสิบเอ็ดบาทถ้วน'],
        [120, 'หนึ่งร้อยยี่สิบบาทถ้วน'],
        [121, 'หนึ่งร้อยยี่สิบเอ็ดบาทถ้วน'],
        [999, 'เก้าร้อยเก้าสิบเก้าบาทถ้วน'],
        [1000, 'หนึ่งพันบาทถ้วน'],
        [1001, 'หนึ่งพันเอ็ดบาทถ้วน'],
        [1011, 'หนึ่งพันสิบเอ็ดบาทถ้วน'],
        [2021, 'สองพันยี่สิบเอ็ดบาทถ้วน'],
        [10000, 'หนึ่งหมื่นบาทถ้วน'],
        [10001, 'หนึ่งหมื่นเอ็ดบาทถ้วน'],
        [100000, 'หนึ่งแสนบาทถ้วน'],
        [123456, 'หนึ่งแสนสองหมื่นสามพันสี่ร้อยห้าสิบหกบาทถ้วน'],
        [999999, 'เก้าแสนเก้าหมื่นเก้าพันเก้าร้อยเก้าสิบเก้าบาทถ้วน'],
    ])('%d -> %s', (n, words) => {
        expect(bahtText(n)).toBe(words);
    });
});

describe('bahtText: ล้าน groups', () => {
    it.each([
        [1_000_000, 'หนึ่งล้านบาทถ้วน'],
        [1_000_001, 'หนึ่งล้านเอ็ดบาทถ้วน'],
        [1_000_010, 'หนึ่งล้านสิบบาทถ้วน'],
        [1_000_011, 'หนึ่งล้านสิบเอ็ดบาทถ้วน'],
        [1_000_100, 'หนึ่งล้านหนึ่งร้อยบาทถ้วน'],
        [1_001_000, 'หนึ่งล้านหนึ่งพันบาทถ้วน'],
        [1_100_000, 'หนึ่งล้านหนึ่งแสนบาทถ้วน'],
        [2_000_001, 'สองล้านเอ็ดบาทถ้วน'],
        [3_000_000, 'สามล้านบาทถ้วน'],
        [10_000_000, 'สิบล้านบาทถ้วน'],
        [11_000_000, 'สิบเอ็ดล้านบาทถ้วน'],
        [21_000_000, 'ยี่สิบเอ็ดล้านบาทถ้วน'],
        [100_000_000, 'หนึ่งร้อยล้านบาทถ้วน'],
        [1_855_162, 'หนึ่งล้านแปดแสนห้าหมื่นห้าพันหนึ่งร้อยหกสิบสองบาทถ้วน'],
        [999_999_999, 'เก้าร้อยเก้าสิบเก้าล้านเก้าแสนเก้าหมื่นเก้าพันเก้าร้อยเก้าสิบเก้าบาทถ้วน'],
        [1_000_000_000_000, 'หนึ่งล้านล้านบาทถ้วน'],
        [1_000_000_000_001, 'หนึ่งล้านล้านเอ็ดบาทถ้วน'],
    ])('%d -> %s', (n, words) => {
        expect(bahtText(n)).toBe(words);
    });
});

describe('bahtText: satang', () => {
    it.each([
        [0.01, 'หนึ่งสตางค์'],
        [0.1, 'สิบสตางค์'],
        [0.11, 'สิบเอ็ดสตางค์'],
        [0.2, 'ยี่สิบสตางค์'],
        [0.21, 'ยี่สิบเอ็ดสตางค์'],
        [0.25, 'ยี่สิบห้าสตางค์'],
        [0.5, 'ห้าสิบสตางค์'],
        [0.75, 'เจ็ดสิบห้าสตางค์'],
        [0.99, 'เก้าสิบเก้าสตางค์'],
        [1.25, 'หนึ่งบาทยี่สิบห้าสตางค์'],
        [1.01, 'หนึ่งบาทหนึ่งสตางค์'],
        [21.5, 'ยี่สิบเอ็ดบาทห้าสิบสตางค์'],
        [100.01, 'หนึ่งร้อยบาทหนึ่งสตางค์'],
        [1_000_001.21, 'หนึ่งล้านเอ็ดบาทยี่สิบเอ็ดสตางค์'],
        [1_850_317.34, 'หนึ่งล้านแปดแสนห้าหมื่นสามร้อยสิบเจ็ดบาทสามสิบสี่สตางค์'],
    ])('%d -> %s', (n, words) => {
        expect(bahtText(n)).toBe(words);
    });

    it('whole baht always ends with บาทถ้วน, with satang never has ถ้วน', () => {
        expect(bahtText(5)).toMatch(/บาทถ้วน$/);
        expect(bahtText(5.5)).not.toContain('ถ้วน');
        expect(bahtText(5.5)).toMatch(/สตางค์$/);
    });

    describe('rounding to the nearest satang', () => {
        it.each([
            [0.004, 'ศูนย์บาทถ้วน'],           // below half a satang -> 0
            [0.006, 'หนึ่งสตางค์'],            // above half a satang -> 1
            [1.994, 'หนึ่งบาทเก้าสิบเก้าสตางค์'],
            [1.996, 'สองบาทถ้วน'],             // carries into the baht
            [99.999, 'หนึ่งร้อยบาทถ้วน'],
            [0.999, 'หนึ่งบาทถ้วน'],
            [1_855_162.2484765165, 'หนึ่งล้านแปดแสนห้าหมื่นห้าพันหนึ่งร้อยหกสิบสองบาทยี่สิบห้าสตางค์'],
        ])('%d -> %s', (n, words) => {
            expect(bahtText(n)).toBe(words);
        });

        it('exactly half a satang in binary-exact values rounds up (0.125 -> 13 satang)', () => {
            expect(bahtText(0.125)).toBe('สิบสามสตางค์');
        });

        // The satang is rounded with Math.round(amount × 100). Decimal "half satang" amounts such as 1.005 or 1.015
        // are stored just below the half in binary (1.005 × 100 = 100.49999999999999), so they round DOWN, while
        // Excel BAHTTEXT / ROUND (decimal arithmetic) rounds them UP. Typical for money from qty × price.
        it('inputs: 1.005, expected "หนึ่งบาทหนึ่งสตางค์" (Excel rounds half up), got "หนึ่งบาทถ้วน" (baht-text.ts Math.round(amount * 100))', () => {
            expect(bahtText(1.005)).toBe('หนึ่งบาทหนึ่งสตางค์');
        });
        it('inputs: 1.015, expected "หนึ่งบาทสองสตางค์" (Excel rounds half up), got "หนึ่งบาทหนึ่งสตางค์" (baht-text.ts Math.round(amount * 100))', () => {
            expect(bahtText(1.015)).toBe('หนึ่งบาทสองสตางค์');
        });
    });
});

describe('bahtText: negative, zero and non-finite', () => {
    it('negative amounts get the ลบ prefix', () => {
        expect(bahtText(-1)).toBe('ลบหนึ่งบาทถ้วน');
        expect(bahtText(-25.25)).toBe('ลบยี่สิบห้าบาทยี่สิบห้าสตางค์');
        expect(bahtText(-0.5)).toBe('ลบห้าสิบสตางค์');
    });

    it('-0, 0 and amounts that round to zero have no sign', () => {
        expect(bahtText(-0)).toBe('ศูนย์บาทถ้วน');
        expect(bahtText(-0.001)).toBe('ศูนย์บาทถ้วน');
        expect(bahtText(0.004)).toBe('ศูนย์บาทถ้วน');
    });

    it.each([Number.NaN, Infinity, -Infinity])('non-finite %d -> empty text (never "undefined" or "NaN")', (n) => {
        expect(bahtText(n)).toBe('');
    });

    it('never contains undefined / NaN text for a spread of magnitudes', () => {
        for (const n of [0, 1, 7500, 1_850_317.34, 12_345_678.9, 987_654_321_012.34, 1e12]) {
            const t = bahtText(n);
            expect(t).not.toMatch(/undefined|NaN/);
            expect(t.length).toBeGreaterThan(0);
        }
    });
});
