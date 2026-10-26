import { and, desc, eq } from 'drizzle-orm';
import type { Project as BoqProject } from '@contrack/domain/project';
import {
    asProjectId, asRevisionId, asUserId, asWorkspaceId, type ProjectId, type RevisionId, type WorkspaceId,
} from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { projectRevisions } from '../../../../shared/infrastructure/database/schema';
import { RevisionRepository, type RevisionInsertOutcome } from '../../application/ports/revision.repository';
import { Revision } from '../../domain/entities/revision.entity';

type RevisionRow = typeof projectRevisions.$inferSelect;

function toEntity(row: RevisionRow): Revision {
    return Revision.rehydrate({
        id: asRevisionId(row.id),
        projectId: asProjectId(row.projectId),
        workspaceId: asWorkspaceId(row.workspaceId),
        label: row.label,
        note: row.note,
        // Written by CreateRevision from ProjectAssembler.snapshot (a JSON copy of the assembled Project).
        snapshot: row.snapshot as BoqProject,
        totals: row.totals,
        createdBy: asUserId(row.createdBy),
        createdAt: row.createdAt,
    });
}

export class DrizzleRevisionRepository extends RevisionRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(revision: Revision): Promise<RevisionInsertOutcome> {
        const r = revision.toProps();
        const inserted = await this.ctx.executor.insert(projectRevisions)
            .values({
                id: r.id,
                projectId: r.projectId,
                workspaceId: r.workspaceId,
                label: r.label,
                note: r.note,
                snapshot: r.snapshot,
                totals: { ...r.totals },
                createdBy: r.createdBy,
                createdAt: r.createdAt,
            })
            .onConflictDoNothing({ target: [projectRevisions.projectId, projectRevisions.label] })
            .returning({ id: projectRevisions.id });
        return inserted.length === 1 ? 'inserted' : 'label_taken';
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Revision[]> {
        const rows = await this.ctx.executor.select().from(projectRevisions)
            .where(and(eq(projectRevisions.workspaceId, workspaceId), eq(projectRevisions.projectId, projectId)))
            .orderBy(desc(projectRevisions.createdAt), desc(projectRevisions.id));
        return rows.map(toEntity);
    }

    async find(workspaceId: WorkspaceId, projectId: ProjectId, revisionId: RevisionId): Promise<Revision | undefined> {
        const rows = await this.ctx.executor.select().from(projectRevisions)
            .where(and(
                eq(projectRevisions.workspaceId, workspaceId),
                eq(projectRevisions.projectId, projectId),
                eq(projectRevisions.id, revisionId),
            ))
            .limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await this.ctx.executor.delete(projectRevisions)
            .where(and(eq(projectRevisions.workspaceId, workspaceId), eq(projectRevisions.projectId, projectId)));
    }
}
