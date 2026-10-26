import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { InvitationId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { WorkspaceErrors } from '../../domain/workspace.errors';
import { InvitationRepository } from '../ports/invitation.repository';
import { MembershipRepository } from '../ports/membership.repository';

export interface RevokeInvitationInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    invitationId: InvitationId;
}

/** Needs `members.invite`. Only a pending invitation can be revoked; anything else is `not_found` (it is not listed). */
@Injectable()
export class RevokeInvitationUseCase {
    constructor(
        private readonly memberships: MembershipRepository,
        private readonly invitations: InvitationRepository,
        private readonly clock: Clock,
    ) {}

    async execute(input: RevokeInvitationInput): Promise<Result<undefined, DomainError>> {
        const membership = await this.memberships.find(input.workspaceId, input.actorId);
        if (membership === undefined) return err(WorkspaceErrors.workspaceNotFound());
        if (!can(membership.role, 'members.invite')) return err(DomainError.forbidden());
        const invitation = await this.invitations.findById(input.workspaceId, input.invitationId);
        if (invitation === undefined) return err(WorkspaceErrors.invitationNotFound());
        if (!invitation.revoke(this.clock.now()).ok) return err(WorkspaceErrors.invitationNotFound());
        await this.invitations.update(invitation);
        return okVoid();
    }
}
