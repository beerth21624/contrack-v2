import { sha256 } from '../../../../shared/infrastructure/crypto';
import { ALICE, identityKit } from '../../testing/identity-test-kit';

async function signedIn() {
    const kit = identityKit();
    const reg = await kit.register.execute(ALICE);
    if (!reg.ok) throw new Error('register failed');
    return { kit, session: reg.value };
}

describe('LogoutUseCase', () => {
    it('revokes the whole family of the presented token', async () => {
        const { kit, session } = await signedIn();
        const rotated = await kit.refresh.execute({ refreshToken: session.refreshToken });
        if (!rotated.ok) throw new Error('refresh failed');

        const result = await kit.logout.execute({ refreshToken: rotated.value.refreshToken });

        expect(result.ok).toBe(true);
        const token = await kit.refreshTokens.findByHash(sha256(rotated.value.refreshToken));
        expect(token?.revokedAt).toEqual(kit.clock.now());
        expect(token?.wasRotated).toBe(false);
        expect(kit.refreshTokens.listFamily(token!.familyId).every(t => t.isRevoked)).toBe(true);
    });

    it('leaves the sessions of other devices alone', async () => {
        const { kit, session } = await signedIn();
        const other = await kit.login.execute({ email: ALICE.email, password: ALICE.password });
        if (!other.ok) throw new Error('login failed');
        await kit.logout.execute({ refreshToken: session.refreshToken });
        const otherToken = await kit.refreshTokens.findByHash(sha256(other.value.refreshToken));
        expect(otherToken?.isActive(kit.clock.now())).toBe(true);
    });

    it('is idempotent: logging out twice is ok and keeps the first revocation time', async () => {
        const { kit, session } = await signedIn();
        await kit.logout.execute({ refreshToken: session.refreshToken });
        const firstAt = kit.clock.now();
        kit.clock.advance(10_000);
        const again = await kit.logout.execute({ refreshToken: session.refreshToken });
        expect(again.ok).toBe(true);
        const token = await kit.refreshTokens.findByHash(sha256(session.refreshToken));
        expect(token?.revokedAt).toEqual(firstAt);
    });

    it.each([
        ['no cookie', undefined],
        ['an empty cookie', ''],
        ['an unknown token', 'never-issued'],
    ])('is ok with %s and revokes nothing', async (_label, refreshToken) => {
        const { kit } = await signedIn();
        const result = await kit.logout.execute({ refreshToken });
        expect(result.ok).toBe(true);
        expect(kit.refreshTokens.all().every(t => !t.isRevoked)).toBe(true);
    });
});
