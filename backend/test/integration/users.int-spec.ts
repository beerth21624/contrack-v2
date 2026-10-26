// ─── Integration: DrizzleUserRepository on PostgreSQL (unique e-mail → email_taken, also under a race) ───
import { randomUUID } from 'node:crypto';
import { DrizzleUserRepository } from '../../src/modules/identity/infrastructure/adapters/drizzle-user.repository';
import { User } from '../../src/modules/identity/domain/entities/user.entity';
import { DisplayName } from '../../src/modules/identity/domain/value-objects/display-name.value-object';
import { Email } from '../../src/modules/identity/domain/value-objects/email.value-object';
import { asUserId } from '../../src/shared/domain/ids';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, errorCodes, must } from '../support/seed';

function newUser(email: string, name = 'Alice'): User {
    return User.create({
        id: asUserId(randomUUID()),
        email: must(Email.create(email)),
        displayName: must(DisplayName.create(name)),
        passwordHash: 'scrypt$fake$hash',
        createdAt: T0,
    });
}

describeIfDatabase('DrizzleUserRepository (integration)', db => {
    it('stores a user and finds it by id, by e-mail and in bulk', async () => {
        if (await skipIfNoDatabase()) return;
        const repo = new DrizzleUserRepository(db());
        const alice = newUser('Alice@Example.com');
        const bob = newUser('bob@example.com', 'Bob');
        must(await repo.insert(alice));
        must(await repo.insert(bob));

        const byId = await repo.findById(alice.id);
        expect(byId).toBeDefined();
        expect(byId?.email.value).toBe('alice@example.com');
        expect(byId?.displayName.value).toBe('Alice');
        expect(byId?.passwordHash).toBe('scrypt$fake$hash');
        expect(byId?.createdAt.toISOString()).toBe(T0.toISOString());

        expect((await repo.findByEmail(must(Email.create('ALICE@example.com'))))?.id).toBe(alice.id);
        expect(await repo.findByEmail(must(Email.create('nobody@example.com')))).toBeUndefined();
        expect(await repo.findById(asUserId(randomUUID()))).toBeUndefined();

        const many = await repo.findMany([alice.id, bob.id, alice.id, asUserId(randomUUID())]);
        expect(many.map(u => u.id).sort()).toEqual([alice.id, bob.id].sort());
        expect(await repo.findMany([])).toEqual([]);
    });

    it('answers email_taken for a second user with the same e-mail', async () => {
        if (await skipIfNoDatabase()) return;
        const repo = new DrizzleUserRepository(db());
        must(await repo.insert(newUser('dup@example.com')));

        expect(errorCodes([await repo.insert(newUser('DUP@example.com', 'Other'))])).toEqual(['email_taken']);
    });

    it('lets exactly one of two concurrent registrations with the same e-mail win', async () => {
        if (await skipIfNoDatabase()) return;
        const repo = new DrizzleUserRepository(db());
        const results = await Promise.all([
            repo.insert(newUser('race@example.com', 'One')),
            repo.insert(newUser('race@example.com', 'Two')),
        ]);
        expect(results.filter(r => r.ok)).toHaveLength(1);
        expect(errorCodes(results)).toEqual(['email_taken']);
    });

    it('rolls the insert back with the surrounding transaction', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleUserRepository(ctx);
        const user = newUser('rollback@example.com');
        await expect(ctx.transaction(async () => {
            must(await repo.insert(user));
            throw new Error('abort');
        })).rejects.toThrow('abort');
        expect(await repo.findById(user.id)).toBeUndefined();
    });
});
