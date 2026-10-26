// ─── Refresh token: one link of a rotation chain ("family") that started at a login ───
// Only the SHA-256 hash of the opaque token is kept. Every use rotates the token: the old one is revoked with
// `replacedBy` pointing at its successor. Presenting a rotated token again means it was stolen → the family is revoked.
import type { Brand, RefreshTokenId, UserId } from '../../../../shared/domain/ids';

export type RefreshTokenFamilyId = Brand<string, 'RefreshTokenFamilyId'>;
export const asRefreshTokenFamilyId = (v: string): RefreshTokenFamilyId => v as RefreshTokenFamilyId;

export interface RefreshTokenProps {
    id: RefreshTokenId;
    userId: UserId;
    familyId: RefreshTokenFamilyId;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
    revokedAt: Date | null;
    replacedBy: RefreshTokenId | null;
}

export interface IssueRefreshToken {
    id: RefreshTokenId;
    userId: UserId;
    familyId: RefreshTokenFamilyId;
    tokenHash: string;
    now: Date;
    ttlMs: number;
}

const copyDate = (d: Date | null): Date | null => (d === null ? null : new Date(d.getTime()));

export class RefreshToken {
    private constructor(private props: RefreshTokenProps) {}

    /** A new, active token valid for `ttlMs` from `now`. */
    static issue(input: IssueRefreshToken): RefreshToken {
        if (input.ttlMs <= 0) throw new Error('RefreshToken.issue: ttlMs must be positive');
        return new RefreshToken({
            id: input.id,
            userId: input.userId,
            familyId: input.familyId,
            tokenHash: input.tokenHash,
            createdAt: new Date(input.now.getTime()),
            expiresAt: new Date(input.now.getTime() + input.ttlMs),
            revokedAt: null,
            replacedBy: null,
        });
    }

    static rehydrate(props: RefreshTokenProps): RefreshToken {
        return new RefreshToken(RefreshToken.copy(props));
    }

    private static copy(props: RefreshTokenProps): RefreshTokenProps {
        return {
            ...props,
            expiresAt: new Date(props.expiresAt.getTime()),
            createdAt: new Date(props.createdAt.getTime()),
            revokedAt: copyDate(props.revokedAt),
        };
    }

    get id(): RefreshTokenId { return this.props.id; }
    get userId(): UserId { return this.props.userId; }
    get familyId(): RefreshTokenFamilyId { return this.props.familyId; }
    get tokenHash(): string { return this.props.tokenHash; }
    get expiresAt(): Date { return new Date(this.props.expiresAt.getTime()); }
    get createdAt(): Date { return new Date(this.props.createdAt.getTime()); }
    get revokedAt(): Date | null { return copyDate(this.props.revokedAt); }
    get replacedBy(): RefreshTokenId | null { return this.props.replacedBy; }

    isExpired(now: Date): boolean {
        return now.getTime() >= this.props.expiresAt.getTime();
    }

    get isRevoked(): boolean {
        return this.props.revokedAt !== null;
    }

    /** True when this token was exchanged for a successor (presenting it again is reuse). */
    get wasRotated(): boolean {
        return this.props.replacedBy !== null;
    }

    isActive(now: Date): boolean {
        return !this.isRevoked && !this.isExpired(now);
    }

    /**
     * True when this token was rotated at most `graceMs` before `now` (a second tab refreshing with the same cookie
     * at the same moment). Outside the window, presenting a rotated token is reuse.
     */
    rotatedWithin(now: Date, graceMs: number): boolean {
        const revokedAt = this.props.revokedAt;
        if (revokedAt === null || this.props.replacedBy === null) return false;
        const elapsed = now.getTime() - revokedAt.getTime();
        return elapsed >= 0 && elapsed <= graceMs;
    }

    /** Idempotent: the first revocation (time and successor) is kept. */
    revoke(now: Date, replacedBy?: RefreshTokenId): void {
        if (this.isRevoked) return;
        this.props = { ...this.props, revokedAt: new Date(now.getTime()), replacedBy: replacedBy ?? null };
    }

    /** Issues the successor in the same family and revokes this token in its favour. Only for an active token. */
    rotate(input: { id: RefreshTokenId; tokenHash: string; now: Date; ttlMs: number }): RefreshToken {
        if (!this.isActive(input.now)) throw new Error('RefreshToken.rotate: token is not active');
        const next = RefreshToken.issue({
            id: input.id,
            userId: this.props.userId,
            familyId: this.props.familyId,
            tokenHash: input.tokenHash,
            now: input.now,
            ttlMs: input.ttlMs,
        });
        this.revoke(input.now, next.id);
        return next;
    }

    toSnapshot(): RefreshTokenProps {
        return RefreshToken.copy(this.props);
    }
}
