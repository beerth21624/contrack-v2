// ─── Test kit of the contracts stream: in-memory repositories, platform fakes, fakes of the sourcing / bidding ports ───
// Not a spec itself; imported by the *.spec.ts files next to the code they test.
import type { InstallmentDto, PackageStatus, Role } from '@contrack/contract';
import { computeProject, createProject } from '@contrack/domain/project';
import { type SnapshotLine, buildSnapshot, subcontractableRows } from '@contrack/domain/subcontracting/snapshot';
import { UserDirectory, type UserProfile } from '../../../../shared/application/ports';
import { asProjectId, asUserId, asWorkspaceId, type ProjectId, type UserId, type WorkspaceId } from '../../../../shared/domain';
import { AppConfig, testEnv } from '../../../../shared/infrastructure/config/env';
import { InMemoryUnitOfWork } from '../../../../shared/infrastructure/database/database';
import { FixedClock, SequentialIdGenerator } from '../../../../shared/infrastructure/system';
import {
    FakeFileService, FakeModuleFlags, FakeProjects, FakeRoles, FakeWorkspaceDirectory, RecordingNotifier,
} from '../../../../shared/testing/platform-fakes';
import { InMemoryScActivityLog } from '../../shared/activity-log.adapters';
import {
    type PackageId, type ScInvitationId, type SubcontractId, type VendorListEntryId, asBidId, asClaimId, asPackageId,
    asScInvitationId, asVendorListEntryId,
} from '../../shared/ids';
import {
    type AwardedLine, BidDirectory, type BidView, type InvitationView, PackageDirectory, type PackageView, VendorDirectory,
    type VendorCardView,
} from '../../shared/ports';
import { ScAccess } from '../../shared/sc-access';
import { ContractAccess } from '../application/contract-access';
import { ContractNotices } from '../application/contract-notices';
import { ContractViews } from '../application/contract-views';
import { PackageFollowUp } from '../application/package-follow-up';
import { RetentionDueSweep } from '../application/retention-due-sweep';
import {
    ApproveClaimUseCase, InspectClaimUseCase, ListClaimsUseCase, PayClaimUseCase, RejectClaimUseCase, RequestClaimUseCase,
} from '../application/use-cases/claims.use-case';
import { CreateSubcontractUseCase } from '../application/use-cases/create-subcontract.use-case';
import { ListProjectSubcontractsUseCase, ListVendorSubcontractsUseCase, ListWorkspaceRetentionUseCase } from '../application/use-cases/lists.use-case';
import { GetOverviewUseCase, GetReportUseCase, ProjectFactsLoader } from '../application/use-cases/overview.use-case';
import { ListRetentionUseCase, MoveRetentionUseCase } from '../application/use-cases/retention.use-case';
import { GetScSettingsUseCase, GetTradeChecklistsUseCase, PutScSettingsUseCase } from '../application/use-cases/settings.use-case';
import {
    AcceptSubcontractUseCase, AttachSignedScanUseCase, CancelSubcontractUseCase, CloseSubcontractUseCase,
    CompleteSubcontractUseCase, GetContractDocumentUseCase, GetSubcontractUseCase, RateSubcontractUseCase,
    RequestContractChangeUseCase, TerminateSubcontractUseCase, UpdateContractDocumentUseCase,
} from '../application/use-cases/subcontract-lifecycle.use-case';
import { ListVariationsUseCase, ProposeVariationUseCase, RespondVariationUseCase } from '../application/use-cases/variations.use-case';
import {
    RepositoryModuleUsage, RepositorySettingsReader, RepositoryVendorLinkListener, RepositoryVendorStats,
} from '../infrastructure/adapters/contracts-ports.adapters';
import { InMemoryClaimRepository } from '../infrastructure/adapters/in-memory-claim.repository';
import { InMemoryContractDocumentRepository } from '../infrastructure/adapters/in-memory-contract-document.repository';
import { InMemoryRatingRepository } from '../infrastructure/adapters/in-memory-rating.repository';
import { InMemoryRetentionRepository } from '../infrastructure/adapters/in-memory-retention.repository';
import { InMemoryScSettingsRepository } from '../infrastructure/adapters/in-memory-sc-settings.repository';
import { InMemorySubcontractRepository } from '../infrastructure/adapters/in-memory-subcontract.repository';
import { InMemoryVariationRepository } from '../infrastructure/adapters/in-memory-variation.repository';

