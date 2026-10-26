import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.value-object';
import { WorkspaceErrors } from '../../domain/workspace.errors';
import { MembershipRepository } from '../ports/membership.repository';
import { WorkspaceRepository } from '../ports/workspace.repository';
import type { WorkspaceView } from './get-workspace.use-case';

export interface RenameWorkspaceInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    name: string;
}

/** Needs `workspace.rename` (owner, admin). Personal workspaces may be renamed too. */
@Injectable()
export class RenameWorkspaceUseCase {
    constructor(
        private readonly workspaces: WorkspaceRepository,
        private readonly memberships: MembershipRepository,
    ) {}

    async execute(input: RenameWorkspaceInput): Promise<Result<WorkspaceView, DomainError>> {
        const membership = await this.memberships.find(input.workspaceId, input.actorId);
        if (membership === undefined) return err(WorkspaceErrors.workspaceNotFound());
        if (!can(membership.role, 'workspace.rename')) return err(DomainError.forbidden());
        const name = WorkspaceName.create(input.name);
        if (!name.ok) return name;
        const workspace = await this.workspaces.findById(input.workspaceId);
        if (workspace === undefined) return err(WorkspaceErrors.workspaceNotFound());
        workspace.rename(name.value);
        await this.workspaces.update(workspace);
        const counts = await this.memberships.countByWorkspaces([workspace.id]);
        return ok({ workspace, role: membership.role, memberCount: counts.get(workspace.id) ?? 0 });
    }
}
