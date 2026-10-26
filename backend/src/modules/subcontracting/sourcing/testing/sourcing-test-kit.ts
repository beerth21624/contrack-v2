// ─── Test support for the sourcing specs: every use case wired by Nest with in-memory adapters and fakes ───
// One buyer company (owner/admin/estimator/viewer + an outsider) with the sample project, and one crew (vendor
// workspace with a profile). Ports of other streams (bids, stats, settings, link listener) are small fakes here.
import type { Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
    type CreatePackageRequest, type CreateInvitationsResponse, type BuyerPackageDto, type ErrorCode, type Role,
    type SubcontractingSettingsDto, createPackageRequestSchema,
} from '@contrack/contract';
import { computeProject, createProject } from '@contrack/domain/project';
import { subcontractableRows } from '@contrack/domain/subcontracting';
import {
    AppLinks, Clock, FileService, IdGenerator, MembershipDirectory, type MembershipSummary, ModuleFlags, Notifier,
    ProjectDirectory, ProjectReader, UnitOfWork, WorkspaceAccess, WorkspaceDirectory,
} from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { Result } from '../../../../shared/domain/result';
import { AppConfig, testEnv } from '../../../../shared/infrastructure/config/env';
import { InMemoryUnitOfWork } from '../../../../shared/infrastructure/database/database';
import { FixedClock, SequentialIdGenerator } from '../../../../shared/infrastructure/system';
import {
    FakeFileService, FakeModuleFlags, FakeProjects, FakeRoles, FakeWorkspaceDirectory, FixedAppLinks, RecordingNotifier,
} from '../../../../shared/testing/platform-fakes';
import { InMemoryScActivityLog } from '../../shared/activity-log.adapters';
import type { BidId, ScInvitationId } from '../../shared/ids';
import {
    BidDirectory, type BidView, PackageDirectory, ScActivityLog, SubcontractingSettingsReader, VendorDirectory,
    VendorLinkListener, VendorStats, type VendorStatsView,
} from '../../shared/ports';
import { ScAccess } from '../../shared/sc-access';
import { DEFAULT_SUBCONTRACTING_SETTINGS } from '../../shared/settings';
import {
    InvitationRepository, QuestionRepository, VendorListRepository, VendorProfileRepository, WorkPackageRepository,
} from '../application/ports/sourcing.repositories';
import { SmsRateLimiter } from '../application/ports/sms-rate-limiter.port';
import { CreateInvitationsUseCase } from '../application/use-cases/create-invitations.use-case';
import { CreatePackageUseCase } from '../application/use-cases/create-package.use-case';
import { CreateVendorListEntryUseCase } from '../application/use-cases/create-vendor-list-entry.use-case';
import { VendorProfile } from '../domain/entities/vendor-profile.entity';
import {
    InMemoryInvitationRepository, InMemoryQuestionRepository, InMemoryVendorListRepository, InMemoryVendorProfileRepository,
    InMemoryWorkPackageRepository,
} from '../infrastructure/adapters/in-memory-sourcing.repositories';
import { InMemorySmsRateLimiter } from '../infrastructure/adapters/in-memory-sms-rate-limiter.adapter';
import { SourcingPackageDirectory } from '../infrastructure/adapters/package-directory.adapter';
import { SourcingVendorDirectory } from '../infrastructure/adapters/vendor-directory.adapter';
import { SOURCING_SERVICES, SOURCING_USE_CASES } from '../sourcing.parts';

export const ROLES: readonly Role[] = ['owner', 'admin', 'estimator', 'viewer'];
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

const id = (group: string, n: number): string => `00000000-0000-4000-${group}-${n.toString(16).padStart(12, '0')}`;

export const BUYER_WS = asWorkspaceId(id('b000', 1));
export const OTHER_BUYER_WS = asWorkspaceId(id('b000', 2));
export const VENDOR_WS = asWorkspaceId(id('b000', 3));
export const PROJECT_ID = asProjectId(id('c000', 1));
export const OTHER_PROJECT_ID = asProjectId(id('c000', 2));
export const USERS: Record<Role, UserId> = {
    owner: asUserId(id('a000', 1)), admin: asUserId(id('a000', 2)), estimator: asUserId(id('a000', 3)), viewer: asUserId(id('a000', 4)),
};
export const OUTSIDER = asUserId(id('a000', 9));
export const VENDOR_OWNER = asUserId(id('a000', 10));
export const VENDOR_VIEWER = asUserId(id('a000', 11));
export const VENDOR_ESTIMATOR = asUserId(id('a000', 12));
export const VENDOR_PHONE = '+66812345678';

