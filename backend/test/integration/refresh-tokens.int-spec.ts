// ─── Integration: DrizzleRefreshTokenRepository (rotateIfActive race, revokeFamily) and refresh under a real race ───
import { randomUUID } from 'node:crypto';
import { AuthSettings } from '../../src/modules/identity/application/ports/auth-settings.port';
import { SessionIssuer } from '../../src/modules/identity/application/services/session-issuer.service';
import { RefreshSessionUseCase } from '../../src/modules/identity/application/use-cases/refresh-session.use-case';
import {
    RefreshToken, type RefreshTokenFamilyId, asRefreshTokenFamilyId,
} from '../../src/modules/identity/domain/entities/refresh-token.entity';
import { DrizzleRefreshTokenRepository } from '../../src/modules/identity/infrastructure/adapters/drizzle-refresh-token.repository';
import { DrizzleUserRepository } from '../../src/modules/identity/infrastructure/adapters/drizzle-user.repository';
import { FakeAccessTokenSigner } from '../../src/modules/identity/testing/identity-test-kit';
import { type UserId, asRefreshTokenId } from '../../src/shared/domain/ids';
import { newOpaqueToken, sha256 } from '../../src/shared/infrastructure/crypto';
import { DrizzleUnitOfWork } from '../../src/shared/infrastructure/database/database';
import { FixedClock, RandomIdGenerator } from '../../src/shared/infrastructure/system';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, seedUser } from '../support/seed';

const DAY_MS = 24 * 60 * 60 * 1000;

function issue(userId: UserId, familyId: RefreshTokenFamilyId = asRefreshTokenFamilyId(randomUUID()), now = T0, ttlMs = DAY_MS) {
    return RefreshToken.issue({
        id: asRefreshTokenId(randomUUID()), userId, familyId, tokenHash: sha256(randomUUID()), now, ttlMs,
    });
}

