// ─── Unit-test kit of the bidding stream: in-memory repositories + fakes of the ports other streams provide ───
import type { Role, SubcontractingSettingsDto, SubmitBidRequest } from '@contrack/contract';
import type { SnapshotLine } from '@contrack/domain/subcontracting';
import { asUserId, asWorkspaceId, type UserId, type WorkspaceId } from '../../../../shared/domain';
import { FixedClock, SequentialIdGenerator } from '../../../../shared/infrastructure/system';
import { InMemoryUnitOfWork } from '../../../../shared/infrastructure/database/database';
import {
    FakeFileService, FakeModuleFlags, FakeProjects, FakeRoles, RecordingNotifier,
} from '../../../../shared/testing/platform-fakes';
import { InMemoryScActivityLog } from '../../shared/activity-log.adapters';
import {
    asPackageId, asScInvitationId, asSubcontractId, asVendorListEntryId, type PackageId, type ScInvitationId, type SubcontractId,
    type VendorListEntryId,
} from '../../shared/ids';
import {
    type AwardedPart, type InvitationView, PackageDirectory, type PackageView, SubcontractCreator, SubcontractingSettingsReader,
    type VendorCardView, VendorDirectory, VendorStats, type VendorStatsView,
} from '../../shared/ports';
import { ScAccess } from '../../shared/sc-access';
import { DEFAULT_SUBCONTRACTING_SETTINGS } from '../../shared/settings';
import { BiddingAccess } from '../application/bidding-access';
import { BidPresenter } from '../application/bid-presenter';
import { BidSubmission } from '../application/bid-submission';
import { AwardPackageUseCase } from '../application/use-cases/award-package.use-case';
import { EnterManualBidUseCase } from '../application/use-cases/enter-manual-bid.use-case';
import { GetLevelingUseCase } from '../application/use-cases/get-leveling.use-case';
import { GetMyBidStateUseCase } from '../application/use-cases/get-my-bid-state.use-case';
import { GetVendorInboxUseCase } from '../application/use-cases/get-vendor-inbox.use-case';
import { ListPackageBidsUseCase } from '../application/use-cases/list-package-bids.use-case';
import { ListMessagesUseCase, SendMessageUseCase } from '../application/use-cases/messages.use-case';
import { SaveBidDraftUseCase } from '../application/use-cases/save-bid-draft.use-case';
import { SubmitBidUseCase } from '../application/use-cases/submit-bid.use-case';
import { WithdrawBidUseCase } from '../application/use-cases/withdraw-bid.use-case';
import { RepositoryBidDirectory } from '../infrastructure/adapters/bid-directory.adapter';
import { InMemoryAwardRepository } from '../infrastructure/adapters/in-memory-award.repository';
import { InMemoryBidRepository } from '../infrastructure/adapters/in-memory-bid.repository';
import { InMemoryMessageRepository } from '../infrastructure/adapters/in-memory-message.repository';

const uid = (n: number): string => `00000000-0000-4000-a000-${n.toString(16).padStart(12, '0')}`;

export const WS_BUYER = asWorkspaceId(uid(0x100));
export const WS_OTHER_BUYER = asWorkspaceId(uid(0x101));
export const WS_VA = asWorkspaceId(uid(0x200));
export const WS_VB = asWorkspaceId(uid(0x201));
export const WS_VC = asWorkspaceId(uid(0x202));

export const BUYER: Record<Role, UserId> = {
    owner: asUserId(uid(1)), admin: asUserId(uid(2)), estimator: asUserId(uid(3)), viewer: asUserId(uid(4)),
    // ERP working roles: ids only, not seeded as members
    pm: asUserId(uid(5)), purchasing: asUserId(uid(6)), accounting: asUserId(uid(7)), foreman: asUserId(uid(8)),
};
/** Members of vendor A's crew workspace, by role. */
export const VENDOR_A: Record<Role, UserId> = {
    owner: asUserId(uid(11)), admin: asUserId(uid(12)), estimator: asUserId(uid(13)), viewer: asUserId(uid(14)),
    pm: asUserId(uid(16)), purchasing: asUserId(uid(17)), accounting: asUserId(uid(18)), foreman: asUserId(uid(19)),
};
export const VENDOR_A2 = asUserId(uid(15));
export const VENDOR_B = asUserId(uid(21));
export const VENDOR_C = asUserId(uid(31));
export const OUTSIDER = asUserId(uid(99));

export const PKG = asPackageId(uid(0x300));
export const INV_A = asScInvitationId(uid(0x400));
export const INV_B = asScInvitationId(uid(0x401));
/** Invitee not linked to a vendor account yet. */
export const INV_C = asScInvitationId(uid(0x402));

