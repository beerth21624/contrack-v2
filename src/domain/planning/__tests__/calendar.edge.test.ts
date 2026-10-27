// QA edge tests for the planning calendar: serials, leap years, month ends, week buckets, overlaps.
import { describe, expect, it } from 'vitest';
import {
    bucketIndexOf, buildWeekBuckets, isoToSerial, monthSpan, monthsOf, overlapDays, serialToIso,
} from '../calendar';

const ser = (iso: string): number => {
    const s = isoToSerial(iso);
    if (s === null) throw new Error(`bad date ${iso}`);
    return s;
};

describe('isoToSerial / serialToIso', () => {
    it('anchors: 2026-01-01 = 46023, 1899-12-30 = 0, 1900-01-01 = 2', () => {
        expect(isoToSerial('2026-01-01')).toBe(46023);
        expect(isoToSerial('1899-12-30')).toBe(0);
        expect(isoToSerial('1900-01-01')).toBe(2);
    });

    it.each(['', null, undefined, 'abc', '2026-1-1', '26-01-01', '2026/01/01', '2026-01-01T00:00', '20260101'])('returns null for %j', (v) => {
        expect(isoToSerial(v)).toBeNull();
    });

    it('tolerates surrounding whitespace', () => {
        expect(isoToSerial(' 2026-01-01 ')).toBe(46023);
    });

    it('round-trips every day of 2026-2030 (including 2028-02-29)', () => {
        const start = ser('2026-01-01');
        const end = ser('2030-12-31');
        for (let s = start; s <= end; s++) {
            const iso = serialToIso(s);
            expect(isoToSerial(iso)).toBe(s);
        }
        expect(serialToIso(ser('2028-02-28') + 1)).toBe('2028-02-29');
    });

    it('leap years: 2028 and 2000 have Feb 29; 2027 and 2100 do not', () => {
        expect(ser('2028-03-01') - ser('2028-02-28')).toBe(2);
        expect(ser('2000-03-01') - ser('2000-02-28')).toBe(2);
        expect(ser('2027-03-01') - ser('2027-02-28')).toBe(1);
        expect(ser('2100-03-01') - ser('2100-02-28')).toBe(1);
    });

    it('month end rollover: Jan 31 + 1 day = Feb 1; Dec 31 + 1 = Jan 1', () => {
        expect(serialToIso(ser('2026-01-31') + 1)).toBe('2026-02-01');
        expect(serialToIso(ser('2026-12-31') + 1)).toBe('2027-01-01');
        expect(serialToIso(ser('2028-02-29') + 1)).toBe('2028-03-01');
    });

    it('a fractional serial rounds to the nearest day', () => {
        expect(serialToIso(46023.4)).toBe('2026-01-01');
        expect(serialToIso(46023.6)).toBe('2026-01-02');
    });

    // The doc says "Returns null for an empty / invalid date", but a well-formed yet impossible date rolls over
    // silently (Date.UTC normalises it), so a mistyped day shifts the whole schedule instead of being rejected.
    it('inputs: "2026-02-30", expected null (invalid date), got serial of 2026-03-02 (calendar.ts isoToSerial)', () => {
        expect(isoToSerial('2026-02-30')).toBeNull();
    });
    it('inputs: "2026-13-01", expected null (invalid month), got serial of 2027-01-01 (calendar.ts isoToSerial)', () => {
        expect(isoToSerial('2026-13-01')).toBeNull();
    });
    it('inputs: "2027-02-29" (2027 not leap), expected null, got 2027-03-01 (calendar.ts isoToSerial)', () => {
        expect(isoToSerial('2027-02-29')).toBeNull();
    });
});

