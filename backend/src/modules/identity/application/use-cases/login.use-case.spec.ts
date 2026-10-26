import { sha256 } from '../../../../shared/infrastructure/crypto';
import { ALICE, identityKit } from '../../testing/identity-test-kit';

async function registered() {
    const kit = identityKit();
    const reg = await kit.register.execute(ALICE);
    if (!reg.ok) throw new Error('register failed');
    return { kit, registration: reg.value };
}

describe('LoginUseCase', () => {
    it('signs in with the right password (e-mail case-insensitive) and starts a new token family', async () => {
        const { kit, registration } = await registered();
        const result = await kit.login.execute({ email: ' ALICE@EXAMPLE.COM ', password: ALICE.password });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.user.id).toBe(registration.user.id);
        expect(result.value.accessToken).toBe(`access:${registration.user.id}:2`);
        expect(result.value.refreshToken).not.toBe(registration.refreshToken);

        const loginToken = await kit.refreshTokens.findByHash(sha256(result.value.refreshToken));
        const registerToken = await kit.refreshTokens.findByHash(sha256(registration.refreshToken));
        expect(loginToken?.isActive(kit.clock.now())).toBe(true);
        expect(loginToken?.familyId).not.toBe(registerToken?.familyId);
        // Signing in elsewhere does not end the other session.
        expect(registerToken?.isActive(kit.clock.now())).toBe(true);
    });

    it('answers invalid_credentials for a wrong password', async () => {
        const { kit } = await registered();
        const result = await kit.login.execute({ email: ALICE.email, password: 'wrong password' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_credentials');
        expect(kit.refreshTokens.all()).toHaveLength(1);
        expect(kit.hasher.dummyVerifications).toBe(0);
    });

    it('answers the same invalid_credentials for an unknown e-mail, after a dummy verification', async () => {
        const { kit } = await registered();
        const wrongPassword = await kit.login.execute({ email: ALICE.email, password: 'wrong password' });
        const unknown = await kit.login.execute({ email: 'nobody@example.com', password: ALICE.password });
        expect(unknown.ok).toBe(false);
        if (!unknown.ok && !wrongPassword.ok) {
            expect(unknown.error.code).toBe('invalid_credentials');
            expect(unknown.error).toEqual(wrongPassword.error);
        }
        expect(kit.hasher.dummyVerifications).toBe(1);
        expect(kit.refreshTokens.all()).toHaveLength(1);
    });

    it('answers invalid_credentials (not a validation error) for a malformed e-mail', async () => {
        const { kit } = await registered();
        const result = await kit.login.execute({ email: 'not-an-email', password: ALICE.password });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_credentials');
        expect(kit.hasher.dummyVerifications).toBe(1);
    });
});
