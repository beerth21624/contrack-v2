import type { RefreshTokenId } from '../../../../shared/domain/ids';
import type { RefreshToken, RefreshTokenFamilyId } from '../../domain/entities/refresh-token.entity';

/** Stored refresh tokens (hashes only). */
export abstract class RefreshTokenRepository {
    abstract insert(token: RefreshToken): Promise<void>;
    /** By SHA-256 hex hash of the raw token. */
    abstract findByHash(tokenHash: string): Promise<RefreshToken | undefined>;
    /**
     * Rotation as one atomic step: revokes `currentId` with `replacedBy = successor.id` only if nobody revoked it yet
     * (`WHERE id = … AND revoked_at IS NULL`), and inserts `successor` only when that revoke won. True for the winner;
     * false (nothing written) when a concurrent refresh / logout got there first. Exactly one caller wins per token,
     * and nobody can observe the token revoked without its successor stored.
     */
    abstract rotateIfActive(currentId: RefreshTokenId, successor: RefreshToken, at: Date): Promise<boolean>;
    /** Revokes every still-active token of the family (already revoked ones keep their first revocation). */
    abstract revokeFamily(familyId: RefreshTokenFamilyId, at: Date): Promise<void>;
    /** True when the family still has a token that is neither revoked nor expired at `now`. */
    abstract hasActiveInFamily(familyId: RefreshTokenFamilyId, now: Date): Promise<boolean>;
}
