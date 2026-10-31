// ─── Ports between the three work streams of the subcontracting module ───
// sourcing  (vendor profiles, vendor lists, packages, invitations, questions)  provides PackageDirectory, VendorDirectory
// bidding   (bids, negotiation, leveling, award, vendor inbox)                provides BidDirectory
// contracts (subcontracts, variations, claims, retention, ratings, settings)   provides SubcontractCreator,
//            SubcontractingSettingsReader, VendorStats, VendorLinkListener (+ registers its running work in ModuleWorkRegistry)
// A stream never imports another stream's files: only these ports (abstract classes = Nest DI tokens).
// Writes through a port join the caller's UnitOfWork transaction (repositories use DatabaseContext.executor).
import type {
    BidMode, BidStatus, InstallmentDto, InvitationStatus, InviteChannel, LocationDto, PackageStatus, PackageTerms,
    PricingMode, ScheduleDto, SourcingMode, SubcontractingSettingsDto, SupplyMode, TradeId, VendorTier,
} from '@contrack/contract';
import type { SnapshotLine } from '@contrack/domain/subcontracting';
import type { ProjectId, UserId, WorkspaceId } from '../../../shared/domain/ids';
import type { BidId, PackageId, ScInvitationId, SubcontractId, VendorListEntryId } from './ids';

// ── provided by sourcing ──

/** A package with its CURRENT version's lines. */
export interface PackageView {
    id: PackageId;
    buyerWorkspaceId: WorkspaceId;
    buyerName: string;
    projectId: ProjectId;
    projectName: string;
    title: string;
    trade: TradeId;
    status: PackageStatus;
    version: number;
    sourcingMode: SourcingMode;
    pricingMode: PricingMode;
    supplyMode: SupplyMode;
    description: string;
    terms: PackageTerms;
    schedule: ScheduleDto;
    installments: InstallmentDto[];
    location: LocationDto;
    hideOwnerIdentity: boolean;
    bidDeadline: Date;
    priceValidUntil: string;
    estimateTotal: number;
    lines: SnapshotLine[];
    createdBy: UserId;
    sentAt: Date | null;
    awardedAt: Date | null;
}

export interface InvitationView {
    id: ScInvitationId;
    packageId: PackageId;
    buyerWorkspaceId: WorkspaceId;
    vendorListEntryId: VendorListEntryId;
    /** null until the invitee signs in (OTP) through the link or already had an account with that phone. */
    vendorWorkspaceId: WorkspaceId | null;
    displayName: string;
    phone: string;
    channel: InviteChannel;
    status: InvitationStatus;
    sentAt: Date;
    viewedAt: Date | null;
}

export abstract class PackageDirectory {
    /** Unscoped read: callers check access to `buyerWorkspaceId` (buyer) or to the invitation's vendor themselves. */
    abstract findPackage(id: PackageId): Promise<PackageView | undefined>;
    /** Lines of an older version (bids may point at the version they were made for). */
    abstract linesOfVersion(id: PackageId, version: number): Promise<SnapshotLine[] | undefined>;
    abstract findInvitation(id: ScInvitationId): Promise<InvitationView | undefined>;
    abstract listInvitations(packageId: PackageId): Promise<InvitationView[]>;
    abstract listPackagesOfProject(buyerWorkspaceId: WorkspaceId, projectId: ProjectId): Promise<PackageView[]>;
    abstract listInvitationsOfVendor(vendorWorkspaceId: WorkspaceId): Promise<InvitationView[]>;
    /** Bidding: the invitee submitted a bid (status → submitted). */
    abstract markSubmitted(invitationId: ScInvitationId, at: Date): Promise<void>;
    /** Bidding: the invitee withdrew its bid (status → viewed). */
    abstract markBidWithdrawn(invitationId: ScInvitationId): Promise<void>;
    /**
     * Bidding, FIRST thing inside the award transaction: locks the package row and, only when it is still open /
     * reviewing / expired, sets package → awarded; winners → won; other invitees with a submitted bid → lost; the rest →
     * closed. Returns false (and changes nothing) when the package is already awarded / cancelled / closed, so a
     * double-clicked or concurrent award can be refused before anything else is written.
     */
    abstract markAwarded(packageId: PackageId, winners: readonly ScInvitationId[], at: Date): Promise<boolean>;
    /** Contracts: every subcontract of an awarded package was cancelled before it started → package back to reviewing. */
    abstract reopenAfterCancel(packageId: PackageId, at: Date): Promise<void>;
    /** Contracts: the package is finished (all its subcontracts closed / ended). */
    abstract markClosed(packageId: PackageId, at: Date): Promise<void>;
}

