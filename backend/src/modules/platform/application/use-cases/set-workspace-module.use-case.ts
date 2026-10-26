import { Injectable } from '@nestjs/common';
import type { ModuleId } from '@contrack/contract';
import { Clock, ModuleUsage, WorkspaceAccess } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { WorkspaceModule } from '../../domain/entities/workspace-module.entity';
import { PlatformSettings } from '../ports/platform-settings.port';
import { WorkspaceModuleRepository } from '../ports/workspace-module.repository';
import { ModuleFlagCache } from '../services/module-flag-cache';
import { type WorkspaceModuleView, toWorkspaceModuleView } from './workspace-module.view';

export interface SetWorkspaceModuleInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    module: ModuleId;
    enabled: boolean;
    /** Needed to switch off while the module still has running work. */
    confirm?: boolean;
}

/**
 * Owner / admin (`modules.manage`) switch a module on or off. Only modules the platform offers (else 422).
 * Switching off while contracts are running needs `confirm` (else 409 with the count). Switching off keeps every row
 * of the module: its routes answer module_disabled and its UI disappears until it is switched on again.
 */
@Injectable()
export class SetWorkspaceModuleUseCase {
    constructor(
        private readonly access: WorkspaceAccess,
        private readonly modules: WorkspaceModuleRepository,
        private readonly usage: ModuleUsage,
        private readonly settings: PlatformSettings,
        private readonly cache: ModuleFlagCache,
        private readonly clock: Clock,
    ) {}

    async execute(input: SetWorkspaceModuleInput): Promise<Result<WorkspaceModuleView, DomainError>> {
        const role = await this.access.roleOf(input.actorId, input.workspaceId);
        if (role === undefined) return err(DomainError.notFound('Workspace'));
        if (!can(role, 'modules.manage')) return err(DomainError.forbidden());
        if (!this.settings.modulesEnabled.includes(input.module)) {
            return err(DomainError.unprocessable('This module is not offered on this server', { module: input.module }));
        }
        const entry = await this.modules.find(input.workspaceId, input.module)
            ?? WorkspaceModule.initial(input.workspaceId, input.module);
        if (entry.enabled && !input.enabled && input.confirm !== true) {
            const { activeSubcontracts } = await this.usage.activeWork(input.workspaceId, input.module);
            if (activeSubcontracts > 0) {
                return err(DomainError.conflict('The module still has running work; confirm to switch it off', { activeSubcontracts }));
            }
        }
        if (entry.enabled !== input.enabled) {
            entry.switch(input.enabled, input.actorId, this.clock.now());
            await this.modules.save(entry);
        }
        this.cache.set(input.workspaceId, input.module, entry.enabled);
        return ok(toWorkspaceModuleView(entry, true));
    }
}
