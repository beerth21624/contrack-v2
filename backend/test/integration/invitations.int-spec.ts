// ─── Integration: DrizzleInvitationRepository (pending filter, token lookup, tenant scope) and single-use accept ───
import { randomUUID } from 'node:crypto';
import type { AssignableRole } from '@contrack/contract';
import { AcceptInvitationUseCase } from '../../src/modules/workspaces/application/use-cases/accept-invitation.use-case';
import { Invitation } from '../../src/modules/workspaces/domain/entities/invitation.entity';
import { Email } from '../../src/modules/workspaces/domain/value-objects/email.value-object';
import { DrizzleInvitationRepository } from '../../src/modules/workspaces/infrastructure/adapters/drizzle-invitation.repository';
import { DrizzleMembershipRepository } from '../../src/modules/workspaces/infrastructure/adapters/drizzle-membership.repository';
import { DrizzleUserRepository } from '../../src/modules/identity/infrastructure/adapters/drizzle-user.repository';
import { IdentityUserDirectory } from '../../src/modules/identity/infrastructure/adapters/user-directory.adapter';
import { type UserId, type WorkspaceId, asInvitationId } from '../../src/shared/domain/ids';
import { newOpaqueToken, sha256 } from '../../src/shared/infrastructure/crypto';
import { DrizzleUnitOfWork } from '../../src/shared/infrastructure/database/database';
import { FixedClock } from '../../src/shared/infrastructure/system';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, errorCodes, expectPgError, must, seedUser, seedWorkspace } from '../support/seed';

const DAY_MS = 24 * 60 * 60 * 1000;

function newInvitation(
    workspaceId: WorkspaceId, invitedBy: UserId, email: string,
    options: { role?: AssignableRole; now?: Date; token?: string } = {},
): Invitation {
    return Invitation.create({
        id: asInvitationId(randomUUID()),
        workspaceId,
        email: must(Email.create(email)),
        role: options.role ?? 'viewer',
        tokenHash: sha256(options.token ?? newOpaqueToken()),
        invitedBy,
        now: options.now ?? T0,
        ttlDays: 7,
    });
}

describeIfDatabase('DrizzleInvitationRepository (integration)', db => {
    it('stores an invitation and finds it by id (in its workspace only) and by token hash', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleInvitationRepository(ctx);
        const owner = await seedUser(ctx);
        const wsA = await seedWorkspace(ctx, owner);
        const wsB = await seedWorkspace(ctx, owner);
        const token = newOpaqueToken();
        const invitation = newInvitation(wsA, owner, 'Bob@Example.com', { role: 'estimator', token });
        await repo.insert(invitation);

        const byId = await repo.findById(wsA, invitation.id);
        expect(byId?.toProps()).toEqual(invitation.toProps());
        expect(byId?.email.value).toBe('bob@example.com');
        expect(await repo.findById(wsB, invitation.id)).toBeUndefined();
        expect((await repo.findByTokenHash(sha256(token)))?.id).toBe(invitation.id);
        expect(await repo.findByTokenHash(sha256('nope'))).toBeUndefined();
    });

    it('lists only pending invitations (not accepted, revoked or expired), newest first', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleInvitationRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const other = await seedWorkspace(ctx, owner);
        const now = new Date(T0.getTime() + 3 * DAY_MS);

        const older = newInvitation(ws, owner, 'older@example.com', { now: new Date(T0.getTime() + DAY_MS) });
        const newer = newInvitation(ws, owner, 'newer@example.com', { now: new Date(T0.getTime() + 2 * DAY_MS) });
        const expired = newInvitation(ws, owner, 'expired@example.com', { now: new Date(T0.getTime() - 5 * DAY_MS) });
        const accepted = newInvitation(ws, owner, 'accepted@example.com');
        const revoked = newInvitation(ws, owner, 'revoked@example.com');
        const elsewhere = newInvitation(other, owner, 'elsewhere@example.com');
        for (const inv of [older, newer, expired, accepted, revoked, elsewhere]) await repo.insert(inv);
        must(accepted.accept(owner, now));
        await repo.update(accepted);
        must(revoked.revoke(now));
        await repo.update(revoked);

        expect((await repo.listPending(ws, now)).map(i => i.id)).toEqual([newer.id, older.id]);
        expect((await repo.listPendingForEmail(ws, '  NEWER@example.com ', now)).map(i => i.id)).toEqual([newer.id]);
        expect(await repo.listPendingForEmail(ws, 'expired@example.com', now)).toEqual([]);

        const storedAccepted = await repo.findById(ws, accepted.id);
        expect(storedAccepted?.acceptedBy).toBe(owner);
        expect(storedAccepted?.status(now)).toBe('accepted');
        expect((await repo.findById(ws, revoked.id))?.status(now)).toBe('revoked');

        await repo.deleteAllOfWorkspace(ws);
        expect(await repo.findById(ws, newer.id)).toBeUndefined();
        expect(await repo.findById(other, elsewhere.id)).toBeDefined();
    });

    it('refuses a duplicate token hash (unique index)', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleInvitationRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const token = newOpaqueToken();
        await repo.insert(newInvitation(ws, owner, 'a@example.com', { token }));
        await expectPgError(repo.insert(newInvitation(ws, owner, 'b@example.com', { token })), '23505', 'invitations_token_key');
    });

    it('accepting one token twice at the same moment: exactly one succeeds (single use under the lock)', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const invitations = new DrizzleInvitationRepository(ctx);
        const memberships = new DrizzleMembershipRepository(ctx);
        const accept = new AcceptInvitationUseCase(
            memberships, invitations, new IdentityUserDirectory(new DrizzleUserRepository(ctx)), new DrizzleUnitOfWork(ctx),
            new FixedClock(new Date(T0.getTime() + 1000)),
        );
        const owner = await seedUser(ctx, 'Owner');
        const ws = await seedWorkspace(ctx, owner);
        const bob = await seedUser(ctx, 'Bob', 'bob@example.com');
        const token = newOpaqueToken();
        await invitations.insert(newInvitation(ws, owner, 'BOB@example.com', { role: 'estimator', token }));

        const results = await Promise.all([accept.execute({ userId: bob, token }), accept.execute({ userId: bob, token })]);

        expect(results.filter(r => r.ok)).toHaveLength(1);
        expect(errorCodes(results)).toEqual(['invitation_invalid']);
        expect((await memberships.find(ws, bob))?.role).toBe('estimator');
        expect(await memberships.listByWorkspace(ws)).toHaveLength(2);
    });
});
