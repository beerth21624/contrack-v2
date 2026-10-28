// ─── Integration: waiting windows after planned tasks (W2, ช่วงรอ) on PostgreSQL ───
// The Drizzle repository (tenant scope, numeric task order, replace-all keeping unchanged stamps), the check constraints
// and the composite foreign key, the cascade when a project or workspace is deleted, and the use cases with the
// workforce lock (concurrent replace-alls never merge).
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { DrizzleProjectRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-project.repository';
import { RepositoryProjectStatusLookup } from '../../src/modules/projects/infrastructure/adapters/project-directory.adapter';
import {
    GetProjectTaskLagsUseCase, ListWorkspaceTaskLagsUseCase, PutProjectTaskLagsUseCase,
} from '../../src/modules/workforce/application/use-cases/project-task-lags.use-case';
import { WorkforceAccess } from '../../src/modules/workforce/application/workforce-access';
import { DrizzleProjectTaskLagRepository } from '../../src/modules/workforce/infrastructure/adapters/drizzle-project-task-lag.repository';
import { DrizzleWorkforceLock } from '../../src/modules/workforce/infrastructure/adapters/drizzle-workforce-lock.adapter';
import { DrizzleMembershipRepository } from '../../src/modules/workspaces/infrastructure/adapters/drizzle-membership.repository';
import { RepositoryWorkspaceAccess } from '../../src/modules/workspaces/infrastructure/adapters/workspace-access.adapter';
import { type ProjectId, type UserId, type WorkspaceId, asUserId } from '../../src/shared/domain/ids';
import { type DatabaseContext, DrizzleUnitOfWork } from '../../src/shared/infrastructure/database/database';
import { projectTaskLags, projects, workspaces } from '../../src/shared/infrastructure/database/schema';
import { FixedClock } from '../../src/shared/infrastructure/system';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { FakeModuleFlags } from '../../src/shared/testing/platform-fakes';
import { T0, expectPgError, must, seedMember, seedProject, seedTwoTenants, seedUser, seedWorkspace } from '../support/seed';

const later = (ms: number): Date => new Date(T0.getTime() + ms);

async function stamps(ctx: DatabaseContext, projectId: ProjectId): Promise<Record<string, { by: string; at: string }>> {
    const rows = await ctx.db.select().from(projectTaskLags).where(eq(projectTaskLags.projectId, projectId));
    return Object.fromEntries(rows.map(r => [r.taskId, { by: r.updatedBy, at: r.updatedAt.toISOString() }]));
}

describeIfDatabase('task lags repository (integration)', db => {
    it('replace-all: numeric task order, Thai notes, null notes; left-out tasks deleted; unchanged rows keep their stamp', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectTaskLagRepository(ctx);
        const owner = await seedUser(ctx);
        const other = await seedUser(ctx, 'Estimator');
        const ws = await seedWorkspace(ctx, owner);
        const p = (await seedProject(ctx, ws, owner)).id;

        await repo.replace(ws, p, [
            { taskId: '5.1', days: 21, note: 'ช่วงฝนตก ปูนแห้งช้า' }, { taskId: '1.10', days: 0, note: null },
            { taskId: '1.5', days: 10, note: 'ฝนตกระหว่างบ่ม' }, { taskId: '1.9', days: 3, note: null },
        ], owner, T0);
        expect(await repo.list(ws, p)).toEqual([
            { taskId: '1.5', days: 10, note: 'ฝนตกระหว่างบ่ม' }, { taskId: '1.9', days: 3, note: null },
            { taskId: '1.10', days: 0, note: null }, { taskId: '5.1', days: 21, note: 'ช่วงฝนตก ปูนแห้งช้า' },
        ]);

        // 1.5 unchanged, 5.1 changed (note), 2.4 new, 1.9 / 1.10 left out.
        await repo.replace(ws, p, [
            { taskId: '1.5', days: 10, note: 'ฝนตกระหว่างบ่ม' }, { taskId: '5.1', days: 21, note: null }, { taskId: '2.4', days: 20, note: null },
        ], other, later(60_000));
        expect(await repo.list(ws, p)).toEqual([
            { taskId: '1.5', days: 10, note: 'ฝนตกระหว่างบ่ม' }, { taskId: '2.4', days: 20, note: null }, { taskId: '5.1', days: 21, note: null },
        ]);
        expect(await stamps(ctx, p)).toEqual({
            '1.5': { by: owner, at: T0.toISOString() },
            '2.4': { by: other, at: later(60_000).toISOString() },
            '5.1': { by: other, at: later(60_000).toISOString() },
        });

        await repo.replace(ws, p, [], owner, later(120_000));
        expect(await repo.list(ws, p)).toEqual([]);
        expect(await ctx.db.select().from(projectTaskLags)).toEqual([]);
    });

    it('scoped by workspace: list, listByWorkspace (by project id, only projects with rows), replace and delete', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectTaskLagRepository(ctx);
        const { a, b } = await seedTwoTenants(ctx);
        const a2 = (await seedProject(ctx, a.workspaceId, a.owner)).id;
        const empty = (await seedProject(ctx, a.workspaceId, a.owner)).id;
        await repo.replace(a.workspaceId, a.projectId, [{ taskId: '2.4', days: 21, note: null }], a.owner, T0);
        await repo.replace(a.workspaceId, a2, [{ taskId: '5.1', days: 21, note: null }, { taskId: '1.5', days: 10, note: null }], a.owner, T0);
        await repo.replace(b.workspaceId, b.projectId, [{ taskId: '1.5', days: 1, note: null }], b.owner, T0);

        const board = await repo.listByWorkspace(a.workspaceId);
        expect(board.map(r => r.projectId)).toEqual([a.projectId, a2].sort());
        expect(board.find(r => r.projectId === a2)?.lags.map(l => l.taskId)).toEqual(['1.5', '5.1']);
        expect(board.map(r => r.projectId)).not.toContain(empty);
        expect(await repo.listByWorkspace(b.workspaceId)).toEqual([{ projectId: b.projectId, lags: [{ taskId: '1.5', days: 1, note: null }] }]);

        // Through another workspace: nothing is read, replaced or deleted.
        expect(await repo.list(b.workspaceId, a.projectId)).toEqual([]);
        await repo.deleteByProject(b.workspaceId, a.projectId);
        expect(await repo.list(a.workspaceId, a.projectId)).toHaveLength(1);
        await repo.deleteByProject(a.workspaceId, a.projectId);
        expect(await repo.list(a.workspaceId, a.projectId)).toEqual([]);
        expect(await repo.list(a.workspaceId, a2)).toHaveLength(2);
    });

    it('the composite foreign key and the check constraints back the rules', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectTaskLagRepository(ctx);
        const { a, b } = await seedTwoTenants(ctx);
        // A project of workspace B named under workspace A.
        await expectPgError(repo.replace(a.workspaceId, b.projectId, [{ taskId: '1.5', days: 1, note: null }], a.owner, T0),
            '23503', 'project_task_lags_project_tenant_fk');
        const row = (over: Partial<typeof projectTaskLags.$inferInsert>) => ctx.db.insert(projectTaskLags).values({
            projectId: a.projectId, workspaceId: a.workspaceId, taskId: '1.5', days: 1, updatedBy: a.owner, ...over,
        });
        await expectPgError(row({ days: -1 }), '23514', 'project_task_lags_days_check');
        await expectPgError(row({ days: 91 }), '23514', 'project_task_lags_days_check');
        await expectPgError(row({ taskId: '1.0' }), '23514', 'project_task_lags_task_check');
        await expectPgError(row({ taskId: '1.5x' }), '23514', 'project_task_lags_task_check');
        await expectPgError(row({ note: 'x'.repeat(201) }), '23514', 'project_task_lags_note_check');
        await row({ days: 90, note: 'x'.repeat(200) });
        await expectPgError(row({}), '23505', 'project_task_lags_project_id_task_id_pk');
    });

    it('deleting a project cascades its waits (other projects keep theirs); deleting the workspace removes all', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectTaskLagRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const doomed = (await seedProject(ctx, ws, owner)).id;
        const kept = (await seedProject(ctx, ws, owner)).id;
        await repo.replace(ws, doomed, [{ taskId: '1.5', days: 10, note: null }, { taskId: '5.1', days: 21, note: null }], owner, T0);
        await repo.replace(ws, kept, [{ taskId: '2.4', days: 14, note: null }], owner, T0);

        // PostgreSQL's cascade alone (the use case also deletes them explicitly through ProjectDependents).
        await new DrizzleProjectRepository(ctx).delete(ws, doomed);
        expect(await repo.list(ws, doomed)).toEqual([]);
        expect(await repo.list(ws, kept)).toEqual([{ taskId: '2.4', days: 14, note: null }]);

        await ctx.db.delete(workspaces).where(eq(workspaces.id, ws));
        expect(await ctx.db.select().from(projectTaskLags)).toEqual([]);
    });
});