export interface VendorCardView {
    workspaceId: WorkspaceId;
    teamName: string;
    phone: string;
    tier: VendorTier;
    profileComplete: boolean;
    vatRegistered: boolean;
}

export abstract class VendorDirectory {
    abstract cards(vendorWorkspaceIds: readonly WorkspaceId[]): Promise<Map<WorkspaceId, VendorCardView>>;
    /** Name of a vendor-list entry (what the buyer calls the crew), for invitees without an account. */
    abstract entryNames(entryIds: readonly VendorListEntryId[]): Promise<Map<VendorListEntryId, string>>;
}

// ── provided by bidding ──

export interface BidLineView {
    idx: number;
    unitPrice: number | null;
    matUnitPrice: number | null;
    excluded: boolean;
    reason: string;
    total: number;
}

export interface BidView {
    id: BidId;
    invitationId: ScInvitationId;
    packageId: PackageId;
    packageVersion: number;
    version: number;
    status: BidStatus;
    mode: BidMode;
    lines: BidLineView[];
    lumpTotal: number | null;
    adjustment: number;
    total: number;
    days: number | null;
    earliestStart: string | null;
    validUntil: string | null;
    installmentsProposal: InstallmentDto[] | null;
    enteredByBuyer: boolean;
    submittedAt: Date | null;
}

export abstract class BidDirectory {
    /** The latest submitted (not withdrawn) bid of each invitation that has one. */
    abstract latestSubmitted(invitationIds: readonly ScInvitationId[]): Promise<Map<ScInvitationId, BidView>>;
    abstract find(bidId: BidId): Promise<BidView | undefined>;
    /**
     * Contracts, when every subcontract of an awarded package was cancelled before it started: selected / not_selected
     * bids go back to submitted so the package can be awarded again (runs in the caller's transaction).
     */
    abstract resetDecisions(packageId: PackageId): Promise<void>;
}

// ── provided by contracts ──

export interface AwardedLine {
    idx: number;
    desc: string;
    unit: string;
    qty: number;
    unitPrice: number | null;
    matUnitPrice: number | null;
    total: number;
}

/** One winner of an award, priced by bidding (adjustment already spread over the awarded lines). */
export interface AwardedPart {
    package: PackageView;
    invitation: InvitationView;
    bid: BidView;
    /** Display name of the winner (vendor team name, else the buyer's vendor-list name). */
    vendorName: string;
    lines: AwardedLine[];
    total: number;
    installments: InstallmentDto[];
    decidedBy: UserId;
    at: Date;
}

export abstract class SubcontractCreator {
    /** Creates the subcontract (status pending_acceptance) inside the caller's transaction. Notifications: the caller, after commit. */
    abstract create(part: AwardedPart): Promise<SubcontractId>;
}

export abstract class SubcontractingSettingsReader {
    /** Saved settings, or DEFAULT_SUBCONTRACTING_SETTINGS. */
    abstract get(workspaceId: WorkspaceId): Promise<SubcontractingSettingsDto>;
}

export interface VendorStatsView {
    lastEngagedAt: Date | null;
    /** Average of every score the buyer gave the vendor (1–5), null when none. */
    ratingFromUs: number | null;
    completedWithUs: number;
}

export abstract class VendorStats {
    abstract forBuyer(buyerWorkspaceId: WorkspaceId, vendorWorkspaceIds: readonly WorkspaceId[]): Promise<Map<WorkspaceId, VendorStatsView>>;
}

/** Sourcing tells contracts when an invitation gets linked to a vendor account (subcontracts awarded before sign-up). */
export abstract class VendorLinkListener {
    abstract onInvitationLinked(invitationId: ScInvitationId, vendorWorkspaceId: WorkspaceId): Promise<void>;
}

// ── shared (written by the coordinator) ──

export interface ScActivityRecord {
    buyerWorkspaceId: WorkspaceId;
    vendorWorkspaceId?: WorkspaceId | null;
    entity: 'package' | 'invitation' | 'bid' | 'subcontract' | 'claim' | 'variation' | 'vendor';
    entityId: string;
    action: string;
    actorUserId: UserId | null;
    data?: Record<string, unknown>;
    at: Date;
}

export abstract class ScActivityLog {
    abstract record(entry: ScActivityRecord): Promise<void>;
    /** Newest first (tests, audit views). */
    abstract listForEntity(entity: ScActivityRecord['entity'], entityId: string, limit: number): Promise<ScActivityRecord[]>;
}
