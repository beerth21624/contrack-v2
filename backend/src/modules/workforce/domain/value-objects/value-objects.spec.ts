import { MAX_CREW_HEADCOUNT, WORKFORCE_NAME_MAX, WORKFORCE_NOTE_MAX, WORKFORCE_WAGE_MAX } from '@contrack/contract';
import { bangkokToday, dayRange, overlaps, planDay, planTaskId } from './plan-day.value-object';
import {
    bahtPerDay, distinct, employment, headcount, nickname, optionalText, personRole, phone, trade, trades, workforceNote,
} from './workforce-fields';
import { WorkforceName } from './workforce-name.value-object';

const code = (r: { ok: boolean; error?: { code: string } }): string | undefined => (r.ok ? undefined : r.error?.code);

describe('WorkforceName', () => {
    it('trims, refuses blank and over-long names, compares case-insensitively', () => {
        const n = WorkforceName.create('  ทีมไฟฟ้า ช่างพงษ์ ', 'crew');
        expect(n.ok && n.value.value).toBe('ทีมไฟฟ้า ช่างพงษ์');
        expect(code(WorkforceName.create('   ', 'person'))).toBe('validation_failed');
        expect(WorkforceName.create('x'.repeat(WORKFORCE_NAME_MAX), 'crew').ok).toBe(true);
        expect(code(WorkforceName.create('x'.repeat(WORKFORCE_NAME_MAX + 1), 'crew'))).toBe('validation_failed');
        const a = WorkforceName.create('Team A', 'crew');
        const b = WorkforceName.create('team a', 'crew');
        expect(a.ok && b.ok && a.value.sameKey(b.value)).toBe(true);
        expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });
});

describe('workforce fields', () => {
    it('optional texts: trimmed, blank → null, length limits', () => {
        expect(optionalText('  hi ', 5, 'x')).toEqual({ ok: true, value: 'hi' });
        expect(optionalText('   ', 5, 'x')).toEqual({ ok: true, value: null });
        expect(optionalText(null, 5, 'x')).toEqual({ ok: true, value: null });
        expect(optionalText(undefined, 5, 'x')).toEqual({ ok: true, value: null });
        expect(code(optionalText('123456', 5, 'x'))).toBe('validation_failed');
        expect(code(workforceNote('x'.repeat(WORKFORCE_NOTE_MAX + 1)))).toBe('validation_failed');
        expect(code(nickname('x'.repeat(41)))).toBe('validation_failed');
    });

    it('phone numbers: digits, spaces, dashes and a leading +', () => {
        expect(phone(' 081-234 5678 ')).toEqual({ ok: true, value: '081-234 5678' });
        expect(phone('+66812345678')).toEqual({ ok: true, value: '+66812345678' });
        expect(phone('')).toEqual({ ok: true, value: null });
        expect(code(phone('081 ต่อ 2'))).toBe('validation_failed');
        expect(code(phone('08+1'))).toBe('validation_failed');
        expect(code(phone('1'.repeat(21)))).toBe('validation_failed');
    });

    it('baht per day: whole baht 0–100,000 or null', () => {
        expect(bahtPerDay(0, 'w')).toEqual({ ok: true, value: 0 });
        expect(bahtPerDay(WORKFORCE_WAGE_MAX, 'w')).toEqual({ ok: true, value: WORKFORCE_WAGE_MAX });
        expect(bahtPerDay(null, 'w')).toEqual({ ok: true, value: null });
        expect(code(bahtPerDay(-1, 'w'))).toBe('validation_failed');
        expect(code(bahtPerDay(WORKFORCE_WAGE_MAX + 1, 'w'))).toBe('validation_failed');
        expect(code(bahtPerDay(500.5, 'w'))).toBe('validation_failed');
    });

    it('headcounts: whole numbers 0–200', () => {
        expect(headcount(0, 'h').ok).toBe(true);
        expect(headcount(MAX_CREW_HEADCOUNT, 'h').ok).toBe(true);
        expect(code(headcount(MAX_CREW_HEADCOUNT + 1, 'h'))).toBe('validation_failed');
        expect(code(headcount(-1, 'h'))).toBe('validation_failed');
        expect(code(headcount(1.5, 'h'))).toBe('validation_failed');
    });

    it('enums: trades (deduplicated, order kept), roles, employment', () => {
        expect(trade('electrical').ok).toBe(true);
        expect(code(trade('welding'))).toBe('validation_failed');
        expect(trades(['masonry', 'painting', 'masonry'])).toEqual({ ok: true, value: ['masonry', 'painting'] });
        expect(code(trades(['masonry', 'x']))).toBe('validation_failed');
        expect(personRole('foreman').ok).toBe(true);
        expect(code(personRole('boss'))).toBe('validation_failed');
        expect(employment('subcontractor').ok).toBe(true);
        expect(code(employment('freelance'))).toBe('validation_failed');
        expect(distinct(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });
});

describe('plan days', () => {
    it('accepts real calendar days only', () => {
        expect(planDay('2026-02-28', 'd').ok).toBe(true);
        expect(planDay('2028-02-29', 'd').ok).toBe(true);
        expect(code(planDay('2026-02-29', 'd'))).toBe('validation_failed');
        expect(code(planDay('2026-13-01', 'd'))).toBe('validation_failed');
        expect(code(planDay('26-01-01', 'd'))).toBe('validation_failed');
    });

    it('a range keeps start ≤ end (one day is fine)', () => {
        expect(dayRange('2026-03-01', '2026-03-01').ok).toBe(true);
        expect(code(dayRange('2026-03-02', '2026-03-01'))).toBe('validation_failed');
        expect(code(dayRange('2026-02-30', '2026-03-01'))).toBe('validation_failed');
    });

    it('task ids "1.1" … "8.6"', () => {
        expect(planTaskId('1.1').ok).toBe(true);
        expect(planTaskId('8.6').ok).toBe(true);
        expect(planTaskId('2.10').ok).toBe(true);
        expect(code(planTaskId('0.1'))).toBe('validation_failed');
        expect(code(planTaskId('1'))).toBe('validation_failed');
        expect(code(planTaskId('1.0'))).toBe('validation_failed');
    });

    it('today is the Bangkok calendar day (UTC+7)', () => {
        expect(bangkokToday(new Date('2026-03-01T16:59:59.000Z'))).toBe('2026-03-01');
        expect(bangkokToday(new Date('2026-03-01T17:00:00.000Z'))).toBe('2026-03-02');
        expect(bangkokToday(new Date('2026-02-28T23:30:00.000Z'))).toBe('2026-03-01');
    });

    it('overlap of inclusive ranges', () => {
        const a = { start: '2026-03-01', end: '2026-03-10' };
        expect(overlaps(a, { start: '2026-03-10', end: '2026-03-12' })).toBe(true);
        expect(overlaps(a, { start: '2026-02-20', end: '2026-03-01' })).toBe(true);
        expect(overlaps(a, { start: '2026-03-11', end: '2026-03-12' })).toBe(false);
        expect(overlaps(a, { start: '2026-02-01', end: '2026-02-28' })).toBe(false);
    });
});
