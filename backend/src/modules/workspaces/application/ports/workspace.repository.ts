import type { WorkspaceId } from '../../../../shared/domain/ids';
import type { Workspace } from '../../domain/entities/workspace.entity';

/** Workspaces (tenant rows). Joins the UnitOfWork transaction when called inside `uow.run`. */
export abstract class WorkspaceRepository {
    abstract findById(id: WorkspaceId): Promise<Workspace | undefined>;
    abstract findMany(ids: readonly WorkspaceId[]): Promise<Workspace[]>;
    abstract insert(workspace: Workspace): Promise<void>;
    /** Persists the mutable fields (name). */
    abstract update(workspace: Workspace): Promise<void>;
    abstract delete(id: WorkspaceId): Promise<void>;
}
