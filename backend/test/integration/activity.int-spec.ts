// ─── Integration: DrizzleActivityRepository — growing ids, newest first, `before` cursor, tenant scope ───
import { ActivityEntry } from '../../src/modules/projects/domain/entities/activity-entry.entity';
import { DrizzleActivityRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-activity.repository';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, seedTwoTenants } from '../support/seed';

describeIfDatabase('DrizzleActivityRepository (integration)', db => {
    it('appends entries with growing ids and pages them newest first with a before cursor', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleActivityRepository(ctx);
        const { a, b } = await seedTwoTenants(ctx);

        const appended: ActivityEntry[] = [];
        for (let i = 0; i < 7; i += 1) {
            appended.push(await repo.append(ActivityEntry.record({
                workspaceId: a.workspaceId,
                projectId: a.projectId,
                userId: a.owner,
                action: i === 0 ? 'project.created' : 'doc.updated',
                docKey: i === 0 ? null : 'calc:fill',
                at: new Date(T0.getTime() + i * 1000),
            })));
            // Another tenant writes in between: ids are global, pages must still be per project.
            await repo.append(ActivityEntry.record({
                workspaceId: b.workspaceId, projectId: b.projectId, userId: b.owner, action: 'doc.updated', docKey: 'meta', at: T0,
            }));
        }
        const ids = appended.map(e => e.id);
        for (let i = 1; i < ids.length; i += 1) expect((ids[i] ?? 0n) > (ids[i - 1] ?? 0n)).toBe(true);
        expect(appended[0]).toMatchObject({ action: 'project.created', docKey: null, userId: a.owner });
        expect(appended[1]?.docKey).toBe('calc:fill');

        const newestFirst = [...ids].reverse();
        const page1 = await repo.list(a.workspaceId, a.projectId, { limit: 3 });
        expect(page1.map(e => e.id)).toEqual(newestFirst.slice(0, 3));
        const page2 = await repo.list(a.workspaceId, a.projectId, { limit: 3, before: page1.at(-1)?.id });
        expect(page2.map(e => e.id)).toEqual(newestFirst.slice(3, 6));
        const page3 = await repo.list(a.workspaceId, a.projectId, { limit: 3, before: page2.at(-1)?.id });
        expect(page3.map(e => e.id)).toEqual(newestFirst.slice(6));
        expect(await repo.list(a.workspaceId, a.projectId, { limit: 3, before: page3.at(-1)?.id })).toEqual([]);

        expect(await repo.list(b.workspaceId, a.projectId, { limit: 50 })).toEqual([]);
        expect(await repo.list(b.workspaceId, b.projectId, { limit: 50 })).toHaveLength(7);
    });

    it('deletes the feed of one project only', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleActivityRepository(ctx);
        const { a, b } = await seedTwoTenants(ctx);
        const record = (t: typeof a) => ActivityEntry.record({
            workspaceId: t.workspaceId, projectId: t.projectId, userId: t.owner, action: 'project.created', at: T0,
        });
        await repo.append(record(a));
        await repo.append(record(b));
        await repo.deleteByProject(b.workspaceId, a.projectId); // wrong tenant: nothing
        expect(await repo.list(a.workspaceId, a.projectId, { limit: 10 })).toHaveLength(1);
        await repo.deleteByProject(a.workspaceId, a.projectId);
        expect(await repo.list(a.workspaceId, a.projectId, { limit: 10 })).toEqual([]);
        expect(await repo.list(b.workspaceId, b.projectId, { limit: 10 })).toHaveLength(1);
    });
});
