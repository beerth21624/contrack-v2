import { ALICE, BOB, UNKNOWN_USER_ID, identityKit } from '../../testing/identity-test-kit';
import { IdentityUserDirectory } from './user-directory.adapter';

describe('IdentityUserDirectory', () => {
    it('returns public profiles of the known ids and skips unknown ones', async () => {
        const kit = identityKit();
        const alice = await kit.register.execute(ALICE);
        const bob = await kit.register.execute(BOB);
        if (!alice.ok || !bob.ok) throw new Error('register failed');
        const directory = new IdentityUserDirectory(kit.users);

        const profiles = await directory.findMany([alice.value.user.id, bob.value.user.id, UNKNOWN_USER_ID, alice.value.user.id]);

        expect(profiles.size).toBe(2);
        expect(profiles.get(alice.value.user.id)).toEqual({ id: alice.value.user.id, email: 'alice@example.com', displayName: 'Alice' });
        expect(profiles.get(bob.value.user.id)).toEqual({ id: bob.value.user.id, email: 'bob@example.com', displayName: 'Bob' });
        expect(profiles.has(UNKNOWN_USER_ID)).toBe(false);
    });

    it('returns an empty map for no ids', async () => {
        const directory = new IdentityUserDirectory(identityKit().users);
        expect((await directory.findMany([])).size).toBe(0);
    });
});
