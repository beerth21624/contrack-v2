import { Injectable } from '@nestjs/common';
import { WorkspaceAccess } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { WorkspaceModule } from '../../domain/entities/workspace-module.entity';
import { moduleStates } from '../../domain/module-activation';
import { type WorkspaceModuleRows, WorkspaceModuleStates } from '../services/workspace-module-states';
import { type WorkspaceModuleView, toWorkspaceModuleView } from './workspace-module.view';

export interface ListWorkspaceModulesInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
}

/** Every module of the workspace (MODULE_IDS order) from rows already loaded. */
export function workspaceModuleViews(states: WorkspaceModuleStates, workspaceId: WorkspaceId, rows: WorkspaceModuleRows): WorkspaceModuleView[] {
    return moduleStates(states.inputsOf(rows)).map(state => toWorkspaceModuleView(
        rows.switches.get(state.module) ?? WorkspaceModule.initial(workspaceId, state.module), state,
    ));
}

/**
 * Every module id (MODULE_IDS order) with its four flag layers: offered by the platform, entitlement, the workspace's
 * switch, and whether it is active (dependencies included).
 */
@Injectable()
export class ListWorkspaceModulesUseCase {
    constructor(
        private readonly access: WorkspaceAccess,
        private readonly states: WorkspaceModuleStates,
    ) {}

    async execute(input: ListWorkspaceModulesInput): Promise<Result<WorkspaceModuleView[], DomainError>> {
        const role = await this.access.roleOf(input.actorId, input.workspaceId);
        if (role === undefined) return err(DomainError.notFound('Workspace'));
        if (!can(role, 'workspace.read')) return err(DomainError.forbidden());
        return ok(workspaceModuleViews(this.states, input.workspaceId, await this.states.load(input.workspaceId)));
    }
}
