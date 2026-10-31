import type { EntitlementStatus, ModuleId } from '@contrack/contract';
import type { WorkspaceModule } from '../../domain/entities/workspace-module.entity';
import type { ModuleState } from '../../domain/module-activation';

/** One module as a workspace sees it (mapped to WorkspaceModuleDto at the edge). */
export interface WorkspaceModuleView {
    module: ModuleId;
    /** The platform offers it. */
    available: boolean;
    enabled: boolean;
    enabledAt: Date | null;
    entitlement: { status: EntitlementStatus; expiresAt: Date | null };
    active: boolean;
    missingDependencies: ModuleId[];
    trialAvailable: boolean;
}

/** `entry` = the workspace's switch row (or WorkspaceModule.initial), `state` = its four-layer state. */
export function toWorkspaceModuleView(entry: WorkspaceModule, state: ModuleState): WorkspaceModuleView {
    return {
        module: state.module,
        available: state.available,
        enabled: state.enabled,
        enabledAt: state.enabled ? entry.enabledAt : null,
        entitlement: { status: state.entitlementStatus, expiresAt: state.entitlementExpiresAt },
        active: state.active,
        missingDependencies: state.missingDependencies,
        trialAvailable: state.trialAvailable,
    };
}
