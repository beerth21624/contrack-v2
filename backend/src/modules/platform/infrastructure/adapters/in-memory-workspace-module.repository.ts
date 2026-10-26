import type { ModuleId } from '@contrack/contract';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { WorkspaceModuleRepository } from '../../application/ports/workspace-module.repository';
import { WorkspaceModule, type WorkspaceModuleProps } from '../../domain/entities/workspace-module.entity';

/** Map-based; stores snapshots. */
export class InMemoryWorkspaceModuleRepository extends WorkspaceModuleRepository {
    private readonly rows = new Map<string, WorkspaceModuleProps>();

    find(workspaceId: WorkspaceId, module: ModuleId): Promise<WorkspaceModule | undefined> {
        const row = this.rows.get(`${workspaceId}|${module}`);
        return Promise.resolve(row === undefined ? undefined : WorkspaceModule.rehydrate(row));
    }

    listByWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceModule[]> {
        return Promise.resolve([...this.rows.values()].filter(r => r.workspaceId === workspaceId).map(r => WorkspaceModule.rehydrate(r)));
    }

    save(entry: WorkspaceModule): Promise<void> {
        this.rows.set(`${entry.workspaceId}|${entry.module}`, entry.toProps());
        return Promise.resolve();
    }
}
