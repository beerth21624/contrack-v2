import { and, eq, gt, isNull } from 'drizzle-orm';
import { type RefreshTokenId, asRefreshTokenId, asUserId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { refreshTokens } from '../../../../shared/infrastructure/database/schema';
import { RefreshTokenRepository } from '../../application/ports/refresh-token.repository';
import {
    RefreshToken, type RefreshTokenFamilyId, asRefreshTokenFamilyId,
} from '../../domain/entities/refresh-token.entity';

type RefreshTokenRow = typeof refreshTokens.$inferSelect;

function toRefreshToken(row: RefreshTokenRow): RefreshToken {
    return RefreshToken.rehydrate({
        id: asRefreshTokenId(row.id),
        userId: asUserId(row.userId),
        familyId: asRefreshTokenFamilyId(row.familyId),
        tokenHash: row.tokenHash,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        revokedAt: row.revokedAt,
        replacedBy: row.replacedBy === null ? null : asRefreshTokenId(row.replacedBy),
    });
}

export class DrizzleRefreshTokenRepository extends RefreshTokenRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(token: RefreshToken): Promise<void> {
        const s = token.toSnapshot();
        await this.ctx.executor.insert(refreshTokens).values({
            id: s.id,
            userId: s.userId,
            familyId: s.familyId,
            tokenHash: s.tokenHash,
            expiresAt: s.expiresAt,
            createdAt: s.createdAt,
            revokedAt: s.revokedAt,
            replacedBy: s.replacedBy,
        });
    }

    async findByHash(tokenHash: string): Promise<RefreshToken | undefined> {
        const rows = await this.ctx.executor.select().from(refreshTokens)
            .where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toRefreshToken(row);
    }

    /**
     * Conditional UPDATE then INSERT in one transaction (joins the caller's UnitOfWork when there is one). Under
     * READ COMMITTED a concurrent caller blocks on the row lock until the winner commits, then re-evaluates
     * `revoked_at IS NULL`, updates nothing and inserts nothing.
     */
    rotateIfActive(currentId: RefreshTokenId, successor: RefreshToken, at: Date): Promise<boolean> {
        return this.ctx.transaction(async () => {
            const rows = await this.ctx.executor.update(refreshTokens)
                .set({ revokedAt: at, replacedBy: successor.id })
                .where(and(eq(refreshTokens.id, currentId), isNull(refreshTokens.revokedAt)))
                .returning({ id: refreshTokens.id });
            if (rows.length !== 1) return false;
            await this.insert(successor);
            return true;
        });
    }

    async revokeFamily(familyId: RefreshTokenFamilyId, at: Date): Promise<void> {
        await this.ctx.executor.update(refreshTokens)
            .set({ revokedAt: at })
            .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
    }

    async hasActiveInFamily(familyId: RefreshTokenFamilyId, now: Date): Promise<boolean> {
        const rows = await this.ctx.executor.select({ id: refreshTokens.id }).from(refreshTokens)
            .where(and(
                eq(refreshTokens.familyId, familyId),
                isNull(refreshTokens.revokedAt),
                gt(refreshTokens.expiresAt, now),
            ))
            .limit(1);
        return rows.length > 0;
    }
}
