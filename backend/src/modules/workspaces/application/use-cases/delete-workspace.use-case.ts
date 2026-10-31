import { Injectable } from '@nestjs/common';
import { UnitOfWork, WorkspaceDeletionGuards } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { checkWorkspaceDeletion } from '../../domain/policies/workspace-deletion.policy';
import { WorkspaceErrors } from '../../domain/workspace.errors';
import { InvitationRepository } from '../ports/invitation.repository';
import { MembershipRepository } from '../ports/membership.repository';
import { WorkspaceRepository } from '../ports/workspace.repository';

export interface DeleteWorkspaceInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
}

/** Company workspaces only (`personal_workspace`), owners only (`workspace.delete`). */
@Injectable()
export class DeleteWorkspaceUseCase {
    constructor(
        private readonly workspaces: WorkspaceRepository,
        private readonly memberships: MembershipRepository,
        private readonly invitations: InvitationRepository,
        private readonly uow: UnitOfWork,
        // Default for unit tests built by hand; Nest injects the core registry.
        private readonly guards: WorkspaceDeletionGuards = new WorkspaceDeletionGuards(),
    ) {}

    async execute(input: DeleteWorkspaceInput): Promise<Result<undefined, DomainError>> {
        const membership = await this.memberships.find(input.workspaceId, input.actorId);
        if (membership === undefined) return err(WorkspaceErrors.workspaceNotFound());
        const workspace = await this.workspaces.findById(input.workspaceId);
        if (workspace === undefined) return err(WorkspaceErrors.workspaceNotFound());
        const allowed = checkWorkspaceDeletion({ kind: workspace.kind, role: membership.role });
        if (!allowed.ok) return allowed;
        // Postgres cascades from workspaces; deleting explicitly keeps the in-memory adapters consistent too.
        return this.uow.run(async (): Promise<Result<undefined, DomainError>> => {
            // ERP modules refuse while the workspace has issued documents (none registered / no rows in release 1).
            const blockers = await this.guards.blockers(workspace.id);
            const first = blockers[0];
            if (first !== undefined) {
                return err(DomainError.conflict('The workspace has issued documents and cannot be deleted', { reason: first.reason, blockers }));
            }
            await this.invitations.deleteAllOfWorkspace(workspace.id);
            await this.memberships.deleteAllOfWorkspace(workspace.id);
            await this.workspaces.delete(workspace.id);
            return okVoid();
        });
    }
}
