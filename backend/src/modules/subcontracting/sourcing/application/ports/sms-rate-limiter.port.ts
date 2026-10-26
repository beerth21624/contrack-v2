// ─── Rate limits of the SMS the sourcing stream makes the platform send (invitations, resends, addenda) ───
// Keeps a buyer (or a stolen buyer session) from turning invitations into an SMS cannon.

export interface SmsLimitRule {
    /** What is counted, e.g. `sc-resend:invitation:<id>`. */
    key: string;
    /** Units allowed within the window. */
    limit: number;
    windowMs: number;
    /** Units this request takes (default 1; e.g. the number of SMS invitations sent at once). */
    cost?: number;
}

/** Sliding-window limits (time from the Clock). */
export abstract class SmsRateLimiter {
    /**
     * All or nothing: when every rule still has room for its cost, records it for each and answers true; otherwise
     * records nothing and answers false.
     */
    abstract tryTake(rules: readonly SmsLimitRule[]): Promise<boolean>;
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const RESEND_MIN_GAP_MS = 10 * MINUTE_MS;
export const RESENDS_PER_DAY = 5;
export const BUYER_SMS_PER_DAY = 100;

/** A resend: at most one per 10 minutes and 5 per day for one invitation. */
export function resendRules(invitationId: string): SmsLimitRule[] {
    return [
        { key: `sc-resend:10m:${invitationId}`, limit: 1, windowMs: RESEND_MIN_GAP_MS },
        { key: `sc-resend:day:${invitationId}`, limit: RESENDS_PER_DAY, windowMs: DAY_MS },
    ];
}

/** Invitation / addendum SMS of one buyer workspace: at most 100 per day. No rule when nothing goes by SMS. */
export function buyerSmsRules(buyerWorkspaceId: string, count: number): SmsLimitRule[] {
    return count <= 0 ? [] : [{ key: `sc-sms:day:${buyerWorkspaceId}`, limit: BUYER_SMS_PER_DAY, windowMs: DAY_MS, cost: count }];
}
