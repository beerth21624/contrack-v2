import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { Clock, UnitOfWork, UserDirectory } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { roleRank } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { sha256 } from '../../../../shared/infrastructure/crypto';
import { Membership } from '../../domain/entities/membership.entity';
import { WorkspaceErrors } from '../../domain/workspace.errors';
import { InvitationRepository } from '../ports/invitation.repository';
import { MembershipRepository } from '../ports/membership.repository';

export interface AcceptInvitationInput {
    userId: UserId;
    token: string;
}

export interface AcceptedInvitation {
    workspaceId: WorkspaceId;
    role: Role;
}

/**
 * The signed-in user's e-mail must equal the invitation's (case-insensitive); the invitation must be pending.
 * Every failure is the same `invitation_invalid` (the workspace is never revealed). Single use: the invitation is
 * re-read under the membership lock, so two concurrent accepts of one token cannot both succeed.
 * Already a member → keeps the stronger of the two roles.
 */
@Injectable()
export class AcceptInvitationUseCase {
    constructor(
        private readonly memberships: MembershipRepository,
        private readonly invitations: InvitationRepository,
        private readonly users: UserDirectory,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: AcceptInvitationInput): Promise<Result<AcceptedInvitation, DomainError>> {
        const found = await this.invitations.findByTokenHash(sha256(input.token));
        if (!found?.isPending(this.clock.now())) return err(WorkspaceErrors.invitationInvalid());
        const profile = (await this.users.findMany([input.userId])).get(input.userId);
        if (profile === undefined || !found.email.matches(profile.email)) return err(WorkspaceErrors.invitationInvalid());

        const workspaceId = found.workspaceId;
        return this.uow.run(() => this.memberships.withLockedMembers(workspaceId, async (members): Promise<Result<AcceptedInvitation, DomainError>> => {
            const now = this.clock.now();
            const invitation = await this.invitations.findById(workspaceId, found.id);
            if (invitation === undefined) return err(WorkspaceErrors.invitationInvalid());
            const accepted = invitation.accept(input.userId, now);
            if (!accepted.ok) return accepted;

            let role: Role = invitation.role;
            const existing = members.find(m => m.userId === input.userId);
            if (existing === undefined) {
                await this.memberships.insert(Membership.create({ workspaceId, userId: input.userId, role, joinedAt: now }));
            } else if (roleRank(invitation.role) > roleRank(existing.role)) {
                existing.changeRole(invitation.role);
                await this.memberships.update(existing);
            } else {
                role = existing.role;
            }
            await this.invitations.update(invitation);
            return ok({ workspaceId, role });
        }));
    }
}
