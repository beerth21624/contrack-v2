import { and, asc, eq } from 'drizzle-orm';
import { isDocKey } from '@contrack/domain/sync';
import { asProjectId, asUserId, asWorkspaceId, type ProjectId, type WorkspaceId } from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { projectDocs } from '../../../../shared/infrastructure/database/schema';
import { ProjectDocRepository, type DocWriteOutcome } from '../../application/ports/project-doc.repository';
import { ProjectDoc } from '../../domain/entities/project-doc.entity';

type DocRow = typeof projectDocs.$inferSelect;

/** Rows insert in chunks so one statement stays well below PostgreSQL's 65535 bind parameters. */
const INSERT_CHUNK = 500;

function toEntity(row: DocRow): ProjectDoc {
    const docKey = row.docKey;
    if (!isDocKey(docKey)) throw new Error(`project ${row.projectId} has a stored document with unknown key "${docKey}"`);
    return ProjectDoc.rehydrate({
        projectId: asProjectId(row.projectId),
        workspaceId: asWorkspaceId(row.workspaceId),
        docKey,
        data: row.data ?? null,
        version: row.version,
        updatedBy: asUserId(row.updatedBy),
        updatedAt: row.updatedAt,
    });
}

function toRow(doc: ProjectDoc): DocRow {
    const d = doc.toProps();
    return {
        projectId: d.projectId,
        workspaceId: d.workspaceId,
        docKey: d.docKey,
        data: d.data ?? null,
        version: d.version,
        updatedBy: d.updatedBy,
        updatedAt: d.updatedAt,
    };
}

export class DrizzleProjectDocRepository extends ProjectDocRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<ProjectDoc[]> {
        const rows = await this.ctx.executor.select().from(projectDocs)
            .where(and(eq(projectDocs.workspaceId, workspaceId), eq(projectDocs.projectId, projectId)))
            .orderBy(asc(projectDocs.docKey));
        return rows.map(toEntity);
    }

    async find(workspaceId: WorkspaceId, projectId: ProjectId, docKey: string): Promise<ProjectDoc | undefined> {
        const rows = await this.ctx.executor.select().from(projectDocs)
            .where(and(
                eq(projectDocs.workspaceId, workspaceId),
                eq(projectDocs.projectId, projectId),
                eq(projectDocs.docKey, docKey),
            ))
            .limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async write(doc: ProjectDoc, baseVersion: number): Promise<DocWriteOutcome> {
        if (doc.version !== baseVersion + 1) {
            throw new Error(`doc version ${doc.version} must be baseVersion + 1 (${baseVersion + 1})`);
        }
        const row = toRow(doc);
        if (baseVersion === 0) {
            const inserted = await this.ctx.executor.insert(projectDocs).values(row)
                .onConflictDoNothing({ target: [projectDocs.projectId, projectDocs.docKey] })
                .returning({ version: projectDocs.version });
            return inserted.length === 1 ? 'written' : 'conflict';
        }
        const updated = await this.ctx.executor.update(projectDocs)
            .set({ data: row.data, version: row.version, updatedBy: row.updatedBy, updatedAt: row.updatedAt })
            .where(and(
                eq(projectDocs.workspaceId, row.workspaceId),
                eq(projectDocs.projectId, row.projectId),
                eq(projectDocs.docKey, row.docKey),
                eq(projectDocs.version, baseVersion),
            ))
            .returning({ version: projectDocs.version });
        return updated.length === 1 ? 'written' : 'conflict';
    }

    async insertMany(docs: readonly ProjectDoc[]): Promise<void> {
        for (const d of docs) if (d.version !== 1) throw new Error('a new document starts at version 1');
        const rows = docs.map(toRow);
        for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
            await this.ctx.executor.insert(projectDocs).values(rows.slice(i, i + INSERT_CHUNK));
        }
    }

    async deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await this.ctx.executor.delete(projectDocs)
            .where(and(eq(projectDocs.workspaceId, workspaceId), eq(projectDocs.projectId, projectId)));
    }
}
