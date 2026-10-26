import { FixedClock } from '../../../../shared/infrastructure/system';
import { InMemoryRateLimiter } from './in-memory-rate-limiter.adapter';

const rule = (key: string, limit: number, windowMs: number) => ({ key, limit, windowMs });

describe('InMemoryRateLimiter', () => {
    it('allows up to the limit within the window, then refuses until the oldest hit leaves it', async () => {
        const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));
        const limiter = new InMemoryRateLimiter(clock);
        expect(await limiter.tryHit([rule('k', 2, 1000)])).toBe(true);
        clock.advance(500);
        expect(await limiter.tryHit([rule('k', 2, 1000)])).toBe(true);
        expect(await limiter.tryHit([rule('k', 2, 1000)])).toBe(false);
        clock.advance(499);
        expect(await limiter.tryHit([rule('k', 2, 1000)])).toBe(false);
        clock.advance(1);
        expect(await limiter.tryHit([rule('k', 2, 1000)])).toBe(true);
    });

    it('is all or nothing across rules: a refused hit is recorded for none of them', async () => {
        const clock = new FixedClock();
        const limiter = new InMemoryRateLimiter(clock);
        expect(await limiter.tryHit([rule('full', 1, 60_000)])).toBe(true);
        expect(await limiter.tryHit([rule('free', 1, 60_000), rule('full', 1, 60_000)])).toBe(false);
        expect(await limiter.tryHit([rule('free', 1, 60_000)])).toBe(true);
    });

    it('keeps keys independent', async () => {
        const limiter = new InMemoryRateLimiter(new FixedClock());
        expect(await limiter.tryHit([rule('a', 1, 60_000)])).toBe(true);
        expect(await limiter.tryHit([rule('b', 1, 60_000)])).toBe(true);
        expect(await limiter.tryHit([rule('a', 1, 60_000)])).toBe(false);
    });

    it('allows answers without recording; hit records even past the limit', async () => {
        const clock = new FixedClock();
        const limiter = new InMemoryRateLimiter(clock);
        const failures = rule('fail', 2, 60_000);
        expect(await limiter.allows([failures])).toBe(true);
        expect(await limiter.allows([failures])).toBe(true);
        await limiter.hit([failures]);
        expect(await limiter.allows([failures])).toBe(true);
        await limiter.hit([failures]);
        expect(await limiter.allows([failures])).toBe(false);
        await limiter.hit([failures]);
        expect(await limiter.tryHit([failures])).toBe(false);
        clock.advance(60_000);
        expect(await limiter.allows([failures])).toBe(true);
    });

    it('sweeps keys without a hit inside their window', async () => {
        const clock = new FixedClock();
        const limiter = new InMemoryRateLimiter(clock);
        await limiter.tryHit([rule('short', 5, 1000), rule('long', 5, 10_000)]);
        clock.advance(1000);
        limiter.sweep();
        expect(limiter.size).toBe(1);
        clock.advance(9000);
        limiter.sweep();
        expect(limiter.size).toBe(0);
    });
});