describeIfDatabase('task lags use cases on PostgreSQL (integration)', db => {
    function useCases(ctx: DatabaseContext) {
        const lags = new DrizzleProjectTaskLagRepository(ctx);
        const access = new WorkforceAccess(
            new RepositoryWorkspaceAccess(new DrizzleMembershipRepository(ctx)),
            new RepositoryProjectStatusLookup(new DrizzleProjectRepository(ctx)),
            new FakeModuleFlags(),
        );
        const uow = new DrizzleUnitOfWork(ctx);
        const clock = new FixedClock(new Date('2026-03-01T08:00:00.000Z'));
        return {
            lags,
            get: new GetProjectTaskLagsUseCase(access, lags),
            put: new PutProjectTaskLagsUseCase(access, lags, new DrizzleWorkforceLock(ctx), uow, clock),
            list: new ListWorkspaceTaskLagsUseCase(access, lags),
        };
    }

    async function archive(ctx: DatabaseContext, workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await ctx.db.update(projects).set({ archivedAt: T0 }).where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));
    }

    it('PUT / GET / workspace list; viewers read only; archived projects refuse writes and leave the list', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const u = useCases(ctx);
        const owner = await seedUser(ctx);
        const viewer = await seedUser(ctx, 'Viewer');
        const ws = await seedWorkspace(ctx, owner);
        await seedMember(ctx, ws, viewer, 'viewer');
        const p = (await seedProject(ctx, ws, owner)).id;
        const old = (await seedProject(ctx, ws, owner)).id;

        const put = must(await u.put.execute({ userId: owner, projectId: p, lags: [{ taskId: '5.1', days: 21, note: ' ช่วงฝนตก ' }, { taskId: '1.5', days: 10 }] }));
        expect(put.lags).toEqual([{ taskId: '1.5', days: 10, note: null }, { taskId: '5.1', days: 21, note: 'ช่วงฝนตก' }]);
        expect(must(await u.get.execute({ userId: viewer, projectId: p })).lags).toEqual(put.lags);
        const denied = await u.put.execute({ userId: viewer, projectId: p, lags: [] });
        expect(!denied.ok && denied.error.code).toBe('forbidden');

        must(await u.put.execute({ userId: owner, projectId: old, lags: [{ taskId: '2.4', days: 14 }] }));
        await archive(ctx, ws, old);
        const refused = await u.put.execute({ userId: owner, projectId: old, lags: [] });
        expect(!refused.ok && refused.error.code).toBe('conflict');
        expect(must(await u.list.execute({ userId: viewer, workspaceId: ws }))).toEqual([{ projectId: p, lags: put.lags }]);

        const stranger = asUserId(randomUUID());
        const hidden = await u.get.execute({ userId: stranger, projectId: p });
        expect(!hidden.ok && hidden.error.code).toBe('not_found');
    });

    it('concurrent replace-alls of one project are serialised by the workforce lock: the result is one of them, never a mix', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const u = useCases(ctx);
        const owner: UserId = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const p = (await seedProject(ctx, ws, owner)).id;
        const sets = [
            [{ taskId: '1.5', days: 10 }, { taskId: '1.6', days: 4 }],
            [{ taskId: '2.1', days: 8 }, { taskId: '2.4', days: 21 }],
            [{ taskId: '5.1', days: 21 }],
        ];
        const results = await Promise.all(sets.map(lags => u.put.execute({ userId: owner, projectId: p, lags })));
        expect(results.every(r => r.ok)).toBe(true);
        const stored = (await u.lags.list(ws, p)).map(l => l.taskId);
        expect(sets.map(s => s.map(l => l.taskId))).toContainEqual(stored);
    });
});
