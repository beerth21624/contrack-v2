// ─── Sliding-window SMS limits kept in process memory (one server instance; resets on restart) ───
import type { Clock } from '../../../../../shared/application/ports';
import { type SmsLimitRule, SmsRateLimiter } from '../../application/ports/sms-rate-limiter.port';

/** Every this many accepted takes, keys without a recent hit are dropped (memory stays bounded). */
const SWEEP_EVERY = 1000;

interface Bucket {
    windowMs: number;
    /** One entry per unit taken: its time (ms), oldest first. */
    times: number[];
}

export class InMemorySmsRateLimiter extends SmsRateLimiter {
    private readonly buckets = new Map<string, Bucket>();
    private takesSinceSweep = 0;

    constructor(private readonly clock: Clock) {
        super();
    }

    tryTake(rules: readonly SmsLimitRule[]): Promise<boolean> {
        const now = this.clock.now().getTime();
        if (rules.some(rule => this.recent(rule.key, rule.windowMs, now).length + (rule.cost ?? 1) > rule.limit)) {
            return Promise.resolve(false);
        }
        for (const rule of rules) {
            const times = this.recent(rule.key, rule.windowMs, now);
            for (let k = 0; k < (rule.cost ?? 1); k += 1) times.push(now);
            this.buckets.set(rule.key, { windowMs: rule.windowMs, times });
        }
        this.takesSinceSweep += 1;
        if (this.takesSinceSweep >= SWEEP_EVERY) this.sweep();
        return Promise.resolve(true);
    }

    /** Number of keys currently tracked (tests). */
    get size(): number {
        return this.buckets.size;
    }

    /** Drops keys with nothing inside their window. */
    sweep(): void {
        const now = this.clock.now().getTime();
        this.takesSinceSweep = 0;
        for (const [key, bucket] of this.buckets) {
            if (this.recent(key, bucket.windowMs, now).length === 0) this.buckets.delete(key);
        }
    }

    private recent(key: string, windowMs: number, now: number): number[] {
        const cutoff = now - windowMs;
        return (this.buckets.get(key)?.times ?? []).filter(t => t > cutoff);
    }
}
