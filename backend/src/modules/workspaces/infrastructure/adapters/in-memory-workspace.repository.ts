import type { WorkspaceId } from '../../../../shared/domain/ids';
import { WorkspaceRepository } from '../../application/ports/workspace.repository';
import { Workspace, type WorkspaceProps } from '../../domain/entities/workspace.entity';

/** Map-based; stores snapshots so callers never share an entity instance with the store. */
export class InMemoryWorkspaceRepository extends WorkspaceRepository {
    private readonly rows = new Map<WorkspaceId, WorkspaceProps>();

    findById(id: WorkspaceId): Promise<Workspace | undefined> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined ? undefined : Workspace.rehydrate(row));
    }

    findMany(ids: readonly WorkspaceId[]): Promise<Workspace[]> {
        const found: Workspace[] = [];
        for (const id of new Set(ids)) {
            const row = this.rows.get(id);
            if (row !== undefined) found.push(Workspace.rehydrate(row));
        }
        return Promise.resolve(found);
    }

    insert(workspace: Workspace): Promise<void> {
        if (this.rows.has(workspace.id)) return Promise.reject(new Error(`workspace ${workspace.id} already exists`));
        this.rows.set(workspace.id, workspace.toProps());
        return Promise.resolve();
    }

    update(workspace: Workspace): Promise<void> {
        if (this.rows.has(workspace.id)) this.rows.set(workspace.id, workspace.toProps());
        return Promise.resolve();
    }

    delete(id: WorkspaceId): Promise<void> {
        this.rows.delete(id);
        return Promise.resolve();
    }
}
