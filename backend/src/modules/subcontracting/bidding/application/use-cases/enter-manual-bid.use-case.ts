// ─── POST /subcontracting/invitations/:id/manual-bid: the buyer types a price received by phone / on paper ───
// Allowed from send until award, also after the deadline (the buyer decides what to accept).
import { Injectable } from '@nestjs/common';
import type { BidDto, ManualBidRequest } from '@contrack/contract';
import { type DomainError, type Result, type UserId, ok } from '../../../../../shared/domain';
import type { ScInvitationId } from '../../../shared/ids';
import { BiddingAccess } from '../bidding-access';
import { acceptsManualBid, invitationActive } from '../bidding-rules';
import { BidPresenter } from '../bid-presenter';
import { BidSubmission } from '../bid-submission';

export interface EnterManualBidInput {
    userId: UserId;
    invitationId: ScInvitationId;
    body: ManualBidRequest;
}

@Injectable()
export class EnterManualBidUseCase {
    constructor(
        private readonly access: BiddingAccess,
        private readonly submission: BidSubmission,
        private readonly presenter: BidPresenter,
    ) {}

    async execute(input: EnterManualBidInput): Promise<Result<BidDto, DomainError>> {
        const granted = await this.access.buyerInvitation(input.userId, input.invitationId, ['sc.packages.manage']);
        if (!granted.ok) return granted;
        const { invitation, pkg } = granted.value;
        const accepts = acceptsManualBid(pkg);
        if (!accepts.ok) return accepts;
        const active = invitationActive(invitation);
        if (!active.ok) return active;

        const bid = await this.submission.submit({ userId: input.userId, pkg, invitation, input: input.body, enteredByBuyer: true });
        if (!bid.ok) return bid;
        return ok(await this.presenter.one(bid.value, pkg.version));
    }
}
