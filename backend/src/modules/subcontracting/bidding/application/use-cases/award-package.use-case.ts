// ─── POST /subcontracting/packages/:id/award: choose the winner(s) and open their subcontracts (plan §4.6, §6 rule 7) ───
// Each allocated line goes to exactly one bid, which must be the latest submitted version of its invitation and made
// for the package's current version (an outdated bid is refused: the vendor resubmits); a lump bid wins all lines or
// nothing; no part may be below 0. Lines left out stay unsourced. One transaction, package row first:
// PackageDirectory.markAwarded locks it and refuses (409, nothing written) a package already awarded / cancelled /
// closed (double click, concurrent award); then bids selected / not_selected (compare-and-set: a chosen bid changed
// meanwhile rolls everything back, 409), one subcontract per winner (SubcontractCreator), award row. Then notifications.
import { Injectable } from '@nestjs/common';
import type { AwardRequest, AwardResponse, InstallmentDto } from '@contrack/contract';
import { type AwardRefusal, priceAward } from '@contrack/domain/subcontracting/leveling';
import { Clock, IdGenerator, Notifier, UnitOfWork } from '../../../../../shared/application/ports';
import { DomainError, type Result, type UserId, type WorkspaceId, err, ok } from '../../../../../shared/domain';
import { asAwardId, type BidId, type PackageId, type ScInvitationId, type SubcontractId } from '../../../shared/ids';
import {
    type AwardedPart, type InvitationView, PackageDirectory, ScActivityLog, SubcontractCreator, VendorDirectory,
} from '../../../shared/ports';
import type { Bid } from '../../domain/entities/bid.entity';
import { BiddingAccess } from '../bidding-access';
import { acceptsManualBid, formatBaht, isOutdated, pricingOf } from '../bidding-rules';
import { ConcurrentChange, runRefusingRaces } from '../concurrency';
import { AwardRepository } from '../ports/award.repository';
import { BidRepository } from '../ports/bid.repository';

export interface AwardPackageInput {
    userId: UserId;
    packageId: PackageId;
    body: AwardRequest;
}

interface Winner {
    bid: Bid;
    invitation: InvitationView;
    part: Omit<AwardedPart, 'bid'>;
}

const REASON_TEXT: Record<AwardRefusal, string> = {
    unknown_line: 'Unknown line',
    duplicate_line: 'A line can go to one bid only',
    line_not_priced: 'The bid did not price this line',
    lump_needs_all_lines: 'A lump-sum bid wins all lines or none',
    no_lines: 'No lines for this bid',
    negative_total: 'The awarded part cannot be below 0',
};