export class FakeSettings extends SubcontractingSettingsReader {
    value: SubcontractingSettingsDto = { ...DEFAULT_SUBCONTRACTING_SETTINGS };
    get(): Promise<SubcontractingSettingsDto> {
        return Promise.resolve(this.value);
    }
}

/** Latest submitted bids set by the test. */
export class FakeBids extends BidDirectory {
    readonly latest = new Map<ScInvitationId, BidView>();
    private n = 0;

    put(invitationId: ScInvitationId, packageId: string, total: number, packageVersion = 1): BidView {
        this.n += 1;
        const bid: BidView = {
            id: id('d000', this.n) as BidId, invitationId, packageId: packageId as BidView['packageId'], packageVersion, version: 1,
            status: 'submitted', mode: 'unit', lines: [], lumpTotal: null, adjustment: 0, total, days: null, earliestStart: null,
            validUntil: null, installmentsProposal: null, enteredByBuyer: false, submittedAt: new Date('2026-01-02T00:00:00.000Z'),
        };
        this.latest.set(invitationId, bid);
        return bid;
    }

    latestSubmitted(ids: readonly ScInvitationId[]): Promise<Map<ScInvitationId, BidView>> {
        return Promise.resolve(new Map(ids.flatMap(i => {
            const b = this.latest.get(i);
            return b === undefined ? [] : [[i, b] as const];
        })));
    }

    find(bidId: BidId): Promise<BidView | undefined> {
        return Promise.resolve([...this.latest.values()].find(b => b.id === bidId));
    }

    resetDecisions(): Promise<void> {
        return Promise.resolve();
    }
}

export class FakeStats extends VendorStats {
    readonly byVendor = new Map<WorkspaceId, VendorStatsView>();
    forBuyer(_buyer: WorkspaceId, ids: readonly WorkspaceId[]): Promise<Map<WorkspaceId, VendorStatsView>> {
        return Promise.resolve(new Map(ids.flatMap(i => {
            const s = this.byVendor.get(i);
            return s === undefined ? [] : [[i, s] as const];
        })));
    }
}

export class RecordingLinkListener extends VendorLinkListener {
    readonly calls: { invitationId: ScInvitationId; vendorWorkspaceId: WorkspaceId }[] = [];
    onInvitationLinked(invitationId: ScInvitationId, vendorWorkspaceId: WorkspaceId): Promise<void> {
        this.calls.push({ invitationId, vendorWorkspaceId });
        return Promise.resolve();
    }
}

export class FakeMemberships extends MembershipDirectory {
    readonly byUser = new Map<UserId, MembershipSummary[]>();
    listForUser(userId: UserId): Promise<MembershipSummary[]> {
        return Promise.resolve(this.byUser.get(userId) ?? []);
    }
}

const sample = createProject('sample');
export const SAMPLE_BOQ = computeProject(sample).boq;
export const MASONRY_KEYS = subcontractableRows(SAMPLE_BOQ).filter(r => r.trade === 'masonry').map(r => r.row.key);
export const ELECTRICAL_KEYS = subcontractableRows(SAMPLE_BOQ).filter(r => r.trade === 'electrical').map(r => r.row.key);

/** A valid create request (defaults applied by the contract schema). */
export function packageRequest(overrides: Partial<CreatePackageRequest> = {}): CreatePackageRequest {
    return createPackageRequestSchema.parse({
        title: 'ก่ออิฐฉาบปูนทั้งหลัง',
        trade: 'masonry',
        lineKeys: MASONRY_KEYS.slice(0, 3),
        customLines: [],
        supplyMode: 'labour_only',
        materialByLine: {},
        pricingMode: 'unit',
        sourcingMode: 'rfq',
        terms: {
            retentionPct: 0.05, warrantyMonths: 12, penalty: { kind: 'none' },
            provisions: { water: 'buyer', power: 'buyer', lodging: 'none', scaffolding: 'vendor' },
        },
        schedule: { start: null, finish: null, days: 20 },
        installments: [{ no: 1, pct: 0.5, condition: 'ก่อครบ' }, { no: 2, pct: 0.5, condition: 'ฉาบครบ' }],
        location: { district: 'คลองหลวง', province: 'ปทุมธานี', address: '99 หมู่ 1 ต.คลองหนึ่ง' },
        hideOwnerIdentity: true,
        bidDeadline: '2026-01-06T10:00:00.000Z',
        priceValidUntil: '2026-02-05',
        description: 'งานก่อฉาบ',
        ...overrides,
    });
}

