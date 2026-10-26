// ─── BidDirectory (port for sourcing / contracts) over the bid repository ───
import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../../shared/application/ports';
import type { BidId, PackageId, ScInvitationId } from '../../../shared/ids';
import { BidDirectory, type BidView, PackageDirectory } from '../../../shared/ports';
import { BidRepository } from '../../application/ports/bid.repository';

@Injectable()
export class RepositoryBidDirectory extends BidDirectory {
    constructor(
        private readonly bids: BidRepository,
        private readonly packages: PackageDirectory,
        private readonly clock: Clock,
    ) {
        super();
    }

    async latestSubmitted(invitationIds: readonly ScInvitationId[]): Promise<Map<ScInvitationId, BidView>> {
        const latest = await this.bids.latestSubmitted(invitationIds);
        return new Map([...latest].map(([id, bid]) => [id, bid.toView()]));
    }

    async find(bidId: BidId): Promise<BidView | undefined> {
        const bid = await this.bids.findById(bidId);
        return bid === undefined || bid.isDraft ? undefined : bid.toView();
    }

    async resetDecisions(packageId: PackageId): Promise<void> {
        const pkg = await this.packages.findPackage(packageId);
        if (pkg === undefined) return;
        await this.bids.resetDecisions(pkg.buyerWorkspaceId, packageId, this.clock.now());
    }
}
