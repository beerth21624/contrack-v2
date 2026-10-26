import type { ModuleId } from '@contrack/contract';
import type { WorkspaceModule } from '../../domain/entities/workspace-module.entity';

/** One module as a workspace sees it (mapped to WorkspaceModuleDto at the edge). */
export interface WorkspaceModuleView {
    module: ModuleId;
    /** The platform offers it. */
    available: boolean;
    enabled: boolean;
    enabledAt: Date | null;
}

export function toWorkspaceModuleView(entry: WorkspaceModule, available: boolean): WorkspaceModuleView {
    const enabled = available && entry.enabled;
    return { module: entry.module, available, enabled, enabledAt: enabled ? entry.enabledAt : null };
}
