import { sha256 } from '../../../../shared/infrastructure/crypto';
import { asRefreshTokenId } from '../../../../shared/domain/ids';
import { RefreshToken, asRefreshTokenFamilyId } from '../../domain/entities/refresh-token.entity';
import {
    ALICE, type IdentityKitOptions, REFRESH_TTL_MS, StaleReadRefreshTokenRepository, UNKNOWN_USER_ID, identityKit,
} from '../../testing/identity-test-kit';
import { REFRESH_REUSE_GRACE_MS } from '../ports/auth-settings.port';

async function signedIn(options: IdentityKitOptions = {}) {
    const kit = identityKit(options);
    const reg = await kit.register.execute(ALICE);
    if (!reg.ok) throw new Error('register failed');
    return { kit, session: reg.value };
}

describe('RefreshSessionUseCase', () => {
    it('uses a 30 s grace window by default', () => {
        expect(REFRESH_REUSE_GRACE_MS).toBe(30_000);
    });

    it('rotates: a new token in the same family, the old one revoked with replacedBy, in one transaction', async () => {
        const { kit, session } = await signedIn();
        kit.clock.advance(60_000);
        const runsBefore = kit.uow.runs;

        const result = await kit.refresh.execute({ refreshToken: session.refreshToken });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.user.id).toBe(session.user.id);
        expect(result.value.refreshToken).not.toBe(session.refreshToken);
        expect(result.value.accessToken).toBe(`access:${session.user.id}:2`);
        expect(result.value.refreshTokenExpiresAt).toEqual(new Date(kit.clock.now().getTime() + REFRESH_TTL_MS));
        expect(kit.uow.runs).toBe(runsBefore + 1);

        const old = await kit.refreshTokens.findByHash(sha256(session.refreshToken));
        const next = await kit.refreshTokens.findByHash(sha256(result.value.refreshToken));
        expect(next?.familyId).toBe(old?.familyId);
        expect(next?.isActive(kit.clock.now())).toBe(true);
        expect(old?.revokedAt).toEqual(kit.clock.now());
        expect(old?.replacedBy).toBe(next?.id);
    });

    it('the rotated token keeps working for the next refresh', async () => {
        const { kit, session } = await signedIn();
        const first = await kit.refresh.execute({ refreshToken: session.refreshToken });
        if (!first.ok) throw new Error('first refresh failed');
        const second = await kit.refresh.execute({ refreshToken: first.value.refreshToken });
        expect(second.ok).toBe(true);
    });

    describe('grace window (several tabs share one cookie)', () => {
        it('inside the window: the rotated token gets a sibling session and the family stays intact', async () => {
            const { kit, session } = await signedIn();
            const tabA = await kit.refresh.execute({ refreshToken: session.refreshToken });
            if (!tabA.ok) throw new Error('tab A refresh failed');
            kit.clock.advance(2_000);

            const tabB = await kit.refresh.execute({ refreshToken: session.refreshToken });

            expect(tabB.ok).toBe(true);
            if (!tabB.ok) return;
            expect(tabB.value.user.id).toBe(session.user.id);
            expect(tabB.value.refreshToken).not.toBe(tabA.value.refreshToken);
            const original = await kit.refreshTokens.findByHash(sha256(session.refreshToken));
            const a = await kit.refreshTokens.findByHash(sha256(tabA.value.refreshToken));
            const b = await kit.refreshTokens.findByHash(sha256(tabB.value.refreshToken));
            expect(b?.familyId).toBe(original?.familyId);
            expect(a?.isActive(kit.clock.now())).toBe(true);
            expect(b?.isActive(kit.clock.now())).toBe(true);
            // The presented token stays revoked, pointing at the winner's successor.
            expect(original?.replacedBy).toBe(a?.id);
            expect(kit.refreshTokens.listFamily(original!.familyId)).toHaveLength(3);

            // Both tabs keep refreshing independently afterwards.
            expect((await kit.refresh.execute({ refreshToken: tabA.value.refreshToken })).ok).toBe(true);
            expect((await kit.refresh.execute({ refreshToken: tabB.value.refreshToken })).ok).toBe(true);
        });

        it('exactly at the end of the window is still inside', async () => {
            const { kit, session } = await signedIn();
            await kit.refresh.execute({ refreshToken: session.refreshToken });
            kit.clock.advance(REFRESH_REUSE_GRACE_MS);
            expect((await kit.refresh.execute({ refreshToken: session.refreshToken })).ok).toBe(true);
        });

        it('the window is configurable through AuthSettings', async () => {
            const { kit, session } = await signedIn({ refreshReuseGraceMs: 0 });
            await kit.refresh.execute({ refreshToken: session.refreshToken });
            kit.clock.advance(1);
            const result = await kit.refresh.execute({ refreshToken: session.refreshToken });
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe('invalid_token');
        });

        it('inside the window but after logout: invalid_token (a sibling never revives a signed-out family)', async () => {
            const { kit, session } = await signedIn();
            const tabA = await kit.refresh.execute({ refreshToken: session.refreshToken });
            if (!tabA.ok) throw new Error('refresh failed');
            await kit.logout.execute({ refreshToken: tabA.value.refreshToken });
            kit.clock.advance(1_000);

            const result = await kit.refresh.execute({ refreshToken: session.refreshToken });

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe('invalid_token');
            const family = kit.refreshTokens.listFamily(kit.refreshTokens.all()[0]!.familyId);
            expect(family).toHaveLength(2);
            expect(family.every(t => t.isRevoked)).toBe(true);
        });

        it('concurrent race (deterministic): the loser of the conditional revoke gets a sibling, not a logout', async () => {
            const refreshTokens = new StaleReadRefreshTokenRepository();
            const { kit, session } = await signedIn({ refreshTokens });
            // Tab B read the token before tab A rotated it.
            const staleCopy = await refreshTokens.findByHash(sha256(session.refreshToken));
            const tabA = await kit.refresh.execute({ refreshToken: session.refreshToken });
            refreshTokens.serveStaleOnce(staleCopy!);

            const tabB = await kit.refresh.execute({ refreshToken: session.refreshToken });

            expect(tabA.ok).toBe(true);
            expect(tabB.ok).toBe(true);
            if (!tabA.ok || !tabB.ok) return;
            const a = await kit.refreshTokens.findByHash(sha256(tabA.value.refreshToken));
            const b = await kit.refreshTokens.findByHash(sha256(tabB.value.refreshToken));
            expect(a?.isActive(kit.clock.now())).toBe(true);
            expect(b?.isActive(kit.clock.now())).toBe(true);
            expect(b?.familyId).toBe(a?.familyId);
            // Only the winner inserted a successor; the loser's rotation was discarded, it added just the sibling.
            expect(kit.refreshTokens.all()).toHaveLength(3);
            const original = await kit.refreshTokens.findByHash(sha256(session.refreshToken));
            expect(original?.replacedBy).toBe(a?.id);
        });

        it('concurrent race (parallel calls): both callers get valid sessions', async () => {
            const { kit, session } = await signedIn();

            const [first, second] = await Promise.all([
                kit.refresh.execute({ refreshToken: session.refreshToken }),
                kit.refresh.execute({ refreshToken: session.refreshToken }),
            ]);

            expect(first.ok).toBe(true);
            expect(second.ok).toBe(true);
            if (!first.ok || !second.ok) return;
            expect(first.value.refreshToken).not.toBe(second.value.refreshToken);
            const t1 = await kit.refreshTokens.findByHash(sha256(first.value.refreshToken));
            const t2 = await kit.refreshTokens.findByHash(sha256(second.value.refreshToken));
            expect(t1?.isActive(kit.clock.now())).toBe(true);
            expect(t2?.isActive(kit.clock.now())).toBe(true);
            expect(t1?.familyId).toBe(t2?.familyId);
            const original = await kit.refreshTokens.findByHash(sha256(session.refreshToken));
            expect(original?.isRevoked).toBe(true);
        });
    });

    describe('reuse detection (outside the grace window)', () => {
        it('revokes the whole family and answers invalid_token', async () => {
            const { kit, session } = await signedIn();
            const rotated = await kit.refresh.execute({ refreshToken: session.refreshToken });
            if (!rotated.ok) throw new Error('refresh failed');
            kit.clock.advance(REFRESH_REUSE_GRACE_MS + 1);

            const reuse = await kit.refresh.execute({ refreshToken: session.refreshToken });

            expect(reuse.ok).toBe(false);
            if (!reuse.ok) expect(reuse.error.code).toBe('invalid_token');
            const current = await kit.refreshTokens.findByHash(sha256(rotated.value.refreshToken));
            expect(current?.isRevoked).toBe(true);
            expect(current?.revokedAt).toEqual(kit.clock.now());
            const family = kit.refreshTokens.listFamily(current!.familyId);
            expect(family).toHaveLength(2);
            expect(family.every(t => t.isRevoked)).toBe(true);

            // The legitimate holder of the newest token is signed out too.
            const afterReuse = await kit.refresh.execute({ refreshToken: rotated.value.refreshToken });
            expect(afterReuse.ok).toBe(false);
            if (!afterReuse.ok) expect(afterReuse.error.code).toBe('invalid_token');
        });

        it('also revokes siblings handed out during the grace window', async () => {
            const { kit, session } = await signedIn();
            await kit.refresh.execute({ refreshToken: session.refreshToken });
            const sibling = await kit.refresh.execute({ refreshToken: session.refreshToken });
            if (!sibling.ok) throw new Error('sibling refresh failed');
            kit.clock.advance(REFRESH_REUSE_GRACE_MS + 1);

            await kit.refresh.execute({ refreshToken: session.refreshToken });

            const s = await kit.refreshTokens.findByHash(sha256(sibling.value.refreshToken));
            expect(s?.isRevoked).toBe(true);
            expect(kit.refreshTokens.listFamily(s!.familyId).every(t => t.isRevoked)).toBe(true);
        });

        it('leaves other families (other devices) alone', async () => {
            const { kit, session } = await signedIn();
            const other = await kit.login.execute({ email: ALICE.email, password: ALICE.password });
            if (!other.ok) throw new Error('login failed');
            await kit.refresh.execute({ refreshToken: session.refreshToken });
            kit.clock.advance(REFRESH_REUSE_GRACE_MS + 1);
            await kit.refresh.execute({ refreshToken: session.refreshToken });

            const otherToken = await kit.refreshTokens.findByHash(sha256(other.value.refreshToken));
            expect(otherToken?.isActive(kit.clock.now())).toBe(true);
        });
    });

    it('answers invalid_token for a token revoked by logout, without issuing anything', async () => {
        const { kit, session } = await signedIn();
        await kit.logout.execute({ refreshToken: session.refreshToken });
        const result = await kit.refresh.execute({ refreshToken: session.refreshToken });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_token');
        expect(kit.refreshTokens.all()).toHaveLength(1);
    });

    it('answers invalid_token for an expired token', async () => {
        const { kit, session } = await signedIn();
        kit.clock.advance(REFRESH_TTL_MS);
        const result = await kit.refresh.execute({ refreshToken: session.refreshToken });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_token');
        expect(kit.refreshTokens.all()).toHaveLength(1);
    });

    it('accepts a token one millisecond before it expires', async () => {
        const { kit, session } = await signedIn();
        kit.clock.advance(REFRESH_TTL_MS - 1);
        expect((await kit.refresh.execute({ refreshToken: session.refreshToken })).ok).toBe(true);
    });

    it.each([
        ['no cookie', undefined],
        ['an empty cookie', ''],
        ['an unknown token', 'this-token-was-never-issued'],
    ])('answers invalid_token for %s', async (_label, refreshToken) => {
        const { kit } = await signedIn();
        const result = await kit.refresh.execute({ refreshToken });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_token');
    });

    it('answers invalid_token and revokes the family when the user no longer exists', async () => {
        const kit = identityKit();
        const raw = 'orphan-token';
        const familyId = asRefreshTokenFamilyId('00000000-0000-4000-8000-00000000f00d');
        await kit.refreshTokens.insert(RefreshToken.issue({
            id: asRefreshTokenId('00000000-0000-4000-8000-00000000beef'),
            userId: UNKNOWN_USER_ID,
            familyId,
            tokenHash: sha256(raw),
            now: kit.clock.now(),
            ttlMs: REFRESH_TTL_MS,
        }));
        const result = await kit.refresh.execute({ refreshToken: raw });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_token');
        expect(kit.refreshTokens.listFamily(familyId).every(t => t.isRevoked)).toBe(true);
    });
});
