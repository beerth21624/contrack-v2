// ─── Builds the contract DTOs of sourcing (buyer views with estimates, vendor/guest views without) ───
// Buyer DTOs carry estimates only when the caller may read prices (else 0 / null). The guest view is built field by
// field from a separate mapper so no estimate, other bidder or private note can leak into it.
import { Injectable } from '@nestjs/common';
import type {
    BuyerPackageDto, BuyerPackageLineDto, GuestPackageDto, PackageLineDto, PackageStatus, PackageSummaryDto, QuestionDto,
    ScInvitationDto, VendorListEntryDto,
} from '@contrack/contract';
import { computeProject } from '@contrack/domain/project';
import { type SnapshotLine, snapshotDrift } from '@contrack/domain/subcontracting';
import { Clock, FileService, ProjectReader, WorkspaceDirectory } from '../../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../../shared/domain/ids';
import { BidDirectory, type BidView, VendorStats, type VendorStatsView } from '../../../shared/ports';
import type { ScInvitationId } from '../../../shared/ids';
import type { PackageQuestion } from '../../domain/entities/package-question.entity';
import type { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import type { VendorListEntry } from '../../domain/entities/vendor-list-entry.entity';
import type { VendorProfile } from '../../domain/entities/vendor-profile.entity';
import type { WorkPackage } from '../../domain/entities/work-package.entity';
import { maskPhone } from '../../domain/value-objects/phone.value-object';
import { InvitationRepository, QuestionRepository, VendorProfileRepository } from '../ports/sourcing.repositories';

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d === null ? null : d.toISOString());

/** An invitee has a bid in (submitted, or decided). */
export function hasSubmitted(invitations: readonly ScInvitation[]): boolean {
    return invitations.some(i => i.status === 'submitted' || i.status === 'won' || i.status === 'lost');
}

/** What a vendor may see of a line: quantities and who supplies material — never the estimate or the BOQ key. */
export function vendorLine(l: SnapshotLine): PackageLineDto {
    return {
        idx: l.idx, section: l.section, sectionTitle: l.sectionTitle, desc: l.desc, unit: l.unit, qtyNet: l.qtyNet,
        qtyGross: l.qtyGross, qtyPriced: l.qtyPriced, qtyMaterial: l.qtyMaterial, labourBasis: l.labourBasis, materialBy: l.materialBy,
    };
}

function buyerLine(l: SnapshotLine, prices: boolean): BuyerPackageLineDto {
    return {
        ...vendorLine(l), lineKey: l.lineKey,
        estLabUnit: prices ? l.estLabUnit : 0, estMatUnit: prices ? l.estMatUnit : 0, estTotal: prices ? l.estTotal : 0,
    };
}

@Injectable()
export class SourcingViews {
    constructor(
        private readonly invitations: InvitationRepository,
        private readonly questions: QuestionRepository,
        private readonly profiles: VendorProfileRepository,
        private readonly bids: BidDirectory,
        private readonly stats: VendorStats,
        private readonly files: FileService,
        private readonly workspaces: WorkspaceDirectory,
        private readonly projects: ProjectReader,
        private readonly clock: Clock,
    ) {}

    status(pkg: WorkPackage, invitations: readonly ScInvitation[]): PackageStatus {
        return pkg.effectiveStatus(this.clock.now(), hasSubmitted(invitations));
    }

    async summaries(pkgs: readonly WorkPackage[], prices: boolean): Promise<PackageSummaryDto[]> {
        const invitations = await this.invitations.listByPackages(pkgs.map(p => p.id));
        const bids = prices ? await this.bids.latestSubmitted(invitations.filter(i => i.isCurrent).map(i => i.id)) : new Map<ScInvitationId, BidView>();
        return pkgs.map(pkg => this.summary(pkg, invitations.filter(i => i.packageId === pkg.id), bids, prices));
    }

