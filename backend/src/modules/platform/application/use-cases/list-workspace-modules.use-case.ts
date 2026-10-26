import { Injectable } from '@nestjs/common';
import { MODULE_IDS } from '@contrack/contract';
import { WorkspaceAccess } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { WorkspaceModule } from '../../domain/entities/workspace-module.entity';
import { PlatformSettings } from '../ports/platform-settings.port';
import { WorkspaceModuleRepository } from '../ports/workspace-module.repository';
import { type WorkspaceModuleView, toWorkspaceModuleView } from './workspace-module.view';

export interface ListWorkspaceModulesInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
}

/** Every module id (MODULE_IDS order) with whether the platform offers it and whether this workspace switched it on. */
@Injectable()
export class ListWorkspaceModulesUseCase {
    constructor(
        private readonly access: WorkspaceAccess,
        private readonly modules: WorkspaceModuleRepository,
        private readonly settings: PlatformSettings,
    ) {}

    async execute(input: ListWorkspaceModulesInput): Promise<Result<WorkspaceModuleView[], DomainError>> {
        const role = await this.access.roleOf(input.actorId, input.workspaceId);
        if (role === undefined) return err(DomainError.notFound('Workspace'));
        if (!can(role, 'workspace.read')) return err(DomainError.forbidden());
        const rows = new Map((await this.modules.listByWorkspace(input.workspaceId)).map(r => [r.module, r]));
        const offered = new Set(this.settings.modulesEnabled);
        return ok(MODULE_IDS.map(module => toWorkspaceModuleView(
            rows.get(module) ?? WorkspaceModule.initial(input.workspaceId, module), offered.has(module),
        )));
    }
}