const uid = (n: number): string => `00000000-0000-4000-a000-${n.toString(16).padStart(12, '0')}`;

export const BUYER_WS = asWorkspaceId(uid(0x100));
export const VENDOR_WS = asWorkspaceId(uid(0x200));
export const OTHER_VENDOR_WS = asWorkspaceId(uid(0x300));
export const PROJECT = asProjectId(uid(0x400));

export const BUYER: Record<Role, UserId> = {
    owner: asUserId(uid(0x11)), admin: asUserId(uid(0x12)), estimator: asUserId(uid(0x13)), viewer: asUserId(uid(0x14)),
};
export const VENDOR: Record<Role, UserId> = {
    owner: asUserId(uid(0x21)), admin: asUserId(uid(0x22)), estimator: asUserId(uid(0x23)), viewer: asUserId(uid(0x24)),
};
export const OUTSIDER = asUserId(uid(0x99));
export const ROLES: Role[] = ['owner', 'admin', 'estimator', 'viewer'];

/** 40 % / 60 % of 500,000 (the plan's acceptance example). */
export const INSTALLMENTS: InstallmentDto[] = [
    { no: 1, pct: 0.4, condition: 'ก่ออิฐเสร็จทั้งหลัง' },
    { no: 2, pct: 0.6, condition: 'ฉาบปูนเสร็จทั้งหลัง' },
];

const sample = createProject('sample');
export const SAMPLE_BOQ = computeProject(sample).boq;

export function masonryLines(count = 2, materialByVendor = false): SnapshotLine[] {
    const keys = subcontractableRows(SAMPLE_BOQ).filter(r => r.trade === 'masonry' && r.row.qty > 0).slice(0, count).map(r => r.row.key);
    const res = buildSnapshot(SAMPLE_BOQ, {
        lineKeys: keys, customLines: [], supplyMode: materialByVendor ? 'with_materials' : 'labour_only', materialByLine: {},
    });
    if (!res.ok) throw new Error('snapshot failed');
    return res.snapshot.lines;
}

export class FakePackageDirectory extends PackageDirectory {
    readonly packages = new Map<PackageId, PackageView>();
    readonly invitations = new Map<ScInvitationId, InvitationView>();
    readonly versions = new Map<string, SnapshotLine[]>();
    readonly reopened: PackageId[] = [];
    readonly closed: PackageId[] = [];

    findPackage(id: PackageId): Promise<PackageView | undefined> { return Promise.resolve(this.packages.get(id)); }
    linesOfVersion(id: PackageId, version: number): Promise<SnapshotLine[] | undefined> { return Promise.resolve(this.versions.get(`${id}|${version}`)); }
    findInvitation(id: ScInvitationId): Promise<InvitationView | undefined> { return Promise.resolve(this.invitations.get(id)); }
    listInvitations(packageId: PackageId): Promise<InvitationView[]> {
        return Promise.resolve([...this.invitations.values()].filter(i => i.packageId === packageId));
    }
    listPackagesOfProject(buyerWorkspaceId: WorkspaceId, projectId: ProjectId): Promise<PackageView[]> {
        return Promise.resolve([...this.packages.values()].filter(p => p.buyerWorkspaceId === buyerWorkspaceId && p.projectId === projectId));
    }
    listInvitationsOfVendor(vendorWorkspaceId: WorkspaceId): Promise<InvitationView[]> {
        return Promise.resolve([...this.invitations.values()].filter(i => i.vendorWorkspaceId === vendorWorkspaceId));
    }
    markSubmitted(): Promise<void> { return Promise.resolve(); }
    markBidWithdrawn(): Promise<void> { return Promise.resolve(); }
    markAwarded(): Promise<boolean> { return Promise.resolve(true); }
    reopenAfterCancel(packageId: PackageId): Promise<void> { this.reopened.push(packageId); return Promise.resolve(); }
    markClosed(packageId: PackageId): Promise<void> { this.closed.push(packageId); return Promise.resolve(); }
}

