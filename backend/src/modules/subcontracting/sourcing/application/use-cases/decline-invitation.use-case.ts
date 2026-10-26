import { Injectable } from '@nestjs/common';
import type { DeclineReason } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../../../shared/domain/result';
import { ScActivityLog } from '../../../shared/ports';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { InvitationRepository, VendorProfileRepository, WorkPackageRepository } from '../ports/sourcing.repositories';
import { type InvitationVia, SourcingAccess } from '../services/sourcing-access.service';
import { SourcingNotices } from '../services/sourcing-notices.service';
import { hasSubmitted } from '../services/sourcing-views.service';
import { DECLINE_REASON_LABEL } from '../services/thai-format';

/**
 * An invitee says no, through the link (public) or signed in (`vendor.bid.submit`). Before the deadline, buyer
 * module on, invitation sent / viewed (a crew with a bid in withdraws the bid first). The buyer is told.
 */
@Injectable()
export class DeclineInvitationUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly profiles: VendorProfileRepository,
        private readonly notices: SourcingNotices,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { via: InvitationVia; reason: DeclineReason; note: string }): Promise<Result<undefined, DomainError>> {
        const found = await this.access.invitee(input.via, ['vendor.bid.submit']);
        if (!found.ok) return found;
        const { invitation, pkg } = found.value;
        const on = await this.access.sc.buyerModuleOn(pkg.buyerWorkspaceId);
        if (!on.ok) return on;
        const now = this.clock.now();
        const settled = pkg.settle(now, hasSubmitted(await this.invitations.listByPackage(pkg.id)));
        if (!pkg.acceptsResponses(now)) return err(pkg.isActive ? SourcingErrors.deadlinePassed() : SourcingErrors.finished());
        const declined = invitation.decline(input.reason, input.note, now);
        if (!declined.ok) return declined;
        await this.uow.run(async () => {
            if (settled) await this.packages.update(pkg);
            await this.invitations.update(invitation);
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, vendorWorkspaceId: invitation.vendorWorkspaceId, entity: 'invitation',
                entityId: invitation.id, action: 'invitation.declined', actorUserId: 'userId' in input.via ? input.via.userId : null,
                data: { reason: input.reason }, at: now,
            });
        });
        const vendorWs = invitation.vendorWorkspaceId;
        const team = vendorWs === null ? undefined : (await this.profiles.find(vendorWs))?.props.teamName;
        const note = input.note.trim();
        const reason = note === '' ? DECLINE_REASON_LABEL[input.reason] : `${DECLINE_REASON_LABEL[input.reason]}: ${note}`;
        await this.notices.declined(pkg, team ?? invitation.props.displayName, reason);
        return okVoid();
    }
}