    async buyerPackage(pkg: WorkPackage, prices: boolean): Promise<BuyerPackageDto> {
        const invitations = await this.invitations.listByPackage(pkg.id);
        const bids = prices ? await this.bids.latestSubmitted(invitations.filter(i => i.isCurrent).map(i => i.id)) : new Map<ScInvitationId, BidView>();
        const p = pkg.props;
        const read = await this.projects.read(p.projectId);
        const drift = read === undefined ? [] : snapshotDrift(pkg.lines, computeProject(read.project).boq);
        return {
            ...this.summary(pkg, invitations, bids, prices),
            projectName: read?.name ?? p.projectName,
            description: p.description,
            supplyMode: p.supplyMode,
            pricingMode: p.pricingMode,
            terms: structuredClone(p.terms),
            schedule: { ...p.schedule },
            installments: p.installments.map(i => ({ ...i })),
            location: { ...p.location },
            hideOwnerIdentity: p.hideOwnerIdentity,
            priceValidUntil: p.priceValidUntil,
            lines: pkg.lines.map(l => buyerLine(l, prices)),
            files: await this.files.describe(p.fileIds),
            boqDrift: drift,
            versions: p.versions.map(v => ({ version: v.version, note: v.note, createdAt: iso(v.createdAt) })),
            createdBy: p.createdBy,
            awardedAt: isoOrNull(p.awardedAt),
            cancelledAt: isoOrNull(p.cancelledAt),
            cancelReason: p.cancelReason,
        };
    }

    async invitationDtos(pkg: WorkPackage, invitations: readonly ScInvitation[], prices: boolean): Promise<ScInvitationDto[]> {
        const bids = await this.bids.latestSubmitted(invitations.map(i => i.id));
        const linked = invitations.map(i => i.vendorWorkspaceId).filter((w): w is WorkspaceId => w !== null);
        const profiles = new Map((await this.profiles.findMany(linked)).map(pr => [pr.workspaceId, pr]));
        return invitations.map(inv => {
            const i = inv.props;
            const bid = bids.get(i.id);
            return {
                id: i.id,
                packageId: i.packageId,
                vendorListEntryId: i.vendorListEntryId,
                displayName: i.displayName,
                phone: i.phone,
                vendorWorkspaceId: i.vendorWorkspaceId,
                tier: i.vendorWorkspaceId === null ? null : profiles.get(i.vendorWorkspaceId)?.props.tier ?? null,
                channel: i.channel,
                status: i.status,
                sentAt: iso(i.sentAt),
                viewedAt: isoOrNull(i.viewedAt),
                declinedAt: isoOrNull(i.declinedAt),
                declineReason: i.declineReason,
                declineNote: i.declineNote,
                latestBid: bid === undefined ? null : {
                    id: bid.id, version: bid.version, total: prices ? bid.total : 0, submittedAt: iso(bid.submittedAt ?? i.sentAt),
                    enteredByBuyer: bid.enteredByBuyer, outdated: bid.packageVersion < pkg.version,
                },
                resentCount: i.resentCount,
            };
        });
    }

    /** Buyer view: who asked (the invitee's name in the buyer's list). */
    buyerQuestion(q: PackageQuestion, invitations: readonly ScInvitation[]): QuestionDto {
        const asker = invitations.find(i => i.id === q.props.invitationId);
        return { ...questionBase(q), askedBy: asker?.props.displayName ?? null, mine: false };
    }

    /** Vendor view: answered questions of everyone (anonymous) + the caller's own. */
    vendorQuestions(questions: readonly PackageQuestion[], invitationId: ScInvitationId): QuestionDto[] {
        return questions.filter(q => q.props.answer !== null || q.props.invitationId === invitationId)
            .map(q => ({ ...questionBase(q), askedBy: null, mine: q.props.invitationId === invitationId }));
    }

    async guestPackage(pkg: WorkPackage, invitation: ScInvitation): Promise<GuestPackageDto> {
        const p = pkg.props;
        const i = invitation.props;
        const all = await this.invitations.listByPackage(pkg.id);
        const packageStatus = this.status(pkg, all);
        const revealed = !p.hideOwnerIdentity || (i.status === 'won' && (p.status === 'awarded' || p.status === 'closed'));
        const names = await this.workspaces.names([p.buyerWorkspaceId]);
        const current = pkg.current;
        const outcome: GuestPackageDto['outcome'] = p.status === 'cancelled' ? 'cancelled'
            : i.status === 'won' ? 'won'
                : i.status === 'lost' || ((p.status === 'awarded' || p.status === 'closed') && i.status !== 'withdrawn') ? 'lost' : 'pending';
        return {
            invitationId: i.id,
            invitationStatus: i.status,
            packageStatus,
            buyerName: names.get(p.buyerWorkspaceId) ?? '',
            projectName: revealed ? p.projectName : '',
            title: p.title,
            trade: p.trade,
            description: p.description,
            location: { district: p.location.district, province: p.location.province, address: revealed ? p.location.address : '' },
            schedule: { ...p.schedule },
            supplyMode: p.supplyMode,
            pricingMode: p.pricingMode,
            terms: structuredClone(p.terms),
            installments: p.installments.map(x => ({ no: x.no, pct: x.pct, condition: x.condition })),
            bidDeadline: iso(p.bidDeadline),
            priceValidUntil: p.priceValidUntil,
            version: current.version,
            lines: current.lines.map(vendorLine),
            addendumNote: current.version > 1 ? current.note : null,
            changedLineIdx: current.version > 1 ? [...current.changedIdx] : [],
            files: await this.files.describe(p.fileIds),
            questions: this.vendorQuestions(await this.questions.listByPackage(pkg.id), i.id),
            linkedToVendor: i.vendorWorkspaceId !== null,
            invitedPhoneMasked: maskPhone(i.phone),
            invitedDisplayName: i.displayName,
            outcome,
        };
    }

