// ─── Integration: DrizzleProjectRepository (tenant scope, ordering, lockForUpdate) and PutDoc under concurrency ───
import { eq } from 'drizzle-orm';
import { type DocEntry, docsToProject, projectSummary } from '@contrack/domain/sync';
import { ProjectAccess } from '../../src/modules/projects/application/project-access';
import { ProjectEvents } from '../../src/modules/projects/application/project-events';
import type { ProjectDoc } from '../../src/modules/projects/domain/entities/project-doc.entity';
import { PutDocUseCase } from '../../src/modules/projects/application/use-cases/put-doc.use-case';
import { ProjectAssembler } from '../../src/modules/projects/domain/services/project-assembler.service';
import { ProjectName } from '../../src/modules/projects/domain/value-objects/project-name.value-object';
import { DrizzleActivityRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-activity.repository';
import { DrizzleProjectDocRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-project-doc.repository';
import { DrizzleProjectRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-project.repository';
import { FakeRealtimePublisher, SAMPLE_DOCS } from '../../src/modules/projects/testing/projects-test-kit';
import { DrizzleMembershipRepository } from '../../src/modules/workspaces/infrastructure/adapters/drizzle-membership.repository';
import { RepositoryWorkspaceAccess } from '../../src/modules/workspaces/infrastructure/adapters/workspace-access.adapter';
import type { ProjectId, WorkspaceId } from '../../src/shared/domain/ids';
import { type DatabaseContext, DrizzleUnitOfWork } from '../../src/shared/infrastructure/database/database';
import { projects } from '../../src/shared/infrastructure/database/schema';
import { FixedClock } from '../../src/shared/infrastructure/system';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, errorCodes, gate, must, seedMember, seedProject, seedUser, seedWorkspace, sleep } from '../support/seed';

/** Reads the documents slowly, so two writers that were not serialised would both compute from the same stale list. */
class SlowListDocRepository extends DrizzleProjectDocRepository {
    override async listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<ProjectDoc[]> {
        const docs = await super.listByProject(workspaceId, projectId);
        await sleep(150);
        return docs;
    }
}

function putDocUseCase(ctx: DatabaseContext, publisher = new FakeRealtimePublisher()): PutDocUseCase {
    const projectRepo = new DrizzleProjectRepository(ctx);
    const access = new ProjectAccess(new RepositoryWorkspaceAccess(new DrizzleMembershipRepository(ctx)), projectRepo);
    return new PutDocUseCase(
        access, projectRepo, new SlowListDocRepository(ctx), new DrizzleActivityRepository(ctx), new ProjectAssembler(),
        new ProjectEvents(publisher), new DrizzleUnitOfWork(ctx), new FixedClock(T0),
    );
}

describeIfDatabase('DrizzleProjectRepository (integration)', db => {
    it('finds a project in its own workspace only; findById is the one unscoped lookup', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectRepository(ctx);
        const owner = await seedUser(ctx);
        const wsA = await seedWorkspace(ctx, owner);
        const wsB = await seedWorkspace(ctx, owner);
        const project = await seedProject(ctx, wsA, owner, { name: 'บ้านคุณสมชาย' });

        const found = await repo.findInWorkspace(wsA, project.id);
        expect(found?.toProps()).toEqual(project.toProps());
        expect(await repo.findInWorkspace(wsB, project.id)).toBeUndefined();
        expect((await repo.findById(project.id))?.workspaceId).toBe(wsA);
        expect(await repo.lockForUpdate(wsB, project.id)).toBeUndefined();
    });

    it('lists active or archived projects of a workspace, newest update first; update and delete are scoped', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const other = await seedWorkspace(ctx, owner);
        const old = await seedProject(ctx, ws, owner, { name: 'Old', now: T0 });
        const recent = await seedProject(ctx, ws, owner, { name: 'Recent', now: new Date(T0.getTime() + 60_000) });
        const archived = await seedProject(ctx, ws, owner, { name: 'Archived' });
        const foreign = await seedProject(ctx, other, owner, { name: 'Foreign' });
        archived.archive(new Date(T0.getTime() + 1000));
        await repo.update(archived);

        expect((await repo.listByWorkspace(ws, { archived: false })).map(p => p.name.value)).toEqual(['Recent', 'Old']);
        expect((await repo.listByWorkspace(ws, { archived: true })).map(p => p.id)).toEqual([archived.id]);

        old.rename(must(ProjectName.create('Old renamed')), new Date(T0.getTime() + 120_000));
        await repo.update(old);
        expect((await repo.listByWorkspace(ws, { archived: false })).map(p => p.name.value)).toEqual(['Old renamed', 'Recent']);

        await repo.delete(other, recent.id); // wrong tenant: nothing happens
        expect(await repo.findById(recent.id)).toBeDefined();
        await repo.delete(ws, recent.id);
        expect(await repo.findById(recent.id)).toBeUndefined();
        expect(await repo.findById(foreign.id)).toBeDefined();
    });

    it('refuses to serve a project computed by another engine', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const project = await seedProject(ctx, ws, owner);
        await ctx.db.update(projects).set({ engineVersion: 'excel-v4' }).where(eq(projects.id, project.id));
        await expect(repo.findById(project.id)).rejects.toThrow('engine');
    });

    it('lockForUpdate holds the row until the transaction ends', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleProjectRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const project = await seedProject(ctx, ws, owner);

        const locked = gate();
        const release = gate();
        const order: string[] = [];
        const first = ctx.transaction(async () => {
            await repo.lockForUpdate(ws, project.id);
            order.push('first locked');
            locked.open();
            await release.promise;
            order.push('first done');
        });
        await locked.promise;
        const second = ctx.transaction(async () => {
            await repo.lockForUpdate(ws, project.id);
            order.push('second locked');
        });
        await sleep(200);
        expect(order).toEqual(['first locked']);
        release.open();
        await Promise.all([first, second]);
        expect(order).toEqual(['first locked', 'first done', 'second locked']);
    });

    it('serialises two concurrent PutDoc on one project: both commit and the summary includes both documents', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const owner = await seedUser(ctx, 'Owner');
        const editor = await seedUser(ctx, 'Editor');
        const ws = await seedWorkspace(ctx, owner);
        await seedMember(ctx, ws, editor, 'estimator');
        const project = await seedProject(ctx, ws, owner, { start: 'sample' });
        const publisher = new FakeRealtimePublisher();
        const putDoc = putDocUseCase(ctx, publisher);

        const results = await Promise.all([
            putDoc.execute({ userId: owner, projectId: project.id, docKey: 'calc:fill', data: SAMPLE_DOCS.fill.data, baseVersion: 0 }),
            putDoc.execute({ userId: editor, projectId: project.id, docKey: 'boq:R13', data: SAMPLE_DOCS.r13.data, baseVersion: 0 }),
        ]);
        expect(results.map(r => r.ok)).toEqual([true, true]);

        const both: DocEntry[] = [
            { docKey: 'calc:fill', data: SAMPLE_DOCS.fill.data },
            { docKey: 'boq:R13', data: SAMPLE_DOCS.r13.data },
        ];
        const expected = projectSummary(docsToProject('sample', both));
        const onlyOne = projectSummary(docsToProject('sample', both.slice(1)));
        expect(expected.constructionTotal).not.toBe(onlyOne.constructionTotal); // the check below can tell them apart

        const stored = await new DrizzleProjectRepository(ctx).findById(project.id);
        expect(stored?.summary).toEqual(expected);
        const docs = await new DrizzleProjectDocRepository(ctx).listByProject(ws, project.id);
        expect(docs.map(d => [d.docKey, d.version])).toEqual([['boq:R13', 1], ['calc:fill', 1]]);
        // Realtime only after COMMIT, once per write.
        expect(publisher.events.filter(e => e.type === 'doc.updated')).toHaveLength(2);
    });

    it('PutDoc on the same document from two writers with the same baseVersion: one wins, one gets version_conflict', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const owner = await seedUser(ctx, 'Owner');
        const ws = await seedWorkspace(ctx, owner);
        const project = await seedProject(ctx, ws, owner, { start: 'sample' });
        const putDoc = putDocUseCase(ctx);

        const results = await Promise.all([
            putDoc.execute({ userId: owner, projectId: project.id, docKey: 'calc:fill', data: { width: 1, length: 1, height: 1 }, baseVersion: 0 }),
            putDoc.execute({ userId: owner, projectId: project.id, docKey: 'calc:fill', data: { width: 2, length: 2, height: 2 }, baseVersion: 0 }),
        ]);
        expect(results.filter(r => r.ok)).toHaveLength(1);
        expect(errorCodes(results)).toEqual(['version_conflict']);

        const won = results.flatMap(r => (r.ok ? [r.value.doc.data] : []));
        const doc = await new DrizzleProjectDocRepository(ctx).find(ws, project.id, 'calc:fill');
        expect(doc?.version).toBe(1);
        expect([doc?.data]).toEqual(won);
        const stored = await new DrizzleProjectRepository(ctx).findById(project.id);
        expect(stored?.summary).toEqual(projectSummary(docsToProject('sample', [{ docKey: 'calc:fill', data: doc?.data }])));
    });
});