/** Records the packages whose bid decisions were reset (cancel → re-award). */
export class FakeBidDirectory extends BidDirectory {
    readonly resets: PackageId[] = [];

    latestSubmitted(): Promise<Map<ScInvitationId, BidView>> { return Promise.resolve(new Map<ScInvitationId, BidView>()); }
    find(): Promise<BidView | undefined> { return Promise.resolve(undefined); }
    resetDecisions(packageId: PackageId): Promise<void> { this.resets.push(packageId); return Promise.resolve(); }
}

export class FakeVendorDirectory extends VendorDirectory {
    readonly cardsById = new Map<WorkspaceId, VendorCardView>();

    cards(ids: readonly WorkspaceId[]): Promise<Map<WorkspaceId, VendorCardView>> {
        return Promise.resolve(new Map(ids.flatMap(id => {
            const c = this.cardsById.get(id);
            return c === undefined ? [] : [[id, c] as const];
        })));
    }

    entryNames(): Promise<Map<VendorListEntryId, string>> { return Promise.resolve(new Map<VendorListEntryId, string>()); }
}

export class FakeUserDirectory extends UserDirectory {
    findMany(ids: readonly UserId[]): Promise<Map<UserId, UserProfile>> {
        return Promise.resolve(new Map(ids.map(id => [id, { id, email: `${id}@test`, displayName: `ผู้ใช้ ${id.slice(-2)}` }])));
    }
}

export interface AwardOptions {
    vendorWorkspaceId?: WorkspaceId | null;
    total?: number;
    installments?: InstallmentDto[];
    lines?: SnapshotLine[];
    packageId?: PackageId;
    status?: PackageStatus;
    bidPackageVersion?: number;
    /** Material unit price the crew bid on lines where it supplies material (default none). */
    matUnitPrice?: number;
}

