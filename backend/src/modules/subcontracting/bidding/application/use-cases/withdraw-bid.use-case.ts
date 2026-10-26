// ─── POST /vendor/invitations/:id/bid/withdraw: takes the latest submitted version back (before the deadline) ───
// The status change is a compare-and-set (still submitted): a submit / award that won the race makes this a 409.
import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import { DomainError, type Result, type UserId, err, okVoid } from '../../../../../shared/domain';
import type { ScInvitationId } from '../../../shared/ids';
import { PackageDirectory, ScActivityLog } from '../../../shared/ports';
import { BiddingAccess } from '../bidding-access';
import { biddingOpen } from '../bidding-rules';
import { ConcurrentChange, runRefusingRaces } from '../concurrency';
import { BidRepository } from '../ports/bid.repository';

export interface WithdrawBidInput {
    userId: UserId;
    invitationId: ScInvitationId;
}

@Injectable()
export class WithdrawBidUseCase {
    constructor(
        private readonly access: BiddingAccess,
        private readonly packages: PackageDirectory,
        private readonly bids: BidRepository,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: WithdrawBidInput): Promise<Result<undefined, DomainError>> {
        const granted = await this.access.vendorInvitation(input.userId, input.invitationId, ['vendor.bid.submit']);
        if (!granted.ok) return granted;
        const { invitation, pkg } = granted.value;
        const on = await this.access.buyerModuleOn(pkg.buyerWorkspaceId);
        if (!on.ok) return on;
        const now = this.clock.now();
        const open = biddingOpen(pkg, now);
        if (!open.ok) return open;

        const latest = (await this.bids.latestSubmitted([invitation.id])).get(invitation.id);
        if (latest?.withdraw(now) !== true) return err(DomainError.conflict('There is no submitted bid to withdraw', { reason: 'no_bid' }));
        const done = await runRefusingRaces(this.uow, async () => {
            // Invitation row before bid rows (same order as submit / award).
            await this.packages.markBidWithdrawn(invitation.id);
            if (!(await this.bids.transition(latest, 'submitted'))) {
                throw new ConcurrentChange('no_bid', 'There is no submitted bid to withdraw');
            }
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, vendorWorkspaceId: invitation.vendorWorkspaceId, entity: 'bid', entityId: latest.id,
                action: 'bid.withdrawn', actorUserId: input.userId, data: { invitationId: invitation.id, version: latest.version }, at: now,
            });
        });
        return done.ok ? okVoid() : done;
    }
}
