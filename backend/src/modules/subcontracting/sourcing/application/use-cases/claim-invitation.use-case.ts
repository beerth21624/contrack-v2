import { Injectable } from '@nestjs/common';
import type { GuestPackageDto } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import { sha256 } from '../../../../../shared/infrastructure/crypto';
import { ScActivityLog } from '../../../shared/ports';
import type { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { InvitationRepository, VendorProfileRepository } from '../ports/sourcing.repositories';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingViews } from '../services/sourcing-views.service';
import { VendorLinker } from '../services/vendor-linker.service';

export interface ClaimInvitationInput {
    actorId: UserId;
    token: string;
    /** The crew (vendor workspace) taking the invitation. */
    workspaceId: WorkspaceId;
}

/**
 * A signed-in member (`vendor.read`) of a workspace with a vendor profile links the invitation of a valid link to
 * that crew — only when the crew's verified phone (the profile's, set by OTP sign-in) is the invited phone, else
 * conflict { reason: 'phone_mismatch' } (the buyer has to invite that number). Idempotent; linked to another crew →
 * conflict; withdrawn → not_found. Buyer module must be on.
 */
@Injectable()
export class ClaimInvitationUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly profiles: VendorProfileRepository,
        private readonly invitations: InvitationRepository,
        private readonly linker: VendorLinker,
        private readonly views: SourcingViews,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: ClaimInvitationInput): Promise<Result<GuestPackageDto, DomainError>> {
        const role = await this.access.sc.vendor(input.actorId, input.workspaceId, ['vendor.read']);
        if (!role.ok) return role;
        const profile = await this.profiles.find(input.workspaceId);
        if (profile === undefined) return err(SourcingErrors.profileNotFound());
        const found = await this.access.byToken(input.token);
        if (!found.ok) {
            const raw = found.error.code === 'invitation_invalid' ? await this.invitations.findByTokenHash(sha256(input.token)) : undefined;
            return raw?.status === 'withdrawn' ? err(SourcingErrors.invitationNotFound()) : found;
        }
        const { invitation, pkg } = found.value;
        const on = await this.access.sc.buyerModuleOn(pkg.buyerWorkspaceId);
        if (!on.ok) return on;
        const now = this.clock.now();
        const claimed = await this.uow.run(async (): Promise<Result<ScInvitation, DomainError>> => {
            const linked = await this.linker.linkInvitation(invitation.id, input.workspaceId, profile.props.phone, input.actorId, now);
            if (!linked.ok) return linked;
            const inv = linked.value.invitation;
            if (inv.markViewed(now)) {
                await this.invitations.update(inv);
                await this.activity.record({
                    buyerWorkspaceId: pkg.buyerWorkspaceId, vendorWorkspaceId: input.workspaceId, entity: 'invitation',
                    entityId: inv.id, action: 'invitation.viewed', actorUserId: input.actorId, at: now,
                });
            }
            return ok(inv);
        });
        if (!claimed.ok) return claimed;
        return ok(await this.views.guestPackage(pkg, claimed.value));
    }
}
