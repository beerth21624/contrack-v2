// ─── Recording a new submitted version (vendor submit and the buyer's manual bid share it) ───
// Checks the bid against the package's current lines, then in one transaction: insert version + 1, invitation →
// submitted, package re-checked (an award that won the race is refused), the previous submitted version →
// superseded (compare-and-set), draft removed (vendor), activity. Two submissions racing on one invitation: the
// unique (invitation, version) makes the later one a 409 (rolled back), never a 500.
import { Injectable } from '@nestjs/common';
import { Clock, FileService, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import type { DomainError, Result, UserId } from '../../../../shared/domain';
import { asBidId } from '../../shared/ids';
import { type InvitationView, PackageDirectory, type PackageView, ScActivityLog } from '../../shared/ports';
import { Bid } from '../domain/entities/bid.entity';
import { type BidInput, checkSubmission, priceBid } from '../domain/policies/bid-pricing.policy';
import { acceptsManualBid } from './bidding-rules';
import { ConcurrentChange, runRefusingRaces } from './concurrency';
import { BidRepository } from './ports/bid.repository';

export interface NewVersionInput {
    userId: UserId;
    pkg: PackageView;
    invitation: InvitationView;
    input: BidInput;
    enteredByBuyer: boolean;
}

@Injectable()
export class BidSubmission {
    constructor(
        private readonly packages: PackageDirectory,
        private readonly bids: BidRepository,
        private readonly files: FileService,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async submit(args: NewVersionInput): Promise<Result<Bid, DomainError>> {
        const { pkg, invitation, input } = args;
        const valid = checkSubmission(pkg.lines, pkg.pricingMode, pkg.terms.questions.length, input);
        if (!valid.ok) return valid;

        // Photos already on this invitation's draft / versions may come from a teammate; new ones must be the caller's.
        const draft = await this.bids.findDraft(invitation.id);
        const previous = await this.bids.listSubmittedOfInvitation(invitation.id);
        const known = new Set([...(draft?.content.photoFileIds ?? []), ...previous.flatMap(b => b.content.photoFileIds)]);
        const newPhotos = [...new Set(input.photoFileIds)].filter(id => !known.has(id));
        if (newPhotos.length > 0) {
            const mine = await this.files.assertUploadedBy(newPhotos, args.userId);
            if (!mine.ok) return mine;
        }

        const content = priceBid(pkg.lines, input);
        const now = this.clock.now();
        return runRefusingRaces(this.uow, async () => {
            const version = (await this.bids.maxVersion(invitation.id)) + 1;
            const created = Bid.submitted({
                id: asBidId(this.ids.newId()), buyerWorkspaceId: pkg.buyerWorkspaceId, packageId: pkg.id, invitationId: invitation.id,
                vendorWorkspaceId: invitation.vendorWorkspaceId, packageVersion: pkg.version, version,
                enteredByBuyer: args.enteredByBuyer, submittedBy: args.userId,
            }, content, now);
            await this.bids.insert(created); // BidVersionTaken when another submission took this version → 409
            // Invitation row before bid rows (same order as an award); waits for an award holding it, then re-checks.
            await this.packages.markSubmitted(invitation.id, now);
            const current = await this.packages.findPackage(pkg.id);
            const still = current !== undefined && (args.enteredByBuyer ? acceptsManualBid(current).ok : current.status === 'open');
            if (!still) {
                throw new ConcurrentChange('package_not_open', 'The package is not taking bids', { status: current?.status ?? null });
            }
            for (const older of await this.bids.listSubmittedOfInvitation(invitation.id)) {
                if (older.id !== created.id && older.supersede(now)) await this.bids.transition(older, 'submitted');
            }
            if (!args.enteredByBuyer) await this.bids.deleteDraft(invitation.id);
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, vendorWorkspaceId: invitation.vendorWorkspaceId, entity: 'bid',
                entityId: created.id, action: args.enteredByBuyer ? 'bid.entered_by_buyer' : 'bid.submitted', actorUserId: args.userId,
                data: { invitationId: invitation.id, version, total: content.total, packageVersion: pkg.version }, at: now,
            });
            return created;
        });
    }
}
