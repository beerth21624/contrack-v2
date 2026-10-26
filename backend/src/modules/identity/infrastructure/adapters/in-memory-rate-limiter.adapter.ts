// ─── Sliding-window rate limits kept in process memory (one server instance; resets on restart) ───
import type { Clock } from '../../../../shared/application/ports';
import { RateLimiter, type RateLimitRule } from '../../application/ports/rate-limiter.port';

/** Every this many accepted hits, keys without a recent hit are dropped (memory stays bounded). */
const SWEEP_EVERY_HITS = 1000;

interface Bucket {
    windowMs: number;
    /** Hit times (ms), oldest first. */
    times: number[];
}

export class InMemoryRateLimiter extends RateLimiter {
    private readonly buckets = new Map<string, Bucket>();
    private hitsSinceSweep = 0;

    constructor(private readonly clock: Clock) {
        super();
    }

    tryHit(rules: readonly RateLimitRule[]): Promise<boolean> {
        if (!this.hasRoom(rules)) return Promise.resolve(false);
        this.record(rules);
        return Promise.resolve(true);
    }

    allows(rules: readonly RateLimitRule[]): Promise<boolean> {
        return Promise.resolve(this.hasRoom(rules));
    }

    hit(rules: readonly RateLimitRule[]): Promise<void> {
        this.record(rules);
        return Promise.resolve();
    }

    /** Number of keys currently tracked (tests). */
    get size(): number {
        return this.buckets.size;
    }

    /** Drops keys with no hit inside their window. */
    sweep(): void {
        const now = this.clock.now().getTime();
        this.hitsSinceSweep = 0;
        for (const [key, bucket] of this.buckets) {
            if (this.recent(key, bucket.windowMs, now).length === 0) this.buckets.delete(key);
        }
    }

    private hasRoom(rules: readonly RateLimitRule[]): boolean {
        const now = this.clock.now().getTime();
        return rules.every(rule => this.recent(rule.key, rule.windowMs, now).length < rule.limit);
    }

    private record(rules: readonly RateLimitRule[]): void {
        const now = this.clock.now().getTime();
        for (const rule of rules) {
            const times = this.recent(rule.key, rule.windowMs, now);
            times.push(now);
            this.buckets.set(rule.key, { windowMs: rule.windowMs, times });
        }
        this.hitsSinceSweep += 1;
        if (this.hitsSinceSweep >= SWEEP_EVERY_HITS) this.sweep();
    }

    private recent(key: string, windowMs: number, now: number): number[] {
        const cutoff = now - windowMs;
        return (this.buckets.get(key)?.times ?? []).filter(t => t > cutoff);
    }
}
