// ─── Integration: DrizzleProjectDocRepository — compare-and-set writes under concurrency, null data, tenant scope ───
import type { DocKey } from '@contrack/domain/sync';
import { ProjectDoc } from '../../src/modules/projects/domain/entities/project-doc.entity';
import { DrizzleProjectDocRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-project-doc.repository';
import type { ProjectId, UserId, WorkspaceId } from '../../src/shared/domain/ids';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, seedTwoTenants } from '../support/seed';

function doc(
    workspaceId: WorkspaceId, projectId: ProjectId, updatedBy: UserId, docKey: DocKey, data: unknown, baseVersion: number,
): ProjectDoc {
    return ProjectDoc.write({
        projectId, workspaceId, docKey, data, baseVersion, updatedBy, now: new Date(T0.getTime() + baseVersion * 1000),
    });
}

describeIfDatabase('DrizzleProjectDocRepository (integration)', db => {
    it('inserts at baseVersion 0, updates at the stored version and reads every field back', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectDocRepository(ctx);
        const { a } = await seedTwoTenants(ctx);

        const v1 = doc(a.workspaceId, a.projectId, a.owner, 'calc:fill', { width: 10, length: 12, height: 0.5 }, 0);
        expect(await repo.write(v1, 0)).toBe('written');
        expect((await repo.find(a.workspaceId, a.projectId, 'calc:fill'))?.toProps()).toEqual(v1.toProps());

        const v2 = doc(a.workspaceId, a.projectId, a.owner, 'calc:fill', { width: 20, length: 12, height: 0.5, note: 'ไทย' }, 1);
        expect(await repo.write(v2, 1)).toBe('written');
        const stored = await repo.find(a.workspaceId, a.projectId, 'calc:fill');
        expect(stored?.version).toBe(2);
        expect(stored?.data).toEqual({ width: 20, length: 12, height: 0.5, note: 'ไทย' });
        expect(stored?.updatedAt.toISOString()).toBe(v2.updatedAt.toISOString());

        // Reset: data null is kept as a row, the version keeps growing.
        const v3 = doc(a.workspaceId, a.projectId, a.owner, 'calc:fill', null, 2);
        expect(await repo.write(v3, 2)).toBe('written');
        const reset = await repo.find(a.workspaceId, a.projectId, 'calc:fill');
        expect(reset?.data).toBeNull();
        expect(reset?.isReset).toBe(true);
        expect(reset?.version).toBe(3);
    });

    it('answers conflict for a stale baseVersion and for an insert over an existing document; nothing changes', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectDocRepository(ctx);
        const { a } = await seedTwoTenants(ctx);
        expect(await repo.write(doc(a.workspaceId, a.projectId, a.owner, 'meta', { ownerName: 'A' }, 0), 0)).toBe('written');
        expect(await repo.write(doc(a.workspaceId, a.projectId, a.owner, 'meta', { ownerName: 'B' }, 1), 1)).toBe('written');

        expect(await repo.write(doc(a.workspaceId, a.projectId, a.owner, 'meta', { ownerName: 'stale' }, 1), 1)).toBe('conflict');
        expect(await repo.write(doc(a.workspaceId, a.projectId, a.owner, 'meta', { ownerName: 'new' }, 0), 0)).toBe('conflict');
        expect(await repo.write(doc(a.workspaceId, a.projectId, a.owner, 'calc:fill', {}, 4), 4)).toBe('conflict');

        const stored = await repo.find(a.workspaceId, a.projectId, 'meta');
        expect(stored?.version).toBe(2);
        expect(stored?.data).toEqual({ ownerName: 'B' });
        expect(await repo.find(a.workspaceId, a.projectId, 'calc:fill')).toBeUndefined();
    });

    it('lets exactly one of several concurrent writers on the same version win (insert and update)', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectDocRepository(ctx);
        const { a } = await seedTwoTenants(ctx);

        const inserts = await Promise.all([1, 2, 3, 4].map(n =>
            ctx.transaction(() => repo.write(doc(a.workspaceId, a.projectId, a.owner, 'calc:fill', { width: n }, 0), 0))));
        expect(inserts.filter(r => r === 'written')).toHaveLength(1);

        const updates = await Promise.all([5, 6, 7, 8].map(n =>
            ctx.transaction(() => repo.write(doc(a.workspaceId, a.projectId, a.owner, 'calc:fill', { width: n }, 1), 1))));
        expect(updates.filter(r => r === 'written')).toHaveLength(1);

        const stored = await repo.find(a.workspaceId, a.projectId, 'calc:fill');
        expect(stored?.version).toBe(2);
        const winner = [5, 6, 7, 8][updates.indexOf('written')];
        expect(stored?.data).toEqual({ width: winner });
    });

    it('scopes every read and write by workspace', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectDocRepository(ctx);
        const { a, b } = await seedTwoTenants(ctx);
        expect(await repo.write(doc(a.workspaceId, a.projectId, a.owner, 'meta', { ownerName: 'A' }, 0), 0)).toBe('written');

        expect(await repo.find(b.workspaceId, a.projectId, 'meta')).toBeUndefined();
        expect(await repo.listByProject(b.workspaceId, a.projectId)).toEqual([]);
        // An update naming the wrong tenant matches no row.
        expect(await repo.write(doc(b.workspaceId, a.projectId, b.owner, 'meta', { ownerName: 'B' }, 1), 1)).toBe('conflict');
        await repo.deleteByProject(b.workspaceId, a.projectId);
        expect((await repo.find(a.workspaceId, a.projectId, 'meta'))?.data).toEqual({ ownerName: 'A' });
    });

    it('inserts the first documents of a project together and lists them by key', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectDocRepository(ctx);
        const { a } = await seedTwoTenants(ctx);
        await repo.insertMany([
            doc(a.workspaceId, a.projectId, a.owner, 'meta', { ownerName: 'A' }, 0),
            doc(a.workspaceId, a.projectId, a.owner, 'calc:fill', { width: 1 }, 0),
            doc(a.workspaceId, a.projectId, a.owner, 'journey', { 'project-info': 'done' }, 0),
        ]);
        expect((await repo.listByProject(a.workspaceId, a.projectId)).map(d => [d.docKey, d.version]))
            .toEqual([['calc:fill', 1], ['journey', 1], ['meta', 1]]);
        await repo.deleteByProject(a.workspaceId, a.projectId);
        expect(await repo.listByProject(a.workspaceId, a.projectId)).toEqual([]);
    });
});