    async vendorListEntries(buyerWorkspaceId: WorkspaceId, entries: readonly VendorListEntry[]): Promise<VendorListEntryDto[]> {
        const linked = entries.map(e => e.vendorWorkspaceId).filter((w): w is WorkspaceId => w !== null);
        const profiles = new Map((await this.profiles.findMany(linked)).map(pr => [pr.workspaceId, pr]));
        const complete = await this.completeness([...profiles.values()]);
        const stats = linked.length === 0 ? new Map<WorkspaceId, VendorStatsView>() : await this.stats.forBuyer(buyerWorkspaceId, linked);
        return entries.map(entry => {
            const e = entry.props;
            const profile = e.vendorWorkspaceId === null ? undefined : profiles.get(e.vendorWorkspaceId);
            const s = e.vendorWorkspaceId === null ? undefined : stats.get(e.vendorWorkspaceId);
            return {
                id: e.id,
                displayName: e.displayName,
                phone: e.phone,
                lineId: e.lineId,
                trades: [...e.trades],
                province: e.province,
                privateNote: e.privateNote,
                vendorWorkspaceId: e.vendorWorkspaceId,
                hasAccount: e.vendorWorkspaceId !== null,
                tier: profile?.props.tier ?? null,
                profileComplete: profile === undefined ? false : complete.get(profile.workspaceId) ?? false,
                lastEngagedAt: s === undefined || s.lastEngagedAt === null ? null : iso(s.lastEngagedAt),
                ratingFromUs: s?.ratingFromUs ?? null,
                completedWithUs: s?.completedWithUs ?? 0,
                hidden: e.hiddenAt !== null,
                createdAt: iso(e.createdAt),
            };
        });
    }

    /** profileComplete of each profile (needs its portfolio count). */
    async completeness(profiles: readonly VendorProfile[]): Promise<Map<WorkspaceId, boolean>> {
        const out = new Map<WorkspaceId, boolean>();
        for (const pr of profiles) out.set(pr.workspaceId, pr.isComplete((await this.profiles.listPortfolio(pr.workspaceId)).length));
        return out;
    }

    private summary(pkg: WorkPackage, invitations: readonly ScInvitation[], bids: ReadonlyMap<ScInvitationId, BidView>, prices: boolean): PackageSummaryDto {
        const p = pkg.props;
        const current = invitations.filter(i => i.isCurrent);
        const totals = current.map(i => bids.get(i.id)?.total).filter((t): t is number => t !== undefined);
        return {
            id: p.id,
            projectId: p.projectId,
            buyerWorkspaceId: p.buyerWorkspaceId,
            title: p.title,
            trade: p.trade,
            status: this.status(pkg, invitations),
            version: pkg.version,
            sourcingMode: p.sourcingMode,
            bidDeadline: iso(p.bidDeadline),
            estimateTotal: prices ? p.estimateTotal : 0,
            bestBidTotal: prices && totals.length > 0 ? Math.min(...totals) : null,
            invitations: {
                total: current.length,
                viewed: current.filter(i => i.props.viewedAt !== null).length,
                submitted: current.filter(i => i.status === 'submitted' || i.status === 'won' || i.status === 'lost').length,
                declined: current.filter(i => i.status === 'declined').length,
            },
            createdAt: iso(p.createdAt),
            sentAt: isoOrNull(p.sentAt),
        };
    }
}

function questionBase(q: PackageQuestion): Omit<QuestionDto, 'askedBy' | 'mine'> {
    const p = q.props;
    return { id: p.id, question: p.question, answer: p.answer, askedAt: iso(p.askedAt), answeredAt: isoOrNull(p.answeredAt) };
}
