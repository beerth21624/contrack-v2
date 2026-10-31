// ─── Shared port ModuleFlags: the four layers (release, entitlement, switch, dependencies), rows cached briefly ───
import { Injectable } from '@nestjs/common';
import type { ModuleId } from '@contrack/contract';
import { ModuleFlags } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { WorkspaceModuleStates } from '../../application/services/workspace-module-states';
import { isActive } from '../../domain/module-activation';

@Injectable()
export class RepositoryModuleFlags extends ModuleFlags {
    constructor(private readonly states: WorkspaceModuleStates) {
        super();
    }

    platformEnabled(module: ModuleId): boolean {
        return this.states.isReleased(module);
    }

    async isEnabled(workspaceId: WorkspaceId, module: ModuleId): Promise<boolean> {
        // Not offered (release 1 for every ERP module): answered without touching the database.
        if (!this.states.isReleased(module)) return false;
        return isActive(await this.states.cachedInputs(workspaceId), module);
    }
}