describeIfDatabase('DrizzleRefreshTokenRepository (integration)', db => {
    it('stores a token and finds it by hash with every field', async () => {
        if (await skipIfNoDatabase()) return;
        const repo = new DrizzleRefreshTokenRepository(db());
        const token = issue(await seedUser(db()));
        await repo.insert(token);
        const found = await repo.findByHash(token.tokenHash);
        expect(found?.toSnapshot()).toEqual(token.toSnapshot());
        expect(await repo.findByHash(sha256('unknown'))).toBeUndefined();
    });

    it('rotateIfActive: of two concurrent rotations exactly one wins, and only its successor is stored', async () => {
        if (await skipIfNoDatabase()) return;
        const repo = new DrizzleRefreshTokenRepository(db());
        const userId = await seedUser(db());
        const current = issue(userId);
        await repo.insert(current);
        const at = new Date(T0.getTime() + 1000);
        const successors = [issue(userId, current.familyId, at), issue(userId, current.familyId, at)];

        const results = await Promise.all(successors.map(s => repo.rotateIfActive(current.id, s, at)));

        expect(results.filter(Boolean)).toHaveLength(1);
        const winner = successors[results.indexOf(true)];
        const loser = successors[results.indexOf(false)];
        const stored = await repo.findByHash(current.tokenHash);
        expect(stored?.revokedAt?.toISOString()).toBe(at.toISOString());
        expect(stored?.replacedBy).toBe(winner?.id);
        expect((await repo.findByHash(winner?.tokenHash ?? ''))?.isActive(at)).toBe(true);
        expect(await repo.findByHash(loser?.tokenHash ?? '')).toBeUndefined();
    });

    it('rotateIfActive writes nothing for an already revoked token', async () => {
        if (await skipIfNoDatabase()) return;
        const repo = new DrizzleRefreshTokenRepository(db());
        const userId = await seedUser(db());
        const current = issue(userId);
        await repo.insert(current);
        await repo.revokeFamily(current.familyId, T0);
        const successor = issue(userId, current.familyId);
        expect(await repo.rotateIfActive(current.id, successor, T0)).toBe(false);
        expect(await repo.findByHash(successor.tokenHash)).toBeUndefined();
        expect((await repo.findByHash(current.tokenHash))?.replacedBy).toBeNull();
    });

    it('rotateIfActive joins the surrounding transaction (a rollback undoes the rotation)', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleRefreshTokenRepository(ctx);
        const userId = await seedUser(ctx);
        const current = issue(userId);
        await repo.insert(current);
        const successor = issue(userId, current.familyId);
        await expect(ctx.transaction(async () => {
            expect(await repo.rotateIfActive(current.id, successor, T0)).toBe(true);
            throw new Error('abort');
        })).rejects.toThrow('abort');
        expect((await repo.findByHash(current.tokenHash))?.isRevoked).toBe(false);
        expect(await repo.findByHash(successor.tokenHash)).toBeUndefined();
    });

    it('revokeFamily revokes every active token of the family, keeps earlier revocations and other families', async () => {
        if (await skipIfNoDatabase()) return;
        const repo = new DrizzleRefreshTokenRepository(db());
        const userId = await seedUser(db());
        const family = asRefreshTokenFamilyId(randomUUID());
        const old = issue(userId, family);
        const b = issue(userId, family);
        const c = issue(userId, family);
        const other = issue(userId);
        for (const tkn of [old, b, c, other]) await repo.insert(tkn);
        const t1 = new Date(T0.getTime() + 1000);
        const t2 = new Date(T0.getTime() + 2000);
        expect(await repo.rotateIfActive(old.id, issue(userId, family, t1), t1)).toBe(true);

        await repo.revokeFamily(family, t2);

        expect((await repo.findByHash(old.tokenHash))?.revokedAt?.toISOString()).toBe(t1.toISOString());
        expect((await repo.findByHash(b.tokenHash))?.revokedAt?.toISOString()).toBe(t2.toISOString());
        expect((await repo.findByHash(c.tokenHash))?.revokedAt?.toISOString()).toBe(t2.toISOString());
        expect((await repo.findByHash(other.tokenHash))?.isRevoked).toBe(false);
        expect(await repo.hasActiveInFamily(family, t2)).toBe(false);
        expect(await repo.hasActiveInFamily(other.familyId, t2)).toBe(true);
    });

    it('hasActiveInFamily ignores expired tokens', async () => {
        if (await skipIfNoDatabase()) return;
        const repo = new DrizzleRefreshTokenRepository(db());
        const token = issue(await seedUser(db()), undefined, T0, 1000);
        await repo.insert(token);
        expect(await repo.hasActiveInFamily(token.familyId, new Date(T0.getTime() + 999))).toBe(true);
        expect(await repo.hasActiveInFamily(token.familyId, new Date(T0.getTime() + 1000))).toBe(false);
    });

    it('two tabs refreshing with the same cookie at once both stay signed in (one rotation, one sibling)', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const users = new DrizzleUserRepository(ctx);
        const refreshTokens = new DrizzleRefreshTokenRepository(ctx);
        const clock = new FixedClock(T0);
        const settings = new AuthSettings(30);
        const sessions = new SessionIssuer(new FakeAccessTokenSigner(), settings, clock, new RandomIdGenerator());
        const refresh = new RefreshSessionUseCase(users, refreshTokens, sessions, settings, new DrizzleUnitOfWork(ctx), clock);

        const userId = await seedUser(ctx);
        const raw = newOpaqueToken();
        const first = RefreshToken.issue({
            id: asRefreshTokenId(randomUUID()), userId, familyId: asRefreshTokenFamilyId(randomUUID()),
            tokenHash: sha256(raw), now: T0, ttlMs: settings.refreshTokenTtlMs,
        });
        await refreshTokens.insert(first);

        const results = await Promise.all([refresh.execute({ refreshToken: raw }), refresh.execute({ refreshToken: raw })]);

        expect(results.map(r => r.ok)).toEqual([true, true]);
        const issued = results.flatMap(r => (r.ok ? [r.value.refreshToken] : []));
        expect(new Set(issued).size).toBe(2);
        for (const token of issued) {
            const stored = await refreshTokens.findByHash(sha256(token));
            expect(stored?.familyId).toBe(first.familyId);
            expect(stored?.isActive(T0)).toBe(true);
        }
        expect((await refreshTokens.findByHash(first.tokenHash))?.wasRotated).toBe(true);

        // Outside the grace window the same raw token is reuse: the family dies.
        clock.advance(settings.refreshReuseGraceMs + 1);
        const reuse = await refresh.execute({ refreshToken: raw });
        expect(reuse.ok ? 'ok' : reuse.error.code).toBe('invalid_token');
        expect(await refreshTokens.hasActiveInFamily(first.familyId, clock.now())).toBe(false);
    });
});
