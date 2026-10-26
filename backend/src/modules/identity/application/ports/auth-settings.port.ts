/**
 * How long after a rotation the rotated refresh token is still honoured. Two browser tabs commonly refresh with
 * the same cookie within milliseconds; the one that loses gets a sibling token instead of triggering reuse
 * detection (which would sign the user out of every tab). After this window, presenting a rotated token is reuse.
 */
export const REFRESH_REUSE_GRACE_MS = 30_000;

/** Session settings the identity use cases need (built from AppConfig in the module, literal in tests). */
export class AuthSettings {
    constructor(
        readonly refreshTokenTtlDays: number,
        readonly refreshReuseGraceMs: number = REFRESH_REUSE_GRACE_MS,
    ) {}

    get refreshTokenTtlMs(): number {
        return this.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
    }

    get refreshTokenTtlSeconds(): number {
        return this.refreshTokenTtlDays * 24 * 60 * 60;
    }
}
