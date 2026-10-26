import { PHONE_EMAIL_DOMAIN } from '@contrack/contract';
import { asUserId } from '../../../../shared/domain/ids';
import { sha256 } from '../../../../shared/infrastructure/crypto';
import { User } from '../../domain/entities/user.entity';
import { DisplayName } from '../../domain/value-objects/display-name.value-object';
import { Email } from '../../domain/value-objects/email.value-object';
import { Phone } from '../../domain/value-objects/phone.value-object';
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

    it('never signs a phone-only user in with e-mail + password, even when the hash would match', async () => {
        const { kit } = await registered();
        const phone = Phone.rehydrate('+66812345678');
        await kit.users.insert(User.create({
            id: asUserId('00000000-0000-4000-8000-0000000000aa'),
            email: Email.rehydrate(phone.placeholderEmail),
            displayName: DisplayName.rehydrate('สมชาย'),
            passwordHash: 'hashed:guessable password',
            createdAt: kit.clock.now(),
            phone,
            phoneVerifiedAt: kit.clock.now(),
        }));
        for (const email of [phone.placeholderEmail, `66812345678@${PHONE_EMAIL_DOMAIN.toUpperCase()}`]) {
            const result = await kit.login.execute({ email, password: 'guessable password' });
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe('invalid_credentials');
        }
        expect(kit.hasher.dummyVerifications).toBe(2);
        expect(kit.refreshTokens.all()).toHaveLength(1);
    });
});
