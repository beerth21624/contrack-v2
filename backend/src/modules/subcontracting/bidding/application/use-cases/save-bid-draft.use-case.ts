// ─── PUT /vendor/invitations/:id/bid-draft: autosave of the bid form (any field may still be missing) ───
import { Injectable } from '@nestjs/common';
import type { BidDto, SaveBidDraftRequest } from '@contrack/contract';
import { remapBidLines } from '@contrack/domain/subcontracting/leveling';
import { Clock, FileService, IdGenerator } from '../../../../../shared/application/ports';
import { DomainError, type Result, type UserId, err, ok } from '../../../../../shared/domain';
import { asBidId, type ScInvitationId } from '../../../shared/ids';
import { PackageDirectory, type PackageView } from '../../../shared/ports';
import { Bid } from '../../domain/entities/bid.entity';
import { type BidInput, checkBidShape, priceBid } from '../../domain/policies/bid-pricing.policy';
import { BiddingAccess } from '../bidding-access';
import { biddingOpen, linesOfBidVersion, vendorInvitationActive } from '../bidding-rules';
import { BidPresenter } from '../bid-presenter';
import { bidChangedMeanwhile } from '../concurrency';
import { BidRepository, BidVersionTaken } from '../ports/bid.repository';

export interface SaveBidDraftInput {
    userId: UserId;
    invitationId: ScInvitationId;
    body: SaveBidDraftRequest;
}

function emptyInput(pkg: PackageView): BidInput {
    return {
        mode: pkg.pricingMode === 'lump' ? 'lump' : 'unit', lines: [], lumpTotal: null, adjustment: 0, adjustmentNote: '',
        inclusions: '', days: null, earliestStart: null, crewSkilled: null, crewLabourers: null, validUntil: pkg.priceValidUntil,
        installmentsProposal: null, answers: [], note: '', photoFileIds: [],
    };
}

@Injectable()
export class SaveBidDraftUseCase {
    constructor(
        private readonly access: BiddingAccess,
        private readonly packages: PackageDirectory,
        private readonly bids: BidRepository,
        private readonly files: FileService,
        private readonly presenter: BidPresenter,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: SaveBidDraftInput): Promise<Result<BidDto, DomainError>> {
        const granted = await this.access.vendorInvitation(input.userId, input.invitationId, ['vendor.bid.draft']);
        if (!granted.ok) return granted;
        const { invitation, pkg } = granted.value;
        const on = await this.access.buyerModuleOn(pkg.buyerWorkspaceId);
        if (!on.ok) return on;
        const now = this.clock.now();
        const open = biddingOpen(pkg, now);
        if (!open.ok) return open;
        const active = vendorInvitationActive(invitation);
        if (!active.ok) return active;

        const draft = await this.bids.findDraft(invitation.id);
        let base: BidInput = emptyInput(pkg);
        if (draft !== undefined) {
            const c = draft.content;
            let lines = c.lines.map(l => ({ idx: l.idx, unitPrice: l.unitPrice, matUnitPrice: l.matUnitPrice, excluded: l.excluded, reason: l.reason }));
            if (draft.packageVersion !== pkg.version) {
                // An addendum since the last save: keep the prices of lines that still exist.
                const from = await linesOfBidVersion(this.packages, pkg, draft.packageVersion);
                lines = remapBidLines(lines, from, pkg.lines);
            }
            base = { ...c, lines };
        }
        const b = input.body;
        const merged: BidInput = {
            mode: b.mode ?? base.mode,
            lines: b.lines ?? base.lines,
            lumpTotal: b.lumpTotal !== undefined ? b.lumpTotal : base.lumpTotal,
            adjustment: b.adjustment ?? base.adjustment,
            adjustmentNote: b.adjustmentNote ?? base.adjustmentNote,
            inclusions: b.inclusions ?? base.inclusions,
            days: b.days !== undefined ? b.days : base.days,
            earliestStart: b.earliestStart !== undefined ? b.earliestStart : base.earliestStart,
            crewSkilled: b.crewSkilled !== undefined ? b.crewSkilled : base.crewSkilled,
            crewLabourers: b.crewLabourers !== undefined ? b.crewLabourers : base.crewLabourers,
            validUntil: b.validUntil !== undefined ? b.validUntil : base.validUntil,
            installmentsProposal: b.installmentsProposal !== undefined ? b.installmentsProposal : base.installmentsProposal,
            answers: b.answers ?? base.answers,
            note: b.note ?? base.note,
            photoFileIds: b.photoFileIds ?? base.photoFileIds,
        };
        const shape = checkBidShape(pkg.lines, pkg.pricingMode, merged);
        if (!shape.ok) return shape;
        if (merged.answers.length > pkg.terms.questions.length) {
            return err(DomainError.unprocessable('More answers than questions', { reason: 'answers_mismatch', expected: pkg.terms.questions.length }));
        }
        const known = new Set(draft?.content.photoFileIds ?? []);
        const newPhotos = merged.photoFileIds.filter(id => !known.has(id));
        if (newPhotos.length > 0) {
            const mine = await this.files.assertUploadedBy(newPhotos, input.userId);
            if (!mine.ok) return mine;
        }

        const content = priceBid(pkg.lines, merged);
        let saved: Bid;
        if (draft === undefined) {
            saved = Bid.draft({
                id: asBidId(this.ids.newId()), buyerWorkspaceId: pkg.buyerWorkspaceId, packageId: pkg.id, invitationId: invitation.id,
                vendorWorkspaceId: invitation.vendorWorkspaceId, packageVersion: pkg.version,
            }, content, now);
            try {
                await this.bids.insert(saved);
            } catch (error) {
                // Two first autosaves of one invitation at the same time: the later one is refused, not a 500.
                if (error instanceof BidVersionTaken) return err(bidChangedMeanwhile());
                throw error;
            }
        } else {
            draft.revise(content, pkg.version, now);
            await this.bids.update(draft);
            saved = draft;
        }
        return ok(await this.presenter.one(saved, pkg.version));
    }
}
