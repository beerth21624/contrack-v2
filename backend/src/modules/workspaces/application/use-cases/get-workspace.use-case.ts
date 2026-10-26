import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import type { Workspace } from '../../domain/entities/workspace.entity';
import { WorkspaceErrors } from '../../domain/workspace.errors';
import { MembershipRepository } from '../ports/membership.repository';
import { WorkspaceRepository } from '../ports/workspace.repository';

/** A workspace as one member sees it (mapped to `WorkspaceDto` at the edge). */
export interface WorkspaceView {
    workspace: Workspace;
    role: Role;
    memberCount: number;
}

export interface GetWorkspaceInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
}

@Injectable()
export class GetWorkspaceUseCase {
    constructor(
        private readonly workspaces: WorkspaceRepository,
        private readonly memberships: MembershipRepository,
    ) {}

    async execute(input: GetWorkspaceInput): Promise<Result<WorkspaceView, DomainError>> {
        const membership = await this.memberships.find(input.workspaceId, input.actorId);
        if (membership === undefined) return err(WorkspaceErrors.workspaceNotFound());
        if (!can(membership.role, 'workspace.read')) return err(DomainError.forbidden());
        const workspace = await this.workspaces.findById(input.workspaceId);
        if (workspace === undefined) return err(WorkspaceErrors.workspaceNotFound());
        const counts = await this.memberships.countByWorkspaces([workspace.id]);
        return ok({ workspace, role: membership.role, memberCount: counts.get(workspace.id) ?? 0 });
    }
}
