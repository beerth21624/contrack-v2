import { Phone } from '../value-objects/phone.value-object';
import { OTP_MAX_ATTEMPTS, OtpCode, asOtpCodeId } from './otp-code.entity';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const issue = () => OtpCode.issue({
    id: asOtpCodeId('00000000-0000-4000-8000-000000000001'),
    phone: Phone.rehydrate('+66812345678'),
    codeHash: 'hash',
    now: NOW,
    ttlMs: 300_000,
    requestIp: '10.0.0.1',
});

describe('OtpCode', () => {
    it('is issued unused with zero attempts and expires after the ttl', () => {
        const code = issue();
        expect(code.attempts).toBe(0);
        expect(code.isConsumed).toBe(false);
        expect(code.expiresAt.toISOString()).toBe('2026-03-01T10:05:00.000Z');
        expect(code.isUsable(NOW)).toBe(true);
        expect(code.isUsable(new Date(NOW.getTime() + 299_999))).toBe(true);
        expect(code.isUsable(new Date(NOW.getTime() + 300_000))).toBe(false);
        expect(code.requestIp).toBe('10.0.0.1');
    });

    it('becomes unusable after the maximum number of attempts', () => {
        const code = issue();
        for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i += 1) code.registerAttempt();
        expect(code.isUsable(NOW)).toBe(true);
        expect(code.attemptsLeft).toBe(1);
        code.registerAttempt();
        expect(code.isUsable(NOW)).toBe(false);
        expect(code.attemptsLeft).toBe(0);
    });

    it('is consumed once (first time kept)', () => {
        const code = issue();
        code.consume(NOW);
        code.consume(new Date(NOW.getTime() + 1000));
        expect(code.consumedAt?.toISOString()).toBe(NOW.toISOString());
        expect(code.isUsable(NOW)).toBe(false);
    });

    it('refuses a non-positive ttl or an empty hash (programming errors)', () => {
        const base = { id: asOtpCodeId('x'), phone: Phone.rehydrate('+66812345678'), codeHash: 'h', now: NOW, ttlMs: 1, requestIp: null };
        expect(() => OtpCode.issue({ ...base, ttlMs: 0 })).toThrow();
        expect(() => OtpCode.issue({ ...base, codeHash: '' })).toThrow();
    });

    it('rehydrates from a snapshot without sharing dates', () => {
        const code = issue();
        const snap = code.toSnapshot();
        snap.expiresAt.setUTCFullYear(2000);
        const again = OtpCode.rehydrate(code.toSnapshot());
        expect(again.expiresAt.toISOString()).toBe('2026-03-01T10:05:00.000Z');
        expect(again.phone.value).toBe('+66812345678');
    });
});
