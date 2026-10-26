import { Injectable } from '@nestjs/common';
import type { GuestPackageDto } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import { type Result, ok } from '../../../../../shared/domain/result';
import { ScActivityLog } from '../../../shared/ports';
import { InvitationRepository } from '../ports/sourcing.repositories';
import { type InvitationVia, SourcingAccess } from '../services/sourcing-access.service';
import { SourcingViews } from '../services/sourcing-views.service';

/**
 * The package as the invitee sees it (no estimate, no other bidder), through the link (public; expired / withdrawn
 * → 410 invitation_invalid) or signed in (`vendor.read`). The first view marks the invitation viewed.
 */
@Injectable()
export class ViewInvitationUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly invitations: InvitationRepository,
        private readonly views: SourcingViews,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { via: InvitationVia }): Promise<Result<GuestPackageDto, DomainError>> {
        const found = await this.access.invitee(input.via, ['vendor.read']);
        if (!found.ok) return found;
        const { invitation, pkg } = found.value;
        const now = this.clock.now();
        if (invitation.markViewed(now)) {
            await this.uow.run(async () => {
                await this.invitations.update(invitation);
                await this.activity.record({
                    buyerWorkspaceId: pkg.buyerWorkspaceId, vendorWorkspaceId: invitation.vendorWorkspaceId, entity: 'invitation',
                    entityId: invitation.id, action: 'invitation.viewed', actorUserId: 'userId' in input.via ? input.via.userId : null, at: now,
                });
            });
        }
        return ok(await this.views.guestPackage(pkg, invitation));
    }
}
