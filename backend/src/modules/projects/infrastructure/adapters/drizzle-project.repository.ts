import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { asProjectId, asUserId, asWorkspaceId, type ProjectId, type WorkspaceId } from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { projects } from '../../../../shared/infrastructure/database/schema';
import { ProjectRepository, type ListProjectsFilter } from '../../application/ports/project.repository';
import { ENGINE_VERSION, Project } from '../../domain/entities/project.entity';
import { ProjectName } from '../../domain/value-objects/project-name.value-object';

type ProjectRow = typeof projects.$inferSelect;
/** Only the release-1 columns: the Project Hub columns keep their defaults (written by the hub module alone). */
type ProjectInsertRow = typeof projects.$inferInsert;

function toEntity(row: ProjectRow): Project {
    if (row.engineVersion !== ENGINE_VERSION) {
        // A project computed by another engine would show other totals: never serve it silently.
        throw new Error(`project ${row.id} uses engine "${row.engineVersion}", this server runs "${ENGINE_VERSION}"`);
    }
    const name = ProjectName.create(row.name);
    if (!name.ok) throw new Error(`project ${row.id} has an invalid stored name`);
    return Project.rehydrate({
        id: asProjectId(row.id),
        workspaceId: asWorkspaceId(row.workspaceId),
        name: name.value,
        start: row.start,
        engineVersion: ENGINE_VERSION,
        schemaVersion: row.schemaVersion,
        summary: row.summary,
        createdBy: asUserId(row.createdBy),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        archivedAt: row.archivedAt,
    });
}

function toRow(project: Project): ProjectInsertRow & { id: string; workspaceId: string } {
    const p = project.toProps();
    return {
        id: p.id,
        workspaceId: p.workspaceId,
        name: p.name.value,
        start: p.start,
        engineVersion: p.engineVersion,
        schemaVersion: p.schemaVersion,
        summary: { ...p.summary },
        createdBy: p.createdBy,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        archivedAt: p.archivedAt,
    };
}

export class DrizzleProjectRepository extends ProjectRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(project: Project): Promise<void> {
        await this.ctx.executor.insert(projects).values(toRow(project));
    }

    async findInWorkspace(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Project | undefined> {
        const rows = await this.ctx.executor.select().from(projects)
            .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
            .limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async findById(projectId: ProjectId): Promise<Project | undefined> {
        const rows = await this.ctx.executor.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async listByWorkspace(workspaceId: WorkspaceId, filter: ListProjectsFilter): Promise<Project[]> {
        const rows = await this.ctx.executor.select().from(projects)
            .where(and(
                eq(projects.workspaceId, workspaceId),
                filter.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt),
            ))
            .orderBy(desc(projects.updatedAt), desc(projects.createdAt), desc(projects.id));
        return rows.map(toEntity);
    }

    async update(project: Project): Promise<void> {
        const row = toRow(project);
        await this.ctx.executor.update(projects)
            .set({
                name: row.name,
                summary: row.summary,
                schemaVersion: row.schemaVersion,
                updatedAt: row.updatedAt,
                archivedAt: row.archivedAt,
            })
            .where(and(eq(projects.workspaceId, row.workspaceId), eq(projects.id, row.id)));
    }

    async delete(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await this.ctx.executor.delete(projects)
            .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)));
    }

    async lockForUpdate(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Project | undefined> {
        const rows = await this.ctx.executor.select().from(projects)
            .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
            .for('update');
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }
}
