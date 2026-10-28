import { RATE_CARD_NAME_MAX, RATE_CARD_NOTE_MAX, RATE_CARD_RATE_MAX } from '@contrack/contract';
import { DailyRate } from './daily-rate.value-object';
import { RateCardName } from './rate-card-name.value-object';
import { rateCardNote } from './rate-card-note.value-object';

describe('RateCardName', () => {
    it('trims and accepts 1–60 characters', () => {
        const r = RateCardName.create('  ทีมไฟฟ้า ช่างพงษ์  ');
        expect(r.ok && r.value.value).toBe('ทีมไฟฟ้า ช่างพงษ์');
        expect(RateCardName.create('x'.repeat(RATE_CARD_NAME_MAX)).ok).toBe(true);
    });

    it('refuses empty and too long names', () => {
        const empty = RateCardName.create('   ');
        expect(!empty.ok && empty.error.code).toBe('validation_failed');
        const long = RateCardName.create('x'.repeat(RATE_CARD_NAME_MAX + 1));
        expect(!long.ok && long.error.code).toBe('validation_failed');
    });

    it('equals compares the exact value; sameKey ignores case', () => {
        const a = RateCardName.create('Team A');
        const b = RateCardName.create(' team a ');
        if (!a.ok || !b.ok) throw new Error('names should be valid');
        expect(a.value.equals(b.value)).toBe(false);
        expect(a.value.sameKey(b.value)).toBe(true);
        expect(a.value.key).toBe('team a');
    });
});

describe('DailyRate', () => {
    it('accepts whole baht from 0 to 100,000', () => {
        expect(DailyRate.create(0, 'skilled').ok).toBe(true);
        const r = DailyRate.create(RATE_CARD_RATE_MAX, 'labourer');
        expect(r.ok && r.value.baht).toBe(RATE_CARD_RATE_MAX);
    });

    it.each([-1, RATE_CARD_RATE_MAX + 1, 800.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses %p', value => {
        const r = DailyRate.create(value, 'skilled');
        expect(!r.ok && r.error.code).toBe('validation_failed');
    });

    it('names the rate in the message', () => {
        const r = DailyRate.create(-1, 'labourer');
        expect(!r.ok && r.error.message).toContain('labourer rate');
    });
});

describe('rateCardNote', () => {
    it('trims, empty → null, too long refused', () => {
        expect(rateCardNote(undefined)).toEqual({ ok: true, value: null });
        expect(rateCardNote(null)).toEqual({ ok: true, value: null });
        expect(rateCardNote('   ')).toEqual({ ok: true, value: null });
        expect(rateCardNote(' หลังคา ไฟฟ้า ')).toEqual({ ok: true, value: 'หลังคา ไฟฟ้า' });
        expect(rateCardNote('x'.repeat(RATE_CARD_NOTE_MAX)).ok).toBe(true);
        expect(rateCardNote('x'.repeat(RATE_CARD_NOTE_MAX + 1)).ok).toBe(false);
    });
});