/** Two labour lines and one with vendor material (estimate 4 000). */
export const LINES: SnapshotLine[] = [
    {
        idx: 0, lineKey: 'k0', section: 7, sectionTitle: 'ผนัง', desc: 'ก่ออิฐ', unit: 'ตร.ม.', qtyNet: 10, qtyGross: null,
        qtyPriced: 10, qtyMaterial: 10, labourBasis: 'net', materialBy: 'buyer', estLabUnit: 100, estMatUnit: 50, estTotal: 1000,
    },
    {
        idx: 1, lineKey: 'k1', section: 7, sectionTitle: 'ผนัง', desc: 'ฉาบปูน', unit: 'ตร.ม.', qtyNet: 20, qtyGross: null,
        qtyPriced: 20, qtyMaterial: 20, labourBasis: 'net', materialBy: 'buyer', estLabUnit: 50, estMatUnit: 0, estTotal: 1000,
    },
    {
        idx: 2, lineKey: 'k2', section: 7, sectionTitle: 'ผนัง', desc: 'เสาเอ็น', unit: 'ม.', qtyNet: 5, qtyGross: 6,
        qtyPriced: 5, qtyMaterial: 6, labourBasis: 'net', materialBy: 'vendor', estLabUnit: 100, estMatUnit: 250, estTotal: 2000,
    },
];

export class FakePackageDirectory extends PackageDirectory {
    readonly packages = new Map<PackageId, PackageView>();
    readonly invitations = new Map<ScInvitationId, InvitationView>();
    readonly versions = new Map<string, SnapshotLine[]>();
    readonly calls: string[] = [];

    findPackage(id: PackageId): Promise<PackageView | undefined> {
        const p = this.packages.get(id);
        return Promise.resolve(p === undefined ? undefined : structuredClone(p));
    }

    linesOfVersion(id: PackageId, version: number): Promise<SnapshotLine[] | undefined> {
        const current = this.packages.get(id);
        if (current?.version === version) return Promise.resolve(structuredClone(current.lines));
        return Promise.resolve(this.versions.get(`${id}|${version}`));
    }

    findInvitation(id: ScInvitationId): Promise<InvitationView | undefined> {
        const i = this.invitations.get(id);
        return Promise.resolve(i === undefined ? undefined : structuredClone(i));
    }

    listInvitations(packageId: PackageId): Promise<InvitationView[]> {
        return Promise.resolve([...this.invitations.values()].filter(i => i.packageId === packageId).map(i => structuredClone(i)));
    }

    listPackagesOfProject(buyerWorkspaceId: WorkspaceId): Promise<PackageView[]> {
        return Promise.resolve([...this.packages.values()].filter(p => p.buyerWorkspaceId === buyerWorkspaceId));
    }

    listInvitationsOfVendor(vendorWorkspaceId: WorkspaceId): Promise<InvitationView[]> {
        return Promise.resolve([...this.invitations.values()].filter(i => i.vendorWorkspaceId === vendorWorkspaceId).map(i => structuredClone(i)));
    }

    private setStatus(id: ScInvitationId, status: InvitationView['status']): void {
        const i = this.invitations.get(id);
        if (i !== undefined) this.invitations.set(id, { ...i, status });
    }

    markSubmitted(invitationId: ScInvitationId): Promise<void> {
        this.calls.push(`markSubmitted:${invitationId}`);
        this.setStatus(invitationId, 'submitted');
        return Promise.resolve();
    }

    markBidWithdrawn(invitationId: ScInvitationId): Promise<void> {
        this.calls.push(`markBidWithdrawn:${invitationId}`);
        this.setStatus(invitationId, 'viewed');
        return Promise.resolve();
    }

    /** Like the real one: refuses (false, nothing changed) unless the package is open / reviewing / expired. */
    markAwarded(packageId: PackageId, winners: readonly ScInvitationId[], at: Date): Promise<boolean> {
        this.calls.push(`markAwarded:${packageId}:${winners.join(',')}`);
        const p = this.packages.get(packageId);
        if (p === undefined || !['open', 'reviewing', 'expired'].includes(p.status)) return Promise.resolve(false);
        this.packages.set(packageId, { ...p, status: 'awarded', awardedAt: at });
        for (const i of this.invitations.values()) {
            if (i.packageId !== packageId) continue;
            if (winners.includes(i.id)) this.setStatus(i.id, 'won');
            else if (i.status === 'submitted') this.setStatus(i.id, 'lost');
            else if (i.status !== 'withdrawn' && i.status !== 'declined') this.setStatus(i.id, 'closed');
        }
        return Promise.resolve(true);
    }

    reopenAfterCancel(): Promise<void> {
        return Promise.resolve();
    }