export class SourcingKit {
    readonly clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
    readonly ids = new SequentialIdGenerator();
    readonly roles = new FakeRoles();
    readonly flags = new FakeModuleFlags();
    readonly files = new FakeFileService();
    readonly notifier = new RecordingNotifier();
    readonly workspaces = new FakeWorkspaceDirectory();
    readonly projects = new FakeProjects();
    readonly memberships = new FakeMemberships();
    readonly settings = new FakeSettings();
    readonly bids = new FakeBids();
    readonly stats = new FakeStats();
    readonly listener = new RecordingLinkListener();
    readonly activity = new InMemoryScActivityLog();
    readonly profiles = new InMemoryVendorProfileRepository();
    readonly entries = new InMemoryVendorListRepository();
    readonly packages = new InMemoryWorkPackageRepository();
    readonly invitations = new InMemoryInvitationRepository();
    readonly questions = new InMemoryQuestionRepository();
    readonly limiter = new InMemorySmsRateLimiter(this.clock);
    private moduleRef: TestingModule | undefined;

    static async create(): Promise<SourcingKit> {
        const kit = new SourcingKit();
        await kit.init();
        return kit;
    }

    private async init(): Promise<void> {
        const value = <T>(provide: abstract new (...args: never[]) => T, useValue: T) => ({ provide, useValue });
        const moduleRef = await Test.createTestingModule({
            providers: [
                { provide: AppConfig, useValue: new AppConfig(testEnv()) },
                value(Clock, this.clock), value(IdGenerator, this.ids), value(UnitOfWork, new InMemoryUnitOfWork()),
                value(WorkspaceAccess, this.roles), value(ModuleFlags, this.flags), value(FileService, this.files),
                value(Notifier, this.notifier), value(AppLinks, new FixedAppLinks()), value(WorkspaceDirectory, this.workspaces),
                value(ProjectReader, this.projects), value(ProjectDirectory, this.projects.directory()),
                value(MembershipDirectory, this.memberships), value(SubcontractingSettingsReader, this.settings),
                value(BidDirectory, this.bids), value(VendorStats, this.stats), value(VendorLinkListener, this.listener),
                value(ScActivityLog, this.activity), value(VendorProfileRepository, this.profiles),
                value(VendorListRepository, this.entries), value(WorkPackageRepository, this.packages),
                value(InvitationRepository, this.invitations), value(QuestionRepository, this.questions),
                value(SmsRateLimiter, this.limiter),
                ScAccess, ...SOURCING_SERVICES, ...SOURCING_USE_CASES,
                { provide: PackageDirectory, useClass: SourcingPackageDirectory },
                { provide: VendorDirectory, useClass: SourcingVendorDirectory },
            ],
        }).compile();
        this.moduleRef = moduleRef;
        this.seed();
    }

    get<T>(cls: Type<T> | (abstract new (...args: never[]) => T)): T {
        if (this.moduleRef === undefined) throw new Error('kit not created');
        return this.moduleRef.get(cls, { strict: false });
    }

    private seed(): void {
        for (const r of ROLES) this.roles.set(USERS[r], BUYER_WS, r);
        this.roles.set(VENDOR_OWNER, VENDOR_WS, 'owner');
        this.roles.set(VENDOR_ESTIMATOR, VENDOR_WS, 'estimator');
        this.roles.set(VENDOR_VIEWER, VENDOR_WS, 'viewer');
        this.workspaces.nameOf.set(BUYER_WS, 'บริษัท ผู้รับเหมา จำกัด');
        this.workspaces.nameOf.set(VENDOR_WS, 'ทีมช่างสมชาย');
        this.workspaces.personal.set(VENDOR_OWNER, VENDOR_WS);
        this.projects.add({ projectId: PROJECT_ID, workspaceId: BUYER_WS, name: 'บ้านคุณสมศรี', archived: false, project: createProject('sample') });
        this.projects.add({ projectId: OTHER_PROJECT_ID, workspaceId: OTHER_BUYER_WS, name: 'อื่น', archived: false, project: createProject('sample') });
    }

