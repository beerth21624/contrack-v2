// ─── Sliding-window limit kept in process memory (one server instance; resets on restart) ───
import type { Clock } from '../../../../shared/application/ports';
import { LinkRateLimiter } from '../../application/ports/customer-link.repository';

/** Every this many hits, keys without a recent hit are dropped (memory stays bounded). */
const SWEEP_EVERY_HITS = 1000;

export class InMemoryLinkRateLimiter extends LinkRateLimiter {
    private readonly buckets = new Map<string, { windowMs: number; times: number[] }>();
    private hits = 0;

    constructor(private readonly clock: Clock) {
        super();
    }

    tryHit(key: string, limit: number, windowMs: number): boolean {
        const now = this.clock.now().getTime();
        const times = (this.buckets.get(key)?.times ?? []).filter(t => t > now - windowMs);
        if (times.length >= limit) {
            this.buckets.set(key, { windowMs, times });
            return false;
        }
        times.push(now);
        this.buckets.set(key, { windowMs, times });
        this.hits += 1;
        if (this.hits >= SWEEP_EVERY_HITS) this.sweep(now);
        return true;
    }

    private sweep(now: number): void {
        this.hits = 0;
        for (const [key, b] of this.buckets) {
            if (!b.times.some(t => t > now - b.windowMs)) this.buckets.delete(key);
        }
    }
}
