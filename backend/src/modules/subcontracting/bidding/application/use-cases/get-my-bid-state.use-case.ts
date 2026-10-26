// ─── GET /vendor/invitations/:id/bid: the caller's draft and submitted versions ───
import { Injectable } from '@nestjs/common';
import type { MyBidStateDto } from '@contrack/contract';
import { type DomainError, type Result, type UserId, ok } from '../../../../../shared/domain';
import type { ScInvitationId } from '../../../shared/ids';
import { BiddingAccess } from '../bidding-access';
import { BidPresenter } from '../bid-presenter';
import { BidRepository } from '../ports/bid.repository';

export interface GetMyBidStateInput {
    userId: UserId;
    invitationId: ScInvitationId;
}

@Injectable()
export class GetMyBidStateUseCase {
    constructor(
        private readonly access: BiddingAccess,
        private readonly bids: BidRepository,
        private readonly presenter: BidPresenter,
    ) {}

    async execute(input: GetMyBidStateInput): Promise<Result<MyBidStateDto, DomainError>> {
        const granted = await this.access.vendorInvitation(input.userId, input.invitationId, ['vendor.read']);
        if (!granted.ok) return granted;
        const { pkg } = granted.value;
        const draft = await this.bids.findDraft(input.invitationId);
        const submitted = await this.bids.listSubmittedOfInvitation(input.invitationId);
        const dtos = await this.presenter.many(draft === undefined ? submitted : [draft, ...submitted], pkg.version);
        return ok({
            draft: draft === undefined ? null : dtos[0] ?? null,
            submitted: draft === undefined ? dtos : dtos.slice(1),
        });
    }
}