    markClosed(): Promise<void> {
        return Promise.resolve();
    }
}

export class FakeVendorDirectory extends VendorDirectory {
    readonly byWs = new Map<WorkspaceId, VendorCardView>();

    cards(ids: readonly WorkspaceId[]): Promise<Map<WorkspaceId, VendorCardView>> {
        const out = new Map<WorkspaceId, VendorCardView>();
        for (const id of ids) {
            const c = this.byWs.get(id);
            if (c !== undefined) out.set(id, c);
        }
        return Promise.resolve(out);
    }

    entryNames(ids: readonly VendorListEntryId[]): Promise<Map<VendorListEntryId, string>> {
        return Promise.resolve(new Map(ids.map(id => [id, `entry ${id}`])));
    }
}

export class FakeSubcontractCreator extends SubcontractCreator {
    readonly parts: AwardedPart[] = [];
    fail = false;

    create(part: AwardedPart): Promise<SubcontractId> {
        if (this.fail) return Promise.reject(new Error('subcontract creation failed'));
        this.parts.push(part);
        return Promise.resolve(asSubcontractId(uid(0x900 + this.parts.length)));
    }
}

export class FakeSettings extends SubcontractingSettingsReader {
    readonly byWs = new Map<WorkspaceId, SubcontractingSettingsDto>();

    get(workspaceId: WorkspaceId): Promise<SubcontractingSettingsDto> {
        return Promise.resolve(this.byWs.get(workspaceId) ?? DEFAULT_SUBCONTRACTING_SETTINGS);
    }

    set(workspaceId: WorkspaceId, patch: Partial<SubcontractingSettingsDto>): void {
        this.byWs.set(workspaceId, { ...DEFAULT_SUBCONTRACTING_SETTINGS, ...patch });
    }
}

export class FakeVendorStats extends VendorStats {
    readonly byWs = new Map<WorkspaceId, VendorStatsView>();

    forBuyer(_buyer: WorkspaceId, ids: readonly WorkspaceId[]): Promise<Map<WorkspaceId, VendorStatsView>> {
        const out = new Map<WorkspaceId, VendorStatsView>();
        for (const id of ids) {
            const s = this.byWs.get(id);
            if (s !== undefined) out.set(id, s);
        }
        return Promise.resolve(out);
    }
}

