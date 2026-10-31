// ─── Shared port ModuleStatesLookup: every module's four-layer state of a workspace (portal tiles, WP-35) ───
import { Injectable } from '@nestjs/common';
import { ModuleStatesLookup, type ModuleStateInfo } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { WorkspaceModuleStates } from '../../application/services/workspace-module-states';
import { moduleStates } from '../../domain/module-activation';

@Injectable()
export class RepositoryModuleStatesLookup extends ModuleStatesLookup {
    constructor(private readonly states: WorkspaceModuleStates) {
        super();
    }

    async forWorkspace(workspaceId: WorkspaceId): Promise<ModuleStateInfo[]> {
        return moduleStates(this.states.inputsOf(await this.states.load(workspaceId))).map(s => ({
            module: s.module,
            available: s.available,
            active: s.active,
            entitlementStatus: s.entitlementStatus,
            entitlementExpiresAt: s.entitlementExpiresAt,
            trialAvailable: s.trialAvailable,
        }));
    }
}
