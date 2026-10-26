import { FixedClock } from '../../../../../shared/infrastructure/system';
import {
    BUYER_SMS_PER_DAY, RESEND_MIN_GAP_MS, RESENDS_PER_DAY, buyerSmsRules, resendRules,
} from '../../application/ports/sms-rate-limiter.port';
import { InMemorySmsRateLimiter } from './in-memory-sms-rate-limiter.adapter';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('InMemorySmsRateLimiter', () => {
    it('counts the cost of each take within a sliding window', async () => {
        const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
        const limiter = new InMemorySmsRateLimiter(clock);
        const rule = { key: 'k', limit: 5, windowMs: 1000 };
        expect(await limiter.tryTake([{ ...rule, cost: 3 }])).toBe(true);
        expect(await limiter.tryTake([{ ...rule, cost: 3 }])).toBe(false);
        expect(await limiter.tryTake([{ ...rule, cost: 2 }])).toBe(true);
        expect(await limiter.tryTake([rule])).toBe(false);
        clock.advance(1001);
        expect(await limiter.tryTake([{ ...rule, cost: 5 }])).toBe(true);
    });

    it('is all or nothing across rules', async () => {
        const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
        const limiter = new InMemorySmsRateLimiter(clock);
        expect(await limiter.tryTake([{ key: 'full', limit: 1, windowMs: 1000 }])).toBe(true);
        expect(await limiter.tryTake([{ key: 'free', limit: 1, windowMs: 1000 }, { key: 'full', limit: 1, windowMs: 1000 }])).toBe(false);
        expect(await limiter.tryTake([{ key: 'free', limit: 1, windowMs: 1000 }])).toBe(true);
    });

    it('an empty rule list always passes; sweep drops idle keys', async () => {
        const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
        const limiter = new InMemorySmsRateLimiter(clock);
        expect(await limiter.tryTake([])).toBe(true);
        await limiter.tryTake([{ key: 'a', limit: 1, windowMs: 1000 }]);
        expect(limiter.size).toBe(1);
        clock.advance(2000);
        limiter.sweep();
        expect(limiter.size).toBe(0);
    });

    it('resend: one per 10 minutes, five per day; buyer: 100 SMS per day', async () => {
        const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
        const limiter = new InMemorySmsRateLimiter(clock);
        for (let n = 0; n < RESENDS_PER_DAY; n += 1) {
            expect(await limiter.tryTake(resendRules('i'))).toBe(true);
            expect(await limiter.tryTake(resendRules('i'))).toBe(false);
            clock.advance(RESEND_MIN_GAP_MS);
        }
        expect(await limiter.tryTake(resendRules('i'))).toBe(false);
        expect(await limiter.tryTake(resendRules('other'))).toBe(true);
        expect(buyerSmsRules('ws', 0)).toEqual([]);
        expect(await limiter.tryTake(buyerSmsRules('ws', BUYER_SMS_PER_DAY))).toBe(true);
        expect(await limiter.tryTake(buyerSmsRules('ws', 1))).toBe(false);
        clock.advance(DAY_MS);
        expect(await limiter.tryTake(buyerSmsRules('ws', 1))).toBe(true);
    });
});