export function biddingKit() {
    const clock = new FixedClock(new Date('2026-01-01T03:00:00.000Z'));
    const ids = new SequentialIdGenerator();
    const roles = new FakeRoles();
    const flags = new FakeModuleFlags();
    const files = new FakeFileService();
    const notifier = new RecordingNotifier();
    const settings = new FakeSettings();
    const packages = new FakePackageDirectory();
    const vendors = new FakeVendorDirectory();
    const stats = new FakeVendorStats();
    const creator = new FakeSubcontractCreator();
    const activity = new InMemoryScActivityLog();
    const bids = new InMemoryBidRepository();
    const messages = new InMemoryMessageRepository();
    const awards = new InMemoryAwardRepository();
    const uow = new InMemoryUnitOfWork();

    for (const [role, user] of Object.entries(BUYER) as [Role, UserId][]) roles.set(user, WS_BUYER, role);
    for (const [role, user] of Object.entries(VENDOR_A) as [Role, UserId][]) roles.set(user, WS_VA, role);
    roles.set(VENDOR_A2, WS_VA, 'owner');
    roles.set(VENDOR_B, WS_VB, 'owner');
    roles.set(VENDOR_C, WS_VC, 'owner');
    vendors.byWs.set(WS_VA, { workspaceId: WS_VA, teamName: 'ทีมช่าง A', phone: '+66810000001', tier: 'L1', profileComplete: true, vatRegistered: false });
    vendors.byWs.set(WS_VB, { workspaceId: WS_VB, teamName: 'ทีมช่าง B', phone: '+66810000002', tier: 'L0', profileComplete: false, vatRegistered: false });

    const sc = new ScAccess(roles, flags, new FakeProjects().directory(), settings);
    const access = new BiddingAccess(sc, packages);
    const presenter = new BidPresenter(files);
    const submission = new BidSubmission(packages, bids, files, activity, uow, clock, ids);

    const pkg = (over: Partial<PackageView> = {}): PackageView => {
        const view: PackageView = {
            id: PKG, buyerWorkspaceId: WS_BUYER, buyerName: 'บริษัท ผู้รับเหมา', projectId: uid(0x500) as PackageView['projectId'],
            projectName: 'บ้านคุณเอ', title: 'งานก่อฉาบ', trade: 'masonry', status: 'open', version: 1, sourcingMode: 'rfq',
            pricingMode: 'vendor_choice', supplyMode: 'per_line', description: '',
            terms: {
                retentionPct: 0.05, warrantyMonths: 12, penalty: { kind: 'none' },
                provisions: { water: 'buyer', power: 'buyer', lodging: 'none', scaffolding: 'vendor' }, safetyNote: '', questions: ['มีนั่งร้านไหม'],
            },
            schedule: { start: null, finish: null, days: 30 },
            installments: [{ no: 1, pct: 0.5, condition: 'ก่อเสร็จ' }, { no: 2, pct: 0.5, condition: 'ฉาบเสร็จ' }],
            location: { district: 'บางกะปิ', province: 'กรุงเทพมหานคร', address: '' },
            hideOwnerIdentity: false, bidDeadline: new Date('2026-01-10T10:00:00.000Z'), priceValidUntil: '2026-02-28',
            estimateTotal: 4000, lines: structuredClone(LINES), createdBy: BUYER.owner, sentAt: new Date('2025-12-30T00:00:00.000Z'), awardedAt: null,
            ...over,
        };
        packages.packages.set(view.id, view);
        return view;
    };

    const invitation = (id: ScInvitationId, vendorWorkspaceId: WorkspaceId | null, over: Partial<InvitationView> = {}): InvitationView => {
        const view: InvitationView = {
            id, packageId: PKG, buyerWorkspaceId: WS_BUYER, vendorListEntryId: asVendorListEntryId(uid(0x600 + Number.parseInt(id.slice(-3), 16))),
            vendorWorkspaceId, displayName: `ช่าง ${id.slice(-1)}`, phone: '+66800000000', channel: 'link', status: 'viewed',
            sentAt: new Date('2025-12-30T00:00:00.000Z'), viewedAt: new Date('2025-12-31T00:00:00.000Z'), ...over,
        };
        packages.invitations.set(id, view);
        return view;
    };

    /** The standard package with invitees A (crew A), B (crew B) and C (no account yet). */
    const seed = (over: Partial<PackageView> = {}): PackageView => {
        const p = pkg(over);
        invitation(INV_A, WS_VA);
        invitation(INV_B, WS_VB);
        invitation(INV_C, null);
        return p;
    };

    return {
        clock, ids, roles, flags, files, notifier, settings, packages, vendors, stats, creator, activity, bids, messages, awards, uow,
        sc, access, presenter, submission, seed, pkg, invitation,
        directory: new RepositoryBidDirectory(bids, packages, clock),
        inbox: new GetVendorInboxUseCase(sc, packages, bids, messages),
        bidState: new GetMyBidStateUseCase(access, bids, presenter),
        saveDraft: new SaveBidDraftUseCase(access, packages, bids, files, presenter, clock, ids),
        submit: new SubmitBidUseCase(access, submission, vendors, presenter, notifier, clock),
        withdraw: new WithdrawBidUseCase(access, packages, bids, activity, uow, clock),
        listBids: new ListPackageBidsUseCase(access, bids, presenter, activity, clock),
        leveling: new GetLevelingUseCase(access, packages, bids, vendors, stats, settings, activity, clock),
        manualBid: new EnterManualBidUseCase(access, submission, presenter),
        listMessages: new ListMessagesUseCase(access, messages, clock),
        sendMessage: new SendMessageUseCase(access, messages, vendors, notifier, clock, ids),
        award: new AwardPackageUseCase(access, packages, bids, awards, vendors, creator, activity, notifier, uow, clock, ids),
    };
}

export type BiddingKit = ReturnType<typeof biddingKit>;

/** A complete unit bid on LINES: 90 / 60 / 100 + 200 material → total 3 800 (+ adjustment). */
export function unitBid(over: Partial<SubmitBidRequest> = {}): SubmitBidRequest {
    return {
        mode: 'unit',
        lines: [
            { idx: 0, unitPrice: 90, matUnitPrice: null, excluded: false, reason: '' },
            { idx: 1, unitPrice: 60, matUnitPrice: null, excluded: false, reason: '' },
            { idx: 2, unitPrice: 100, matUnitPrice: 200, excluded: false, reason: '' },
        ],
        lumpTotal: null, adjustment: 0, adjustmentNote: '', inclusions: '', days: 20, earliestStart: '2026-01-15',
        crewSkilled: 3, crewLabourers: 2, validUntil: '2026-02-28', installmentsProposal: null, answers: ['มี'], note: '',
        photoFileIds: [],
        ...over,
    };
}

export function lumpBid(lumpTotal: number, over: Partial<SubmitBidRequest> = {}): SubmitBidRequest {
    return unitBid({ mode: 'lump', lines: [], lumpTotal, ...over });
}
