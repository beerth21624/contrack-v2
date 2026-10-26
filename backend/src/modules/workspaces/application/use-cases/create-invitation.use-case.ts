import { Injectable } from '@nestjs/common';
import type { AssignableRole } from '@contrack/contract';
import { Clock, IdGenerator, UnitOfWork, UserDirectory } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, asInvitationId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { AppConfig } from '../../../../shared/infrastructure/config/env';
import { newOpaqueToken, sha256 } from '../../../../shared/infrastructure/crypto';
import { Invitation } from '../../domain/entities/invitation.entity';
import { checkInvitation } from '../../domain/policies/invitation.policy';
import { Email } from '../../domain/value-objects/email.value-object';
import { WorkspaceErrors } from '../../domain/workspace.errors';
import { InvitationRepository } from '../ports/invitation.repository';
import { MembershipRepository } from '../ports/membership.repository';
import { WorkspaceRepository } from '../ports/workspace.repository';

export interface CreateInvitationInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    email: string;
    role: AssignableRole;
}

export interface CreatedInvitation {
    invitation: Invitation;
    /** The raw token, returned once to the inviter; only its SHA-256 is stored. */
    token: string;
}

/**
 * Needs `members.invite`; company workspaces only. Inviting a current member → `conflict`.
 * A pending invitation for the same e-mail is revoked and replaced (the old link stops working).
 */
@Injectable()
export class CreateInvitationUseCase {
    constructor(
        private readonly workspaces: WorkspaceRepository,
        private readonly memberships: MembershipRepository,
        private readonly invitations: InvitationRepository,
        private readonly users: UserDirectory,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
        private readonly config: AppConfig,
    ) {}

    async execute(input: CreateInvitationInput): Promise<Result<CreatedInvitation, DomainError>> {
        const inviter = await this.memberships.find(input.workspaceId, input.actorId);
        if (inviter === undefined) return err(WorkspaceErrors.workspaceNotFound());
        const workspace = await this.workspaces.findById(input.workspaceId);
        if (workspace === undefined) return err(WorkspaceErrors.workspaceNotFound());
        const allowed = checkInvitation({ kind: workspace.kind, inviterRole: inviter.role, role: input.role });
        if (!allowed.ok) return allowed;
        const parsed = Email.create(input.email);
        if (!parsed.ok) return parsed;
        const email = parsed.value;

        return this.uow.run(() => this.memberships.withLockedMembers(workspace.id, async (members): Promise<Result<CreatedInvitation, DomainError>> => {
            const profiles = await this.users.findMany(members.map(m => m.userId));
            for (const profile of profiles.values()) {
                if (email.matches(profile.email)) return err(DomainError.conflict('This person is already a member'));
            }
            const now = this.clock.now();
            for (const previous of await this.invitations.listPendingForEmail(workspace.id, email.value, now)) {
                if (previous.revoke(now).ok) await this.invitations.update(previous);
            }
            const token = newOpaqueToken();
            const invitation = Invitation.create({
                id: asInvitationId(this.ids.newId()),
                workspaceId: workspace.id,
                email,
                role: input.role,
                tokenHash: sha256(token),
                invitedBy: input.actorId,
                now,
                ttlDays: this.config.env.INVITATION_TTL_DAYS,
            });
            await this.invitations.insert(invitation);
            return ok({ invitation, token });
        }));
    }
}
