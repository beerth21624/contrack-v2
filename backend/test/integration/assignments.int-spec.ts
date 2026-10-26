// ─── Integration: DrizzleAssignmentRepository — one assignee per level (upsert), removeByUser, tenant scope ───
import { JOURNEY_LEVELS } from '@contrack/domain/journey/levels';
import { LevelAssignment } from '../../src/modules/projects/domain/entities/level-assignment.entity';
import { LevelId } from '../../src/modules/projects/domain/value-objects/level-id.value-object';
import { DrizzleAssignmentRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-assignment.repository';
import type { ProjectId, UserId, WorkspaceId } from '../../src/shared/domain/ids';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, must, seedMember, seedProject, seedTwoTenants, seedUser } from '../support/seed';

const L1 = JOURNEY_LEVELS[0]?.id ?? '';
const L2 = JOURNEY_LEVELS[1]?.id ?? '';
const L3 = JOURNEY_LEVELS[2]?.id ?? '';

function assignment(
    workspaceId: WorkspaceId, projectId: ProjectId, levelId: string, userId: UserId, assignedBy: UserId, at = T0,
): LevelAssignment {
    return LevelAssignment.assign({ projectId, workspaceId, levelId: must(LevelId.create(levelId)), userId, assignedBy, now: at });
}

describeIfDatabase('DrizzleAssignmentRepository (integration)', db => {
    it('saves one assignment per level and replaces it on a second save', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleAssignmentRepository(ctx);
        const { a } = await seedTwoTenants(ctx);
        const bob = await seedUser(ctx, 'Bob');
        await seedMember(ctx, a.workspaceId, bob, 'estimator');

        const first = assignment(a.workspaceId, a.projectId, L1, a.owner, a.owner);
        await repo.save(first);
        expect((await repo.find(a.workspaceId, a.projectId, L1))?.toProps()).toEqual(first.toProps());

        const later = new Date(T0.getTime() + 1000);
        await repo.save(assignment(a.workspaceId, a.projectId, L1, bob, a.owner, later));
        const list = await repo.listByProject(a.workspaceId, a.projectId);
        expect(list.map(x => [x.levelId, x.userId])).toEqual([[L1, bob]]);
        expect(list[0]?.assignedAt.toISOString()).toBe(later.toISOString());

        await repo.remove(a.workspaceId, a.projectId, L1);
        expect(await repo.find(a.workspaceId, a.projectId, L1)).toBeUndefined();
    });

    it('removeByUser removes and returns only that user\'s assignments in that workspace', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleAssignmentRepository(ctx);
        const { a, b } = await seedTwoTenants(ctx);
        const bob = await seedUser(ctx, 'Bob');
        const carol = await seedUser(ctx, 'Carol');
        await seedMember(ctx, a.workspaceId, bob, 'estimator');
        await seedMember(ctx, a.workspaceId, carol, 'estimator');
        await seedMember(ctx, b.workspaceId, bob, 'estimator');
        const second = await seedProject(ctx, a.workspaceId, a.owner, { name: 'Second' });

        await repo.save(assignment(a.workspaceId, a.projectId, L1, bob, a.owner));
        await repo.save(assignment(a.workspaceId, a.projectId, L2, carol, a.owner));
        await repo.save(assignment(a.workspaceId, second.id, L3, bob, a.owner));
        await repo.save(assignment(b.workspaceId, b.projectId, L1, bob, b.owner));

        const removed = await repo.removeByUser(a.workspaceId, bob);

        expect(removed.map(x => [x.projectId, x.levelId]).sort()).toEqual([[a.projectId, L1], [second.id, L3]].sort());
        expect((await repo.listByProject(a.workspaceId, a.projectId)).map(x => x.userId)).toEqual([carol]);
        expect(await repo.listByProject(a.workspaceId, second.id)).toEqual([]);
        // Bob's assignment in the other tenant is untouched.
        expect((await repo.listByProject(b.workspaceId, b.projectId)).map(x => x.userId)).toEqual([bob]);
        expect(await repo.removeByUser(a.workspaceId, bob)).toEqual([]);
    });

    it('scopes reads, removals and deletes by workspace', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleAssignmentRepository(ctx);
        const { a, b } = await seedTwoTenants(ctx);
        await repo.save(assignment(a.workspaceId, a.projectId, L1, a.owner, a.owner));

        expect(await repo.find(b.workspaceId, a.projectId, L1)).toBeUndefined();
        expect(await repo.listByProject(b.workspaceId, a.projectId)).toEqual([]);
        await repo.remove(b.workspaceId, a.projectId, L1);
        await repo.deleteByProject(b.workspaceId, a.projectId);
        expect(await repo.find(a.workspaceId, a.projectId, L1)).toBeDefined();
        await repo.deleteByProject(a.workspaceId, a.projectId);
        expect(await repo.find(a.workspaceId, a.projectId, L1)).toBeUndefined();
    });
});