@Injectable()
export class AwardPackageUseCase {
    constructor(
        private readonly access: BiddingAccess,
        private readonly packages: PackageDirectory,
        private readonly bids: BidRepository,
        private readonly awards: AwardRepository,
        private readonly vendors: VendorDirectory,
        private readonly creator: SubcontractCreator,
        private readonly activity: ScActivityLog,
        private readonly notifier: Notifier,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: AwardPackageInput): Promise<Result<AwardResponse, DomainError>> {
        const granted = await this.access.buyerPackage(input.userId, input.packageId, ['sc.award']);
        if (!granted.ok) return granted;
        const { pkg } = granted.value;
        const open = acceptsManualBid(pkg);
        if (!open.ok) return err(DomainError.conflict('The package cannot be awarded now', { reason: 'package_not_open', status: pkg.status }));

        // Lines per bid, in the order the bids first appear.
        const known = new Set(pkg.lines.map(l => l.idx));
        const seen = new Set<number>();
        const linesOfBid = new Map<BidId, number[]>();
        for (const a of input.body.allocations) {
            if (!known.has(a.idx)) return err(DomainError.unprocessable(REASON_TEXT.unknown_line, { reason: 'unknown_line', idx: a.idx }));
            if (seen.has(a.idx)) return err(DomainError.unprocessable(REASON_TEXT.duplicate_line, { reason: 'duplicate_line', idx: a.idx }));
            seen.add(a.idx);
            const bidId = a.bidId as BidId;
            linesOfBid.set(bidId, [...(linesOfBid.get(bidId) ?? []), a.idx]);
        }

        const invitations = await this.packages.listInvitations(pkg.id);
        const invitationById = new Map(invitations.map(i => [i.id, i]));
        const latest = await this.bids.latestSubmitted(invitations.map(i => i.id));
        const latestById = new Map([...latest.values()].map(b => [b.id, b]));
        const vendorIds = invitations.map(i => i.vendorWorkspaceId).filter((v): v is WorkspaceId => v !== null);
        const cards = await this.vendors.cards([...new Set(vendorIds)]);
        const now = this.clock.now();

        const winners: Winner[] = [];
        for (const [bidId, idxs] of linesOfBid) {
            const bid = latestById.get(bidId);
            const invitation = bid === undefined ? undefined : invitationById.get(bid.invitationId);
            // Another award won the race and already marked the bids: the package is no longer open (same answer as
            // the markAwarded lock below, instead of a race-dependent 422 bid_not_latest).
            if (bid?.status === 'selected' || bid?.status === 'not_selected') {
                return err(DomainError.conflict('The package was already awarded', { reason: 'package_not_open', status: 'awarded' }));
            }
            if (bid?.status !== 'submitted' || invitation === undefined || invitation.status === 'withdrawn') {
                return err(DomainError.unprocessable('Only the latest submitted bid of an invitation can win', { reason: 'bid_not_latest', bidId }));
            }
            if (isOutdated(bid, pkg)) {
                return err(DomainError.unprocessable('This bid was made for an older version of the package: the vendor must resubmit', {
                    reason: 'bid_outdated', bidId, bidPackageVersion: bid.packageVersion, packageVersion: pkg.version,
                }));
            }
            const priced = priceAward(pkg.lines, pricingOf(bid), idxs);
            if (!priced.ok) {
                return err(DomainError.unprocessable(REASON_TEXT[priced.reason], { reason: priced.reason, idx: priced.idx, bidId }));
            }
            const from = input.body.installmentsFrom[bidId] ?? 'package';
            const proposal = bid.content.installmentsProposal;
            if (from === 'bid' && proposal === null) {
                return err(DomainError.unprocessable('This bid proposed no installments', { reason: 'no_installments_proposal', bidId }));
            }
            const installments: InstallmentDto[] = from === 'bid' && proposal !== null ? proposal : pkg.installments;
            const lineByIdx = new Map(pkg.lines.map(l => [l.idx, l]));
            const vendorWs = invitation.vendorWorkspaceId;
            winners.push({
                bid,
                invitation,
                part: {
                    package: pkg,
                    invitation,
                    vendorName: (vendorWs === null ? undefined : cards.get(vendorWs)?.teamName) ?? invitation.displayName,
                    lines: priced.lines.map(l => {
                        const line = lineByIdx.get(l.idx);
                        return {
                            idx: l.idx, desc: line?.desc ?? '', unit: line?.unit ?? '', qty: line?.qtyPriced ?? 0,
                            unitPrice: l.unitPrice, matUnitPrice: l.matUnitPrice, total: l.total,
                        };
                    }),
                    total: priced.total,
                    installments: installments.map(i => ({ ...i })),
                    decidedBy: input.userId,
                    at: now,
                },
            });
        }

        const winnerBidIds = new Set(winners.map(w => w.bid.id));
        const winnerInvitations = new Set<ScInvitationId>(winners.map(w => w.invitation.id));
        const outcome = await runRefusingRaces(this.uow, async () => {
            // FIRST: lock the package row and move it to awarded; false = already awarded / cancelled / closed (nothing written).
            if (!(await this.packages.markAwarded(pkg.id, [...winnerInvitations], now))) return null;
            for (const bid of latest.values()) {
                const selected = winnerBidIds.has(bid.id);
                if (!bid.decide(selected, now)) continue;
                if (!(await this.bids.transition(bid, 'submitted'))) {
                    // Superseded / withdrawn since it was read: a chosen bid → roll the award back; another bid → leave it.
                    if (selected) throw new ConcurrentChange('bid_changed', 'A chosen bid changed meanwhile, reload the comparison', { bidId: bid.id });
                    continue;
                }
                await this.activity.record({
                    buyerWorkspaceId: pkg.buyerWorkspaceId, vendorWorkspaceId: bid.vendorWorkspaceId, entity: 'bid', entityId: bid.id,
                    action: selected ? 'bid.selected' : 'bid.not_selected', actorUserId: input.userId, at: now,
                });
            }
            const created: SubcontractId[] = [];
            for (const w of winners) created.push(await this.creator.create({ ...w.part, bid: w.bid.toView() }));
            await this.awards.insert({
                id: asAwardId(this.ids.newId()), buyerWorkspaceId: pkg.buyerWorkspaceId, packageId: pkg.id, decidedBy: input.userId,
                decidedAt: now, allocations: input.body.allocations.map(a => ({ idx: a.idx, bidId: a.bidId as BidId })),
                installmentsFrom: input.body.installmentsFrom, subcontractIds: created, note: input.body.note,
            });
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.awarded',
                actorUserId: input.userId, data: { winners: [...winnerBidIds], subcontractIds: created, note: input.body.note }, at: now,
            });
            return created;
        });
        if (!outcome.ok) return outcome;
        const subcontractIds = outcome.value;
        if (subcontractIds === null) {
            return err(DomainError.conflict('The package cannot be awarded now', { reason: 'package_not_open' }));
        }

        await this.notifyOutcome(pkg.buyerName, pkg.title, winners, subcontractIds, invitations);
        return ok({ packageStatus: 'awarded', subcontractIds });
    }

    private async notifyOutcome(
        buyerName: string, title: string, winners: Winner[], subcontractIds: SubcontractId[],
        invitations: InvitationView[],
    ): Promise<void> {
        const won = new Set(winners.map(w => w.invitation.id));
        for (const [k, w] of winners.entries()) {
            const vendorWs = w.invitation.vendorWorkspaceId;
            if (vendorWs === null) continue;
            await this.notifier.notify({
                template: 'sc.outcome_won', toWorkspaceIds: [vendorWs],
                payload: { buyerName, title, href: `/vendor/invitations/${w.invitation.id}` },
            });
            const subcontractId = subcontractIds[k];
            if (subcontractId === undefined) continue;
            await this.notifier.notify({
                template: 'sc.contract_to_accept', toWorkspaceIds: [vendorWs],
                payload: { buyerName, title, total: formatBaht(w.part.total), href: `/vendor/contracts/${subcontractId}` },
            });
        }
        for (const i of invitations) {
            if (won.has(i.id) || i.vendorWorkspaceId === null || i.status === 'withdrawn' || i.status === 'declined') continue;
            await this.notifier.notify({
                template: 'sc.outcome_lost', toWorkspaceIds: [i.vendorWorkspaceId],
                payload: { buyerName, title, href: `/vendor/invitations/${i.id}` },
            });
        }
    }
}