    /** The crew's profile (L0) on VENDOR_WS with VENDOR_PHONE. */
    async seedVendorProfile(): Promise<VendorProfile> {
        const p = VendorProfile.create({ workspaceId: VENDOR_WS, teamName: 'ทีมช่างสมชาย', contactName: 'สมชาย', phone: VENDOR_PHONE, now: this.clock.now() });
        await this.profiles.save(p);
        return p;
    }

    async entry(displayName = 'ช่างสมชาย', phone = '081-234-5678'): Promise<string> {
        const res = await this.get(CreateVendorListEntryUseCase).execute({
            actorId: USERS.owner, workspaceId: BUYER_WS,
            body: { displayName, phone, lineId: '', trades: ['masonry'], province: 'ปทุมธานี', privateNote: 'จ่ายตรง' },
        });
        return valueOf(res).id;
    }

    async draft(overrides: Partial<CreatePackageRequest> = {}): Promise<BuyerPackageDto> {
        return valueOf(await this.get(CreatePackageUseCase).execute({ actorId: USERS.owner, projectId: PROJECT_ID, body: packageRequest(overrides) }));
    }

    async send(packageId: string, entryIds: readonly string[], channel: 'link' | 'sms' = 'sms'): Promise<CreateInvitationsResponse> {
        return valueOf(await this.get(CreateInvitationsUseCase).execute({
            actorId: USERS.owner, packageId: packageId as never,
            body: { entries: entryIds.map(e => ({ vendorListEntryId: e, channel })) },
        }));
    }

    /** A sent package with one invitee; returns its ids and raw token. */
    async sentPackage(overrides: Partial<CreatePackageRequest> = {}): Promise<{ pkg: BuyerPackageDto; entryId: string; invitationId: ScInvitationId; token: string }> {
        const pkg = await this.draft(overrides);
        const entryId = (await this.entries.findByPhone(BUYER_WS, VENDOR_PHONE))?.id ?? await this.entry();
        const sent = await this.send(pkg.id, [entryId]);
        const link = sent.links[0];
        if (link === undefined) throw new Error('no link');
        return { pkg, entryId, invitationId: link.invitationId as ScInvitationId, token: link.url.split('/s/')[1] ?? '' };
    }

    moduleOff(ws: WorkspaceId = BUYER_WS): void {
        this.flags.set(ws, 'subcontracting', false);
    }
}

export function valueOf<T>(r: Result<T, DomainError>): T {
    if (!r.ok) throw new Error(`expected ok, got ${r.error.code}: ${r.error.message}`);
    return r.value;
}

export function codeOf(r: Result<unknown, DomainError>): ErrorCode | 'ok' {
    return r.ok ? 'ok' : r.error.code;
}


/**
 * Buyer-side authorization table of a use case: each role ok / forbidden, a non-member → not_found, the module off
 * for the buyer workspace → module_disabled. `prepare` builds a fresh state per case (as the owner).
 */
export function describeBuyerAuthorization<C>(
    allowed: readonly Role[],
    prepare: (kit: SourcingKit) => Promise<C>,
    act: (kit: SourcingKit, user: UserId, ctx: C) => Promise<Result<unknown, DomainError>>,
): void {
    describe('authorization', () => {
        it.each(ROLES.map(r => [r, allowed.includes(r)] as const))('%s → allowed: %s', async (role, ok) => {
            const kit = await SourcingKit.create();
            const ctx = await prepare(kit);
            expect(codeOf(await act(kit, USERS[role], ctx))).toBe(ok ? 'ok' : 'forbidden');
        });

        it('a non-member gets not_found', async () => {
            const kit = await SourcingKit.create();
            const ctx = await prepare(kit);
            expect(codeOf(await act(kit, OUTSIDER, ctx))).toBe('not_found');
        });

        it('module switched off for the buyer → module_disabled', async () => {
            const kit = await SourcingKit.create();
            const ctx = await prepare(kit);
            kit.moduleOff();
            expect(codeOf(await act(kit, USERS.owner, ctx))).toBe('module_disabled');
        });
    });
}
