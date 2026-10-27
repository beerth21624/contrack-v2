// ─── POST /vendor/invitations/:id/bid: submits a new version (immutable; earlier versions → superseded) ───
import { Injectable } from '@nestjs/common';
import type { BidDto, SubmitBidRequest } from '@contrack/contract';
import { Clock, Notifier } from '../../../../../shared/application/ports';
import { type DomainError, type Result, type UserId, ok } from '../../../../../shared/domain';
import type { ScInvitationId } from '../../../shared/ids';
import { VendorDirectory } from '../../../shared/ports';
import { BiddingAccess } from '../bidding-access';
import { biddingOpen, vendorInvitationActive } from '../bidding-rules';
import { BidPresenter } from '../bid-presenter';
import { BidSubmission } from '../bid-submission';

export interface SubmitBidInput {
    userId: UserId;
    invitationId: ScInvitationId;
    body: SubmitBidRequest;
}

@Injectable()
export class SubmitBidUseCase {
    constructor(
        private readonly access: BiddingAccess,
        private readonly submission: BidSubmission,
        private readonly vendors: VendorDirectory,
        private readonly presenter: BidPresenter,
        private readonly notifier: Notifier,
        private readonly clock: Clock,
    ) {}

    async execute(input: SubmitBidInput): Promise<Result<BidDto, DomainError>> {
        const granted = await this.access.vendorInvitation(input.userId, input.invitationId, ['vendor.bid.submit']);
        if (!granted.ok) return granted;
        const { invitation, pkg } = granted.value;
        const on = await this.access.buyerModuleOn(pkg.buyerWorkspaceId);
        if (!on.ok) return on;
        const open = biddingOpen(pkg, this.clock.now());
        if (!open.ok) return open;
        const active = vendorInvitationActive(invitation);
        if (!active.ok) return active;

        const bid = await this.submission.submit({ userId: input.userId, pkg, invitation, input: input.body, enteredByBuyer: false });
        if (!bid.ok) return bid;

        // No amount in the notification: every member of the buyer workspace receives it, also those without sc.readPrices.
        const card = (await this.vendors.cards([invitation.vendorWorkspaceId])).get(invitation.vendorWorkspaceId);
        await this.notifier.notify({
            template: 'sc.bid_received',
            toWorkspaceIds: [pkg.buyerWorkspaceId],
            payload: {
                vendorName: card?.teamName ?? invitation.displayName,
                title: pkg.title,
                href: `/subcontracting/packages/${pkg.id}/leveling`,
            },
        });
        return ok(await this.presenter.one(bid.value, pkg.version));
    }
}
