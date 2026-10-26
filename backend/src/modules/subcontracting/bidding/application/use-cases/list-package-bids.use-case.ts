// ─── GET /subcontracting/packages/:id/bids: every submitted version of every invitee (buyer, sc.readPrices) ───
// Opening the prices is logged (plan §6 rule 3).
import { Injectable } from '@nestjs/common';
import type { BidDto } from '@contrack/contract';
import { Clock } from '../../../../../shared/application/ports';
import { type DomainError, type Result, type UserId, ok } from '../../../../../shared/domain';
import type { PackageId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { BiddingAccess } from '../bidding-access';
import { BidPresenter } from '../bid-presenter';
import { BidRepository } from '../ports/bid.repository';

export interface ListPackageBidsInput {
    userId: UserId;
    packageId: PackageId;
}

@Injectable()
export class ListPackageBidsUseCase {
    constructor(
        private readonly access: BiddingAccess,
        private readonly bids: BidRepository,
        private readonly presenter: BidPresenter,
        private readonly activity: ScActivityLog,
        private readonly clock: Clock,
    ) {}

    async execute(input: ListPackageBidsInput): Promise<Result<BidDto[], DomainError>> {
        const granted = await this.access.buyerPackage(input.userId, input.packageId, ['sc.readPrices']);
        if (!granted.ok) return granted;
        const { pkg } = granted.value;
        const bids = await this.bids.listSubmittedOfPackage(pkg.buyerWorkspaceId, pkg.id);
        await this.activity.record({
            buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'prices.viewed',
            actorUserId: input.userId, data: { view: 'bids', count: bids.length }, at: this.clock.now(),
        });
        return ok(await this.presenter.many(bids, pkg.version));
    }
}
