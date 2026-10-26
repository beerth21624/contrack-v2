import type { RefreshTokenId } from '../../../../shared/domain/ids';
import { RefreshTokenRepository } from '../../application/ports/refresh-token.repository';
import {
    RefreshToken, type RefreshTokenFamilyId, type RefreshTokenProps,
} from '../../domain/entities/refresh-token.entity';

/** Map-based refresh tokens (snapshots, so callers never share mutable state with the store). */
export class InMemoryRefreshTokenRepository extends RefreshTokenRepository {
    private readonly byId = new Map<RefreshTokenId, RefreshTokenProps>();

    insert(token: RefreshToken): Promise<void> {
        const s = token.toSnapshot();
        if (this.byId.has(s.id)) throw new Error(`InMemoryRefreshTokenRepository: duplicate id ${s.id}`);
        for (const other of this.byId.values()) {
            if (other.tokenHash === s.tokenHash) throw new Error('InMemoryRefreshTokenRepository: duplicate token hash');
        }
        this.byId.set(s.id, s);
        return Promise.resolve();
    }

    findByHash(tokenHash: string): Promise<RefreshToken | undefined> {
        for (const s of this.byId.values()) {
            if (s.tokenHash === tokenHash) return Promise.resolve(RefreshToken.rehydrate(s));
        }
        return Promise.resolve(undefined);
    }

    /**
     * Check, revoke and insert in one synchronous step (no await in between), so exactly one concurrent caller wins
     * and nobody sees the token revoked before its successor exists — like the conditional UPDATE in a transaction.
     */
    rotateIfActive(currentId: RefreshTokenId, successor: RefreshToken, at: Date): Promise<boolean> {
        const existing = this.byId.get(currentId);
        if (existing?.revokedAt !== null) return Promise.resolve(false);
        const next = successor.toSnapshot();
        if (this.byId.has(next.id)) throw new Error(`InMemoryRefreshTokenRepository: duplicate id ${next.id}`);
        this.byId.set(currentId, { ...existing, revokedAt: new Date(at.getTime()), replacedBy: next.id });
        this.byId.set(next.id, next);
        return Promise.resolve(true);
    }

    revokeFamily(familyId: RefreshTokenFamilyId, at: Date): Promise<void> {
        for (const [id, s] of this.byId) {
            if (s.familyId === familyId && s.revokedAt === null) this.byId.set(id, { ...s, revokedAt: new Date(at.getTime()) });
        }
        return Promise.resolve();
    }

    hasActiveInFamily(familyId: RefreshTokenFamilyId, now: Date): Promise<boolean> {
        for (const s of this.byId.values()) {
            if (s.familyId === familyId && s.revokedAt === null && s.expiresAt.getTime() > now.getTime()) {
                return Promise.resolve(true);
            }
        }
        return Promise.resolve(false);
    }

    /** Test helper: every stored token of a family. */
    listFamily(familyId: RefreshTokenFamilyId): RefreshToken[] {
        return [...this.byId.values()].filter(s => s.familyId === familyId).map(s => RefreshToken.rehydrate(s));
    }

    /** Test helper: every stored token. */
    all(): RefreshToken[] {
        return [...this.byId.values()].map(s => RefreshToken.rehydrate(s));
    }
}