describe('buildWeekBuckets', () => {
    it('4 buckets per month: W1 1-7, W2 8-15, W3 16-22, W4 23-end', () => {
        const b = buildWeekBuckets(ser('2026-01-10'), 1);
        expect(b.map(x => [x.start, x.end, x.days, x.weekLabel])).toEqual([
            ['2026-01-01', '2026-01-07', 7, 'W1'],
            ['2026-01-08', '2026-01-15', 8, 'W2'],
            ['2026-01-16', '2026-01-22', 7, 'W3'],
            ['2026-01-23', '2026-01-31', 9, 'W4'],
        ]);
        expect(b[0]?.monthLabel).toBe('ม.ค.-26');
    });

    it('the axis starts at the 1st of the month of the given date, whatever the day', () => {
        for (const d of ['2026-01-01', '2026-01-15', '2026-01-31']) {
            expect(buildWeekBuckets(ser(d), 1)[0]?.start).toBe('2026-01-01');
        }
    });

    it('February: 28 days in 2026 (W4 = 6 days), 29 days in 2028 (W4 = 7 days)', () => {
        const f26 = buildWeekBuckets(ser('2026-02-01'), 1);
        expect(f26[3]).toMatchObject({ start: '2026-02-23', end: '2026-02-28', days: 6 });
        const f28 = buildWeekBuckets(ser('2028-02-01'), 1);
        expect(f28[3]).toMatchObject({ start: '2028-02-23', end: '2028-02-29', days: 7 });
    });

    it('buckets are contiguous with no gap or overlap, over 5 years including leap days', () => {
        const b = buildWeekBuckets(ser('2026-01-01'), 60);
        expect(b).toHaveLength(240);
        for (let i = 1; i < b.length; i++) {
            expect(b[i]?.startSerial).toBe((b[i - 1]?.endSerial ?? NaN) + 1);
            expect(b[i]?.index).toBe(i);
        }
        const first = b[0];
        const last = b[239];
        expect(first?.start).toBe('2026-01-01');
        expect(last?.end).toBe('2030-12-31');
        expect(b.reduce((s, x) => s + x.days, 0)).toBe(ser('2030-12-31') - ser('2026-01-01') + 1);
    });

    it('Dec to Jan year rollover and month labels in Thai with a 2-digit year', () => {
        const b = buildWeekBuckets(ser('2026-12-15'), 3);
        const labels = monthsOf(b).map(m => m.label);
        expect(labels).toEqual(['ธ.ค.-26', 'ม.ค.-27', 'ก.พ.-27']);
        expect(b[4]?.start).toBe('2027-01-01');
    });

    it('0 months gives no buckets; 1 month gives exactly 4', () => {
        expect(buildWeekBuckets(ser('2026-01-01'), 0)).toEqual([]);
        expect(buildWeekBuckets(ser('2026-01-01'), 1)).toHaveLength(4);
    });

    it('monthIndex and week fields line up', () => {
        const b = buildWeekBuckets(ser('2026-01-01'), 3);
        expect(b.map(x => x.monthIndex)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
        expect(b.map(x => x.week)).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4]);
    });
});

describe('monthsOf / monthSpan', () => {
    it('monthsOf lists each month with its first bucket and last day', () => {
        const m = monthsOf(buildWeekBuckets(ser('2028-01-01'), 2));
        expect(m).toHaveLength(2);
        expect(m[0]).toMatchObject({ index: 0, start: '2028-01-01', end: '2028-01-31', firstBucket: 0, label: 'ม.ค.-28' });
        expect(m[1]).toMatchObject({ index: 1, start: '2028-02-01', end: '2028-02-29', firstBucket: 4 });
    });

    it('monthsOf of an empty axis is empty', () => {
        expect(monthsOf([])).toEqual([]);
    });

    it.each([
        ['2026-01-01', '2026-01-31', 1], ['2026-01-31', '2026-02-01', 2], ['2026-01-10', '2026-12-31', 12],
        ['2026-12-31', '2027-01-01', 2], ['2026-01-01', '2028-02-29', 26], ['2026-03-05', '2026-03-05', 1],
    ])('monthSpan(%s, %s) = %d (both months counted)', (a, b, want) => {
        expect(monthSpan(ser(a), ser(b))).toBe(want);
    });

    it('a finish before the start gives 0 or less, never a positive span', () => {
        expect(monthSpan(ser('2026-02-10'), ser('2026-01-10'))).toBeLessThanOrEqual(0);
    });
});

describe('overlapDays / bucketIndexOf', () => {
    it.each([
        [1, 5, 6, 10, 0], [1, 5, 5, 10, 1], [1, 10, 3, 4, 2], [3, 4, 1, 10, 2], [1, 10, 1, 10, 10], [5, 5, 5, 5, 1], [10, 1, 1, 10, 0],
    ])('overlapDays [%d,%d] with [%d,%d] = %d', (a, b, c, d, want) => {
        expect(overlapDays(a, b, c, d)).toBe(want);
    });

    it('bucketIndexOf: before the axis -1; first and last day of buckets; past the axis = last bucket', () => {
        const b = buildWeekBuckets(ser('2026-01-01'), 2);
        expect(bucketIndexOf(b, ser('2025-12-31'))).toBe(-1);
        expect(bucketIndexOf(b, ser('2026-01-01'))).toBe(0);
        expect(bucketIndexOf(b, ser('2026-01-07'))).toBe(0);
        expect(bucketIndexOf(b, ser('2026-01-08'))).toBe(1);
        expect(bucketIndexOf(b, ser('2026-02-28'))).toBe(7);
        expect(bucketIndexOf(b, ser('2030-01-01'))).toBe(7);
        expect(bucketIndexOf([], 5)).toBe(-1);
    });
});