export function contractsKit() {
    const clock = new FixedClock(new Date('2026-10-26T03:00:00.000Z'));
    const ids = new SequentialIdGenerator();
    const roles = new FakeRoles();
    for (const r of ROLES) {
        roles.set(BUYER[r], BUYER_WS, r);
        roles.set(VENDOR[r], VENDOR_WS, r);
    }
    const flags = new FakeModuleFlags();
    const projects = new FakeProjects();
    projects.add({ projectId: PROJECT, workspaceId: BUYER_WS, name: 'บ้านคุณสมศรี', archived: false, project: sample });
    const files = new FakeFileService();
    const notifier = new RecordingNotifier();
    const workspaces = new FakeWorkspaceDirectory();
    const users = new FakeUserDirectory();
    const uow = new InMemoryUnitOfWork();

    const subcontracts = new InMemorySubcontractRepository();
    const documents = new InMemoryContractDocumentRepository();
    const variations = new InMemoryVariationRepository();
    const claims = new InMemoryClaimRepository();
    const retention = new InMemoryRetentionRepository();
    const ratings = new InMemoryRatingRepository();
    const settingsRepo = new InMemoryScSettingsRepository();
    const activity = new InMemoryScActivityLog();
    const packages = new FakePackageDirectory();
    const bids = new FakeBidDirectory();
    const vendors = new FakeVendorDirectory();
    vendors.cardsById.set(VENDOR_WS, { workspaceId: VENDOR_WS, teamName: 'ทีมช่างสมชาย', phone: '+66811111111', tier: 'L0', profileComplete: false, vatRegistered: false });

    const settings = new RepositorySettingsReader(settingsRepo);
    const scAccess = new ScAccess(roles, flags, projects.directory(), settings);
    const access = new ContractAccess(scAccess, roles, subcontracts, claims, variations);
    const views = new ContractViews(claims, retention, variations, documents, ratings, files, scAccess);
    const notices = new ContractNotices(notifier);
    const followUp = new PackageFollowUp(packages, bids);
    const creator = new CreateSubcontractUseCase(subcontracts, documents, settings, vendors, activity, ids);

    let n = 0;
    /** What bidding does on award: a package + invitation + bid, then SubcontractCreator.create. */
    async function award(o: AwardOptions = {}): Promise<SubcontractId> {
        n += 1;
        const packageId = o.packageId ?? asPackageId(uid(0x1000 + n));
        const lines = o.lines ?? masonryLines();
        const total = o.total ?? 500_000;
        const vendorWs = o.vendorWorkspaceId === undefined ? VENDOR_WS : o.vendorWorkspaceId;
        const pkg: PackageView = packages.packages.get(packageId) ?? {
            id: packageId, buyerWorkspaceId: BUYER_WS, buyerName: 'บริษัท ก่อสร้างดี จำกัด', projectId: PROJECT, projectName: 'บ้านคุณสมศรี',
            title: 'งานก่ออิฐฉาบปูน', trade: 'masonry', status: o.status ?? 'awarded', version: 1, sourcingMode: 'direct', pricingMode: 'unit',
            supplyMode: 'labour_only', description: '',
            terms: {
                retentionPct: 0.05, warrantyMonths: 12, penalty: { kind: 'per_day', amount: 500 },
                provisions: { water: 'buyer', power: 'buyer', lodging: 'none', scaffolding: 'vendor' }, safetyNote: '', questions: [],
            },
            schedule: { start: '2026-11-01', finish: '2026-12-15', days: null }, installments: o.installments ?? INSTALLMENTS,
            location: { district: 'บางกรวย', province: 'นนทบุรี', address: '' }, hideOwnerIdentity: true,
            bidDeadline: new Date('2026-10-20T10:00:00Z'), priceValidUntil: '2026-11-30', estimateTotal: 400_000, lines,
            createdBy: BUYER.owner, sentAt: new Date('2026-10-10T00:00:00Z'), awardedAt: clock.now(),
        };
        packages.packages.set(packageId, pkg);
        const invitation: InvitationView = {
            id: asScInvitationId(uid(0x2000 + n)), packageId, buyerWorkspaceId: BUYER_WS, vendorListEntryId: asVendorListEntryId(uid(0x3000 + n)),
            vendorWorkspaceId: vendorWs, displayName: 'ทีมช่างสมชาย', phone: '+66811111111', channel: 'link', status: 'won',
            sentAt: new Date('2026-10-10T00:00:00Z'), viewedAt: null,
        };
        packages.invitations.set(invitation.id, invitation);
        const awarded: AwardedLine[] = lines.map((l, k) => ({
            idx: l.idx, desc: l.desc, unit: l.unit, qty: l.qtyPriced, unitPrice: 100,
            matUnitPrice: l.materialBy === 'vendor' ? o.matUnitPrice ?? null : null,
            total: k === lines.length - 1 ? total - (lines.length - 1) * Math.floor(total / lines.length) : Math.floor(total / lines.length),
        }));
        const bid: BidView = {
            id: asBidId(uid(0x4000 + n)), invitationId: invitation.id, packageId, packageVersion: o.bidPackageVersion ?? 1, version: 1,
            status: 'selected', mode: 'unit', lines: awarded.map(l => ({ idx: l.idx, unitPrice: l.unitPrice, matUnitPrice: l.matUnitPrice, excluded: false, reason: '', total: l.total })),
            lumpTotal: null, adjustment: 0, total, days: 30, earliestStart: null, validUntil: null, installmentsProposal: null,
            enteredByBuyer: false, submittedAt: new Date('2026-10-15T00:00:00Z'),
        };
        return creator.create({
            package: pkg, invitation, bid, vendorName: 'ทีมช่างสมชาย', lines: awarded, total,
            installments: o.installments ?? INSTALLMENTS, decidedBy: BUYER.owner, at: clock.now(),
        });
    }

    const kit = {
        clock, ids, roles, flags, projects, files, notifier, workspaces, users, uow, subcontracts, documents, variations, claims,
        retention, ratings, settingsRepo, activity, packages, bids, vendors, settings, scAccess, access, views, notices, followUp,
        creator, award,
        getSettings: new GetScSettingsUseCase(scAccess, settings),
        putSettings: new PutScSettingsUseCase(scAccess, settingsRepo, clock),
        checklists: new GetTradeChecklistsUseCase(scAccess),
        overview: new GetOverviewUseCase(new ProjectFactsLoader(scAccess, projects, packages, subcontracts, claims, retention), packages, clock),
        report: new GetReportUseCase(new ProjectFactsLoader(scAccess, projects, packages, subcontracts, claims, retention)),
        listProject: new ListProjectSubcontractsUseCase(scAccess, subcontracts, views),
        listVendor: new ListVendorSubcontractsUseCase(scAccess, subcontracts, views),
        listWorkspaceRetention: new ListWorkspaceRetentionUseCase(scAccess, subcontracts, retention),
        get: new GetSubcontractUseCase(access, views),
        getDocument: new GetContractDocumentUseCase(access, scAccess, documents),
        updateDocument: new UpdateContractDocumentUseCase(access, subcontracts, documents, activity, notices, uow, clock, ids),
        accept: new AcceptSubcontractUseCase(access, subcontracts, activity, notices, views, uow, clock),
        requestChange: new RequestContractChangeUseCase(access, documents, activity, notices, views, uow, clock, ids),
        cancel: new CancelSubcontractUseCase(access, subcontracts, followUp, activity, views, uow, clock),
        terminate: new TerminateSubcontractUseCase(access, subcontracts, followUp, activity, views, uow, clock),
        complete: new CompleteSubcontractUseCase(access, subcontracts, followUp, activity, views, uow, clock, claims),
        close: new CloseSubcontractUseCase(access, subcontracts, followUp, activity, views, uow, clock, retention),
        attachScan: new AttachSignedScanUseCase(access, subcontracts, files, activity, views, uow, clock),
        rate: new RateSubcontractUseCase(access, ratings, activity, uow, clock, ids),
        listVariations: new ListVariationsUseCase(access, variations),
        proposeVariation: new ProposeVariationUseCase(access, variations, activity, notices, uow, clock, ids),
        respondVariation: new RespondVariationUseCase(access, subcontracts, variations, claims, activity, notices, uow, clock),
        listClaims: new ListClaimsUseCase(access, claims, views),
        requestClaim: new RequestClaimUseCase(access, claims, files, activity, notices, views, uow, clock, ids),
        inspect: new InspectClaimUseCase(access, claims, users, activity, notices, views, uow, clock),
        approve: new ApproveClaimUseCase(access, claims, settings, activity, views, uow, clock),
        pay: new PayClaimUseCase(access, claims, retention, activity, notices, views, uow, clock, ids),
        reject: new RejectClaimUseCase(access, claims, activity, views, uow, clock),
        listRetention: new ListRetentionUseCase(access, retention),
        moveRetention: new MoveRetentionUseCase(access, retention, activity, uow, clock, ids),
        moduleUsage: new RepositoryModuleUsage(subcontracts),
        vendorStats: new RepositoryVendorStats(subcontracts, ratings),
        linkListener: new RepositoryVendorLinkListener(subcontracts, vendors, activity, clock),
        sweep: new RetentionDueSweep(subcontracts, retention, flags, notices, uow, clock,
            new AppConfig(testEnv())),
    };
    return kit;
}

