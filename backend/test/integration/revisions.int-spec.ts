// ─── Integration: DrizzleRevisionRepository — unique label per project, snapshot round trip, tenant scope ───
import { randomUUID } from 'node:crypto';
import { computeProject, createProject } from '@contrack/domain/project';
import { projectSummary } from '@contrack/domain/sync';
import { Revision } from '../../src/modules/projects/domain/entities/revision.entity';
import { RevisionLabel } from '../../src/modules/projects/domain/value-objects/revision-label.value-object';
import { DrizzleRevisionRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-revision.repository';
import { type ProjectId, type UserId, type WorkspaceId, asRevisionId } from '../../src/shared/domain/ids';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, must, seedProject, seedTwoTenants } from '../support/seed';

function revision(workspaceId: WorkspaceId, projectId: ProjectId, createdBy: UserId, label: string, at = T0): Revision {
    const snapshot = { ...createProject('sample'), calculators: { fill: { width: 10, length: 12, height: 0.5 } } };
    return Revision.create({
        id: asRevisionId(randomUUID()),
        projectId,
        workspaceId,
        label: must(RevisionLabel.create(label)),
        note: label === 'R1' ? 'first issue' : null,
        snapshot,
        totals: projectSummary(snapshot),
        createdBy,
        now: at,
    });
}

describeIfDatabase('DrizzleRevisionRepository (integration)', db => {
    it('stores a revision with its snapshot and totals and reads it back', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleRevisionRepository(ctx);
        const { a } = await seedTwoTenants(ctx);
        const r1 = revision(a.workspaceId, a.projectId, a.owner, 'R1');
        expect(await repo.insert(r1)).toBe('inserted');

        const found = await repo.find(a.workspaceId, a.projectId, r1.id);
        expect(found?.toProps()).toEqual(r1.toProps());
        expect(found !== undefined && computeProject(found.snapshot).boq.constructionTotal).toBe(r1.totals.constructionTotal);
    });

    it('refuses a second revision with the same label in the same project (label_taken), not in another project', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleRevisionRepository(ctx);
        const { a } = await seedTwoTenants(ctx);
        const sibling = await seedProject(ctx, a.workspaceId, a.owner, { name: 'Sibling' });

        expect(await repo.insert(revision(a.workspaceId, a.projectId, a.owner, 'R1'))).toBe('inserted');
        expect(await repo.insert(revision(a.workspaceId, a.projectId, a.owner, 'R1'))).toBe('label_taken');
        expect(await repo.insert(revision(a.workspaceId, sibling.id, a.owner, 'R1'))).toBe('inserted');
        expect(await repo.listByProject(a.workspaceId, a.projectId)).toHaveLength(1);
    });

    it('lets exactly one of two concurrent revisions with the same label in', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleRevisionRepository(ctx);
        const { a } = await seedTwoTenants(ctx);
        const results = await Promise.all([
            ctx.transaction(() => repo.insert(revision(a.workspaceId, a.projectId, a.owner, 'Tender'))),
            ctx.transaction(() => repo.insert(revision(a.workspaceId, a.projectId, a.owner, 'Tender'))),
        ]);
        expect(results.sort()).toEqual(['inserted', 'label_taken']);
    });

    it('lists newest first and scopes every read by workspace', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleRevisionRepository(ctx);
        const { a, b } = await seedTwoTenants(ctx);
        const r1 = revision(a.workspaceId, a.projectId, a.owner, 'R1', T0);
        const r2 = revision(a.workspaceId, a.projectId, a.owner, 'R2', new Date(T0.getTime() + 1000));
        await repo.insert(r1);
        await repo.insert(r2);

        expect((await repo.listByProject(a.workspaceId, a.projectId)).map(r => r.label)).toEqual(['R2', 'R1']);
        expect(await repo.listByProject(b.workspaceId, a.projectId)).toEqual([]);
        expect(await repo.find(b.workspaceId, a.projectId, r1.id)).toBeUndefined();

        await repo.deleteByProject(b.workspaceId, a.projectId);
        expect(await repo.listByProject(a.workspaceId, a.projectId)).toHaveLength(2);
        await repo.deleteByProject(a.workspaceId, a.projectId);
        expect(await repo.listByProject(a.workspaceId, a.projectId)).toEqual([]);
    });
});
