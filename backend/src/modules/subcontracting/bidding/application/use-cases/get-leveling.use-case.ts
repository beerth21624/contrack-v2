// ─── GET /subcontracting/packages/:id/leveling: the bid comparison table (plan §4.5) ───
// One column per invitee with a latest submitted (not withdrawn) bid, sorted by normalised total. A bid made for an
// older package version (an addendum since) is never moved onto the current lines: it is marked outdated, shows the
// total it was submitted with (normalizedTotal = that total, no diff / flag), its prices only on lines that did not
// change and empty cells elsewhere, and comes after the current bids. It cannot be awarded (the vendor resubmits).
import { Injectable } from '@nestjs/common';
import type { LevelingDto } from '@contrack/contract';
import { estimateUnitOf, levelBid, levelOutdatedBid } from '@contrack/domain/subcontracting/leveling';
import { Clock } from '../../../../../shared/application/ports';
import { type DomainError, type Result, type UserId, type WorkspaceId, ok } from '../../../../../shared/domain';
import type { PackageId } from '../../../shared/ids';
import { PackageDirectory, ScActivityLog, SubcontractingSettingsReader, VendorDirectory, VendorStats } from '../../../shared/ports';
import { BiddingAccess } from '../bidding-access';
import { bangkokToday, isOutdated, linesOfBidVersion, pricingOf } from '../bidding-rules';
import { BidRepository } from '../ports/bid.repository';

export interface GetLevelingInput {
    userId: UserId;
    packageId: PackageId;
}

@Injectable()
export class GetLevelingUseCase {
    constructor(
        private readonly access: BiddingAccess,
        private readonly packages: PackageDirectory,
        private readonly bids: BidRepository,
        private readonly vendors: VendorDirectory,
        private readonly stats: VendorStats,
        private readonly settings: SubcontractingSettingsReader,
        private readonly activity: ScActivityLog,
        private readonly clock: Clock,
    ) {}

    async execute(input: GetLevelingInput): Promise<Result<LevelingDto, DomainError>> {
        const granted = await this.access.buyerPackage(input.userId, input.packageId, ['sc.readPrices']);
        if (!granted.ok) return granted;
        const { pkg } = granted.value;
        const now = this.clock.now();
        const today = bangkokToday(now);
        const threshold = (await this.settings.get(pkg.buyerWorkspaceId)).levelingThreshold;

        const invitations = await this.packages.listInvitations(pkg.id);
        const latest = await this.bids.latestSubmitted(invitations.map(i => i.id));
        const vendorIds = [...new Set(invitations.map(i => i.vendorWorkspaceId).filter((v): v is WorkspaceId => v !== null))];
        const cards = await this.vendors.cards(vendorIds);
        const stats = await this.stats.forBuyer(pkg.buyerWorkspaceId, vendorIds);

        const columns: { bidder: LevelingDto['bidders'][number]; cells: LevelingDto['lines'][number]['cells'] }[] = [];
        for (const invitation of invitations) {
            const bid = latest.get(invitation.id);
            if (bid === undefined) continue;
            const props = bid.toProps();
            const outdated = isOutdated(bid, pkg);
            const view = outdated
                ? levelOutdatedBid(pkg.lines, await linesOfBidVersion(this.packages, pkg, props.packageVersion), pricingOf(bid), props.total, threshold)
                : levelBid(pkg.lines, pricingOf(bid), threshold);
            const vendorWs = invitation.vendorWorkspaceId;
            const card = vendorWs === null ? undefined : cards.get(vendorWs);
            const stat = vendorWs === null ? undefined : stats.get(vendorWs);
            columns.push({
                bidder: {
                    bidId: props.id,
                    invitationId: invitation.id,
                    displayName: invitation.displayName,
                    vendorWorkspaceId: vendorWs,
                    tier: card?.tier ?? null,
                    version: props.version,
                    mode: props.mode,
                    total: props.total,
                    normalizedTotal: view.normalizedTotal,
                    diffPct: view.diffPct,
                    flag: view.flag,
                    days: props.days,
                    earliestStart: props.earliestStart,
                    crewSkilled: props.crewSkilled,
                    crewLabourers: props.crewLabourers,
                    validUntil: props.validUntil,
                    expired: props.validUntil !== null && props.validUntil < today,
                    installmentsProposal: props.installmentsProposal,
                    answers: props.answers,
                    note: props.note,
                    enteredByBuyer: props.enteredByBuyer,
                    outdated,
                    ratingFromUs: stat?.ratingFromUs ?? null,
                    completedWithUs: stat?.completedWithUs ?? 0,
                },
                cells: view.cells.map(c => ({ bidId: props.id, ...c })),
            });
        }
        columns.sort((a, b) => Number(a.bidder.outdated) - Number(b.bidder.outdated) || a.bidder.normalizedTotal - b.bidder.normalizedTotal);

        await this.activity.record({
            buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'prices.viewed',
            actorUserId: input.userId, data: { view: 'leveling', bidders: columns.length }, at: now,
        });
        return ok({
            packageId: pkg.id,
            version: pkg.version,
            estimateTotal: pkg.estimateTotal,
            threshold,
            questions: pkg.terms.questions,
            bidders: columns.map(c => c.bidder),
            lines: pkg.lines.map((l, k) => ({
                idx: l.idx, desc: l.desc, unit: l.unit, qtyPriced: l.qtyPriced, estUnit: estimateUnitOf(l), estTotal: l.estTotal,
                cells: columns.map(c => {
                    const cell = c.cells[k];
                    if (cell === undefined) throw new Error('leveling cell missing');
                    return cell;
                }),
            })),
        });
    }
}