export type ContractsKit = ReturnType<typeof contractsKit>;

/** Throws on an error result (specs). */
export function must<T>(r: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
    if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
    return r.value;
}

export function codeOf(r: { ok: boolean; error?: { code: string } }): string {
    return r.ok ? 'ok' : r.error?.code ?? '?';
}

/** Award + the crew accepts → active. */
export async function activeContract(kit: ContractsKit, o: AwardOptions = {}): Promise<SubcontractId> {
    const id = await kit.award(o);
    must(await kit.accept.execute({ userId: VENDOR.owner, subcontractId: id, documentVersion: 1, ip: '203.0.113.5' }));
    return id;
}

/** Vendor claims, buyer inspects (pass), approves and records payment of one installment. */
export async function payInstallment(kit: ContractsKit, id: SubcontractId, no: number): Promise<void> {
    const claim = must(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: no, note: '', photoFileIds: [] }));
    const claimId = asClaimId(claim.id);
    must(await kit.inspect.execute({ userId: BUYER.owner, claimId, result: 'pass', checklist: [], fixes: [], note: '' }));
    must(await kit.approve.execute({ userId: BUYER.owner, claimId, adjustments: [] }));
    must(await kit.pay.execute({ userId: BUYER.owner, claimId, paidAt: '2026-11-10', amount: claim.amounts.net, channel: 'โอน', ref: '' }));
}
