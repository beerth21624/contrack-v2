import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import type { Invitation } from '../../domain/entities/invitation.entity';
import { WorkspaceErrors } from '../../domain/workspace.errors';
import { InvitationRepository } from '../ports/invitation.repository';
import { MembershipRepository } from '../ports/membership.repository';

export interface ListPendingInvitationsInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
}

/** Needs `members.invite`. Only pending invitations (not accepted, revoked or expired), newest first. */
@Injectable()
export class ListPendingInvitationsUseCase {
    constructor(
        private readonly memberships: MembershipRepository,
        private readonly invitations: InvitationRepository,
        private readonly clock: Clock,
    ) {}

    async execute(input: ListPendingInvitationsInput): Promise<Result<Invitation[], DomainError>> {
        const membership = await this.memberships.find(input.workspaceId, input.actorId);
        if (membership === undefined) return err(WorkspaceErrors.workspaceNotFound());
        if (!can(membership.role, 'members.invite')) return err(DomainError.forbidden());
        return ok(await this.invitations.listPending(input.workspaceId, this.clock.now()));
    }
}
