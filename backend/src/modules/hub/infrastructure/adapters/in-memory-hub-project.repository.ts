import type { HubProjectFields } from '@contrack/contract';
import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import { DEFAULT_HUB_FIELDS, HubProjectRepository } from '../../application/ports/hub-project.repository';

/**
 * Memory adapter (tests / trying without a database). The project rows live in the projects module's own memory
 * adapter, so this keeps only the hub columns per project; a project never written here reads as the defaults.
 */
export class InMemoryHubProjectRepository extends HubProjectRepository {
    private readonly rows = new Map<ProjectId, { workspaceId: WorkspaceId; fields: HubProjectFields }>();

    private read(workspaceId: WorkspaceId, projectId: ProjectId): HubProjectFields {
        const row = this.rows.get(projectId);
        return structuredClone(row?.workspaceId === workspaceId ? row.fields : DEFAULT_HUB_FIELDS);
    }

    findMany(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, HubProjectFields>> {
        return Promise.resolve(new Map(projectIds.map(id => [id, this.read(workspaceId, id)])));
    }

    find(workspaceId: WorkspaceId, projectId: ProjectId): Promise<HubProjectFields | undefined> {
        return Promise.resolve(this.read(workspaceId, projectId));
    }

    lockForUpdate(workspaceId: WorkspaceId, projectId: ProjectId): Promise<HubProjectFields | undefined> {
        return this.find(workspaceId, projectId);
    }

    save(workspaceId: WorkspaceId, projectId: ProjectId, fields: HubProjectFields): Promise<void> {
        if (fields.code !== null) {
            for (const [id, row] of this.rows) {
                if (id !== projectId && row.workspaceId === workspaceId && row.fields.code === fields.code) {
                    return Promise.reject(new Error(`duplicate key value violates unique constraint "projects_workspace_code_key"`));
                }
            }
        }
        this.rows.set(projectId, { workspaceId, fields: structuredClone(fields) });
        return Promise.resolve();
    }

    codeTaken(workspaceId: WorkspaceId, code: string, exceptProjectId: ProjectId): Promise<boolean> {
        return Promise.resolve([...this.rows].some(([id, row]) => id !== exceptProjectId && row.workspaceId === workspaceId && row.fields.code === code));
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        if (this.rows.get(projectId)?.workspaceId === workspaceId) this.rows.delete(projectId);
        return Promise.resolve();
    }
}
