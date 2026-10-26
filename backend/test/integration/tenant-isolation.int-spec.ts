// ─── Integration: the composite (project_id, workspace_id) foreign keys — a child row cannot name another tenant ───
import { eq } from 'drizzle-orm';
import {
    activityLog, levelAssignments, projectDocs, projectRevisions, projects,
} from '../../src/shared/infrastructure/database/schema';
import { ProjectDoc } from '../../src/modules/projects/domain/entities/project-doc.entity';
import { DrizzleProjectDocRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-project-doc.repository';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, expectPgError, seedTwoTenants } from '../support/seed';

const FOREIGN_KEY_VIOLATION = '23503';
const SUMMARY = { constructionTotal: 0, preConstructionTotal: 0, levelsDone: 0, levelsTotal: 0 };

describeIfDatabase('tenant isolation in the schema (integration)', db => {
    it('rejects a document whose workspace is not its project\'s (project_docs_project_tenant_fk)', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const { a, b } = await seedTwoTenants(ctx);
        await expectPgError(
            ctx.db.insert(projectDocs).values({
                projectId: a.projectId, workspaceId: b.workspaceId, docKey: 'meta', data: {}, version: 1, updatedBy: b.owner, updatedAt: T0,
            }),
            FOREIGN_KEY_VIOLATION, 'project_docs_project_tenant_fk',
        );
        // Through the repository as well.
        const doc = ProjectDoc.write({
            projectId: a.projectId, workspaceId: b.workspaceId, docKey: 'meta', data: {}, baseVersion: 0, updatedBy: b.owner, now: T0,
        });
        await expectPgError(new DrizzleProjectDocRepository(ctx).write(doc, 0), FOREIGN_KEY_VIOLATION, 'project_docs_project_tenant_fk');
    });

    it('rejects a revision, an assignment and an activity entry naming another tenant', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const { a, b } = await seedTwoTenants(ctx);
        await expectPgError(
            ctx.db.insert(projectRevisions).values({
                id: '0f0f0f0f-0000-4000-8000-000000000001', projectId: a.projectId, workspaceId: b.workspaceId, label: 'R1',
                note: null, snapshot: {}, totals: SUMMARY, createdBy: b.owner, createdAt: T0,
            }),
            FOREIGN_KEY_VIOLATION, 'project_revisions_project_tenant_fk',
        );
        await expectPgError(
            ctx.db.insert(levelAssignments).values({
                projectId: a.projectId, workspaceId: b.workspaceId, levelId: 'project-info', userId: b.owner, assignedBy: b.owner, assignedAt: T0,
            }),
            FOREIGN_KEY_VIOLATION, 'level_assignments_project_tenant_fk',
        );
        await expectPgError(
            ctx.db.insert(activityLog).values({
                workspaceId: b.workspaceId, projectId: a.projectId, userId: b.owner, action: 'doc.updated', docKey: 'meta', at: T0,
            }),
            FOREIGN_KEY_VIOLATION, 'activity_log_project_tenant_fk',
        );
    });

    it('accepts the same rows with the project\'s own workspace, and cascades them away with the project', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const { a } = await seedTwoTenants(ctx);
        await ctx.db.insert(projectDocs).values({
            projectId: a.projectId, workspaceId: a.workspaceId, docKey: 'meta', data: {}, version: 1, updatedBy: a.owner, updatedAt: T0,
        });
        await ctx.db.insert(activityLog).values({
            workspaceId: a.workspaceId, projectId: a.projectId, userId: a.owner, action: 'doc.updated', docKey: 'meta', at: T0,
        });
        await ctx.db.delete(projects).where(eq(projects.id, a.projectId));
        expect(await ctx.db.select().from(projectDocs)).toEqual([]);
        expect(await ctx.db.select().from(activityLog)).toEqual([]);
    });
});
