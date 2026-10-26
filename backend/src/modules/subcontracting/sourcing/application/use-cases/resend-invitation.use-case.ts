import { Injectable } from '@nestjs/common';
import type { ResendInvitationResponse } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import { newOpaqueToken, sha256 } from '../../../../../shared/infrastructure/crypto';
import type { ScInvitationId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import type { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import type { WorkPackage } from '../../domain/entities/work-package.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { SmsRateLimiter, buyerSmsRules, resendRules } from '../ports/sms-rate-limiter.port';
import { InvitationRepository, WorkPackageRepository } from '../ports/sourcing.repositories';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingNotices } from '../services/sourcing-notices.service';
import { SourcingViews, hasSubmitted } from '../services/sourcing-views.service';

/**
 * `sc.packages.manage`. A fresh link for a sent, undecided package — every earlier link of the invitation stops
 * working; the expiry is renewed to the deadline + 30 days — and the invitation message again. Withdrawn → conflict.
 * At most one resend per 10 minutes and 5 per day per invitation, and the buyer's daily SMS budget → rate_limited.
 */
@Injectable()
export class ResendInvitationUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly views: SourcingViews,
        private readonly notices: SourcingNotices,
        private readonly limiter: SmsRateLimiter,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorId: UserId; invitationId: ScInvitationId }): Promise<Result<ResendInvitationResponse, DomainError>> {
        const found = await this.access.buyerInvitation(input.actorId, input.invitationId, ['sc.packages.manage']);
        if (!found.ok) return found;
        const { prices } = found.value;
        const now = this.clock.now();
        const token = newOpaqueToken();
        const done = await this.uow.run(async (): Promise<Result<{ pkg: WorkPackage; invitation: ScInvitation }, DomainError>> => {
            const locked = await this.access.lockPackage(found.value.pkg.id);
            if (!locked.ok) return locked;
            const pkg = locked.value;
            const all = await this.invitations.lockByPackage(pkg.id);
            const invitation = all.find(i => i.id === input.invitationId);
            if (invitation === undefined) return err(SourcingErrors.invitationNotFound());
            const settled = pkg.settle(now, hasSubmitted(all));
            if (!pkg.isActive) return err(SourcingErrors.finished());
            const resent = invitation.resend(pkg.props.bidDeadline);
            if (!resent.ok) return resent;
            const sms = invitation.props.channel === 'link' ? 0 : 1;
            if (!(await this.limiter.tryTake([...resendRules(invitation.id), ...buyerSmsRules(pkg.buyerWorkspaceId, sms)]))) {
                return err(SourcingErrors.rateLimited());
            }
            if (settled) await this.packages.update(pkg);
            await this.invitations.update(invitation);
            await this.invitations.replaceTokens(invitation.id, sha256(token), now);
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, vendorWorkspaceId: invitation.vendorWorkspaceId, entity: 'invitation',
                entityId: invitation.id, action: 'invitation.resent', actorUserId: input.actorId, at: now,
            });
            return ok({ pkg, invitation });
        });
        if (!done.ok) return done;
        const { pkg, invitation } = done.value;
        await this.notices.invitation(pkg, await this.notices.workspaceName(pkg.buyerWorkspaceId), invitation, token);
        const [dto] = await this.views.invitationDtos(pkg, [invitation], prices);
        if (dto === undefined) throw new Error('invitation vanished');
        return ok({ invitation: dto, link: { invitationId: invitation.id, url: this.notices.guestUrl(token) } });
    }
}
