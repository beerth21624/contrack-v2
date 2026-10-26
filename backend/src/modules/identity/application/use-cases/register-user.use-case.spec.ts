import { sha256 } from '../../../../shared/infrastructure/crypto';
import type { User } from '../../domain/entities/user.entity';
import type { Email } from '../../domain/value-objects/email.value-object';
import { InMemoryUserRepository } from '../../infrastructure/adapters/in-memory-user.repository';
import { ALICE, REFRESH_TTL_MS, identityKit } from '../../testing/identity-test-kit';

/** Simulates the race: the existence check sees nobody, but another registration commits first. */
class RacingUserRepository extends InMemoryUserRepository {
    override findByEmail(_email: Email): Promise<User | undefined> {
        return Promise.resolve(undefined);
    }
}

describe('RegisterUserUseCase', () => {
    it('creates the user, provisions the personal workspace in the same transaction and issues a session', async () => {
        const kit = identityKit();
        const result = await kit.register.execute(ALICE);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const session = result.value;
        expect(session.user.email.value).toBe('alice@example.com');
        expect(session.user.displayName.value).toBe('Alice');
        expect(session.user.passwordHash).toBe(`hashed:${ALICE.password}`);
        expect(session.user.createdAt).toEqual(kit.clock.now());

        const stored = await kit.users.findById(session.user.id);
        expect(stored?.email.value).toBe('alice@example.com');
        expect(kit.provisioner.calls).toEqual([{ userId: session.user.id, displayName: 'Alice' }]);
        expect(kit.uow.runs).toBe(1);

        expect(session.accessToken).toBe(`access:${session.user.id}:1`);
        expect(session.expiresIn).toBe(900);
        expect(session.refreshTokenExpiresAt).toEqual(new Date(kit.clock.now().getTime() + REFRESH_TTL_MS));
        const token = await kit.refreshTokens.findByHash(sha256(session.refreshToken));
        expect(token?.userId).toBe(session.user.id);
        expect(token?.isActive(kit.clock.now())).toBe(true);
    });

    it('stores only the hash of the refresh token', async () => {
        const kit = identityKit();
        const result = await kit.register.execute(ALICE);
        if (!result.ok) throw new Error('register failed');
        const all = kit.refreshTokens.all();
        expect(all).toHaveLength(1);
        expect(all[0]!.tokenHash).toBe(sha256(result.value.refreshToken));
        expect(all[0]!.tokenHash).not.toBe(result.value.refreshToken);
    });

    it('answers email_taken for an e-mail that is already registered (case-insensitive)', async () => {
        const kit = identityKit();
        await kit.register.execute(ALICE);
        const again = await kit.register.execute({ ...ALICE, email: 'ALICE@example.com', displayName: 'Other' });
        expect(again.ok).toBe(false);
        if (!again.ok) expect(again.error.code).toBe('email_taken');
        expect(kit.provisioner.calls).toHaveLength(1);
        expect(kit.refreshTokens.all()).toHaveLength(1);
    });

    it('maps a unique-violation race at insert to email_taken without provisioning', async () => {
        const users = new RacingUserRepository();
        const kit = identityKit({ users });
        await kit.register.execute(ALICE);
        expect(kit.provisioner.calls).toHaveLength(1);

        const raced = await kit.register.execute({ ...ALICE, displayName: 'Second' });
        expect(raced.ok).toBe(false);
        if (!raced.ok) expect(raced.error.code).toBe('email_taken');
        expect(kit.provisioner.calls).toHaveLength(1);
        expect(kit.refreshTokens.all()).toHaveLength(1);
        expect(kit.signer.signed).toHaveLength(1);
    });

    it.each([
        ['an invalid e-mail', { ...ALICE, email: 'not-an-email' }],
        ['a too short password', { ...ALICE, password: 'short' }],
        ['a too long password', { ...ALICE, password: 'x'.repeat(129) }],
        ['an empty display name', { ...ALICE, displayName: '   ' }],
        ['the reserved phone placeholder domain', { ...ALICE, email: '66812345678@Phone.ConTrack.invalid' }],
    ])('rejects %s with validation_failed and writes nothing', async (_label, input) => {
        const kit = identityKit();
        const result = await kit.register.execute(input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('validation_failed');
        expect(kit.provisioner.calls).toHaveLength(0);
        expect(kit.refreshTokens.all()).toHaveLength(0);
        expect(kit.uow.runs).toBe(0);
    });

    it('propagates an unexpected provisioning failure (bug) instead of issuing a session', async () => {
        const kit = identityKit();
        kit.provisioner.failWith = new Error('boom');
        await expect(kit.register.execute(ALICE)).rejects.toThrow('boom');
        expect(kit.refreshTokens.all()).toHaveLength(0);
        expect(kit.signer.signed).toHaveLength(0);
    });
});
