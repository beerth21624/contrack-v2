import type { ModuleId } from '@contrack/contract';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import type { WorkspaceModule } from '../../domain/entities/workspace-module.entity';

/** Module switches of workspaces (no row = never switched = off). Every query is keyed by the workspace. */
export abstract class WorkspaceModuleRepository {
    abstract find(workspaceId: WorkspaceId, module: ModuleId): Promise<WorkspaceModule | undefined>;
    abstract listByWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceModule[]>;
    /** Inserts or replaces the row of (workspace, module). */
    abstract save(entry: WorkspaceModule): Promise<void>;
}
