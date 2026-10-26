// ─── Integration: DrizzleMembershipRepository (locked section, owner count) and the last-owner rule under a race ───
import { ChangeMemberRoleUseCase } from '../../src/modules/workspaces/application/use-cases/change-member-role.use-case';
import { RemoveMemberUseCase } from '../../src/modules/workspaces/application/use-cases/remove-member.use-case';
import { Membership } from '../../src/modules/workspaces/domain/entities/membership.entity';
import { countOwners } from '../../src/modules/workspaces/domain/policies/owners.policy';
import { DrizzleMembershipRepository } from '../../src/modules/workspaces/infrastructure/adapters/drizzle-membership.repository';
import { DrizzleWorkspaceRepository } from '../../src/modules/workspaces/infrastructure/adapters/drizzle-workspace.repository';
import { DrizzleUserRepository } from '../../src/modules/identity/infrastructure/adapters/drizzle-user.repository';
import { IdentityUserDirectory } from '../../src/modules/identity/infrastructure/adapters/user-directory.adapter';
import { MemberAssignmentCleanup } from '../../src/shared/application/ports';
import { DrizzleUnitOfWork } from '../../src/shared/infrastructure/database/database';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, errorCodes, gate, seedMember, seedUser, seedWorkspace, sleep } from '../support/seed';

class NoAssignments extends MemberAssignmentCleanup {
    removeUser(): Promise<() => Promise<void>> {
        return Promise.resolve(() => Promise.resolve());
    }
}

describeIfDatabase('DrizzleMembershipRepository (integration)', db => {
    it('finds, lists, counts, updates and deletes memberships, scoped by workspace', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleMembershipRepository(ctx);
        const owner = await seedUser(ctx, 'Owner');
        const bob = await seedUser(ctx, 'Bob');
        const wsA = await seedWorkspace(ctx, owner);
        const wsB = await seedWorkspace(ctx, owner);
        await repo.insert(Membership.create({ workspaceId: wsA, userId: bob, role: 'viewer', joinedAt: new Date(T0.getTime() + 1000) }));

        expect((await repo.find(wsA, bob))?.role).toBe('viewer');
        expect(await repo.find(wsB, bob)).toBeUndefined();
        expect((await repo.listByWorkspace(wsA)).map(m => [m.userId, m.role])).toEqual([[owner, 'owner'], [bob, 'viewer']]);
        expect((await repo.listByUser(owner)).map(m => m.workspaceId).sort()).toEqual([wsA, wsB].sort());
        const counts = await repo.countByWorkspaces([wsA, wsB, wsA]);
        expect(counts.get(wsA)).toBe(2);
        expect(counts.get(wsB)).toBe(1);
        expect((await repo.countByWorkspaces([])).size).toBe(0);

        const m = await repo.find(wsA, bob);
        m?.changeRole('admin');
        if (m !== undefined) await repo.update(m);
        expect((await repo.find(wsA, bob))?.role).toBe('admin');
        expect((await repo.find(wsB, owner))?.role).toBe('owner');

        await repo.delete(wsA, bob);
        expect(await repo.find(wsA, bob)).toBeUndefined();
        await repo.deleteAllOfWorkspace(wsA);
        expect(await repo.listByWorkspace(wsA)).toEqual([]);
        expect(await repo.listByWorkspace(wsB)).toHaveLength(1);
    });

    it('withLockedMembers serialises two sections on one workspace; the second reads the first one\'s change', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleMembershipRepository(ctx);
        const owner = await seedUser(ctx, 'Owner');
        const second = await seedUser(ctx, 'Second');
        const ws = await seedWorkspace(ctx, owner);
        await seedMember(ctx, ws, second, 'owner');

        const firstInside = gate();
        const releaseFirst = gate();
        const order: string[] = [];
        const first = repo.withLockedMembers(ws, async members => {
            order.push(`first:${countOwners(members)}`);
            firstInside.open();
            await releaseFirst.promise;
            const target = members.find(m => m.userId === second);
            target?.changeRole('admin');
            if (target !== undefined) await repo.update(target);
            order.push('first:done');
        });
        await firstInside.promise;
        const secondSection = repo.withLockedMembers(ws, members => {
            order.push(`second:${countOwners(members)}`);
            return Promise.resolve();
        });
        await sleep(200); // the second section must be waiting for the lock
        expect(order).toEqual(['first:2']);
        releaseFirst.open();
        await Promise.all([first, secondSection]);
        expect(order).toEqual(['first:2', 'first:done', 'second:1']);
    });

    it('does not block a section on another workspace', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleMembershipRepository(ctx);
        const owner = await seedUser(ctx);
        const wsA = await seedWorkspace(ctx, owner);
        const wsB = await seedWorkspace(ctx, owner);
        const release = gate();
        const inside = gate();
        const holding = repo.withLockedMembers(wsA, async () => {
            inside.open();
            await release.promise;
        });
        await inside.promise;
        const other = await repo.withLockedMembers(wsB, members => Promise.resolve(members.length));
        expect(other).toBe(1);
        release.open();
        await holding;
    });

    it('two owners stepping down at the same moment: one succeeds, the other gets last_owner', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const memberships = new DrizzleMembershipRepository(ctx);
        const changeRole = new ChangeMemberRoleUseCase(
            new DrizzleWorkspaceRepository(ctx), memberships, new IdentityUserDirectory(new DrizzleUserRepository(ctx)),
            new DrizzleUnitOfWork(ctx),
        );
        const a = await seedUser(ctx, 'A');
        const b = await seedUser(ctx, 'B');
        const ws = await seedWorkspace(ctx, a);
        await seedMember(ctx, ws, b, 'owner');

        const results = await Promise.all([
            changeRole.execute({ actorId: a, workspaceId: ws, targetUserId: a, role: 'admin' }),
            changeRole.execute({ actorId: b, workspaceId: ws, targetUserId: b, role: 'admin' }),
        ]);

        expect(results.filter(r => r.ok)).toHaveLength(1);
        expect(errorCodes(results)).toEqual(['last_owner']);
        expect(countOwners(await memberships.listByWorkspace(ws))).toBe(1);
    });

    it('two owners leaving at the same moment: one leaves, the last owner stays', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const memberships = new DrizzleMembershipRepository(ctx);
        const remove = new RemoveMemberUseCase(
            new DrizzleWorkspaceRepository(ctx), memberships, new DrizzleUnitOfWork(ctx), new NoAssignments(),
        );
        const a = await seedUser(ctx, 'A');
        const b = await seedUser(ctx, 'B');
        const ws = await seedWorkspace(ctx, a);
        await seedMember(ctx, ws, b, 'owner');

        const results = await Promise.all([
            remove.execute({ actorId: a, workspaceId: ws, targetUserId: a }),
            remove.execute({ actorId: b, workspaceId: ws, targetUserId: b }),
        ]);

        expect(results.filter(r => r.ok)).toHaveLength(1);
        expect(errorCodes(results)).toEqual(['last_owner']);
        const left = await memberships.listByWorkspace(ws);
        expect(left).toHaveLength(1);
        expect(left[0]?.role).toBe('owner');
    });
});
