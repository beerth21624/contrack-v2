export interface RateLimitRule {
    /** What is counted, e.g. `otp-request:phone:+66812345678`. */
    key: string;
    /** Hits allowed within the window. */
    limit: number;
    windowMs: number;
}

/** Sliding-window rate limits (in-process store; time comes from the Clock). */
export abstract class RateLimiter {
    /**
     * All or nothing: when every rule still has room, records one hit for each and answers true; otherwise records
     * nothing and answers false.
     */
    abstract tryHit(rules: readonly RateLimitRule[]): Promise<boolean>;
    /** True when every rule still has room. Records nothing (pair with `hit` to count only some outcomes, e.g. failures). */
    abstract allows(rules: readonly RateLimitRule[]): Promise<boolean>;
    /** Records one hit for each rule, even past its limit. */
    abstract hit(rules: readonly RateLimitRule[]): Promise<void>;
}
