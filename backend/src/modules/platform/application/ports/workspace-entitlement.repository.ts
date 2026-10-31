import type { ModuleId } from '@contrack/contract';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import type { WorkspaceEntitlement } from '../../domain/entities/workspace-entitlement.entity';

/** Module entitlements of workspaces (no row = never granted). Every query is keyed by the workspace. */
export abstract class WorkspaceEntitlementRepository {
    abstract find(workspaceId: WorkspaceId, module: ModuleId): Promise<WorkspaceEntitlement | undefined>;
    abstract listByWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceEntitlement[]>;
    /** Inserts or replaces the row of (workspace, module). */
    abstract save(entry: WorkspaceEntitlement): Promise<void>;
}
