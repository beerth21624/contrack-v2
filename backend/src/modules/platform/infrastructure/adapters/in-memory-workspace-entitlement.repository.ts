import type { ModuleId } from '@contrack/contract';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { WorkspaceEntitlementRepository } from '../../application/ports/workspace-entitlement.repository';
import { WorkspaceEntitlement, type WorkspaceEntitlementProps } from '../../domain/entities/workspace-entitlement.entity';

/** Map-based; stores snapshots. */
export class InMemoryWorkspaceEntitlementRepository extends WorkspaceEntitlementRepository {
    private readonly rows = new Map<string, WorkspaceEntitlementProps>();

    find(workspaceId: WorkspaceId, module: ModuleId): Promise<WorkspaceEntitlement | undefined> {
        const row = this.rows.get(`${workspaceId}|${module}`);
        return Promise.resolve(row === undefined ? undefined : WorkspaceEntitlement.rehydrate(row));
    }

    listByWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceEntitlement[]> {
        return Promise.resolve([...this.rows.values()].filter(r => r.workspaceId === workspaceId).map(r => WorkspaceEntitlement.rehydrate(r)));
    }

    save(entry: WorkspaceEntitlement): Promise<void> {
        this.rows.set(`${entry.workspaceId}|${entry.module}`, entry.toProps());
        return Promise.resolve();
    }
}
