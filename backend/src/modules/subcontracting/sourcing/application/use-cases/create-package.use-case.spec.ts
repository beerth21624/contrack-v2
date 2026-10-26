import type { PackageStatus } from '@contrack/contract';
import { indexBoq } from '@contrack/domain/subcontracting';
import {
    BUYER_WS, MASONRY_KEYS, OTHER_BUYER_WS, OTHER_PROJECT_ID, PROJECT_ID, SAMPLE_BOQ, SourcingKit, USERS, codeOf, describeBuyerAuthorization,
    packageRequest,
} from '../../testing/sourcing-test-kit';
import { CreatePackageUseCase } from './create-package.use-case';

describe('CreatePackageUseCase', () => {
    let kit: SourcingKit;
    let useCase: CreatePackageUseCase;

    beforeEach(async () => {
        kit = await SourcingKit.create();
        useCase = kit.get(CreatePackageUseCase);
    });

    it('creates a draft with lines snapshotted from the live BOQ (BOQ order, estimate = BOQ labour)', async () => {
        const keys = [MASONRY_KEYS[2], MASONRY_KEYS[0]] as string[];
        const res = await useCase.execute({ actorId: USERS.owner, projectId: PROJECT_ID, body: packageRequest({ lineKeys: keys }) });
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const dto = res.value;
        expect(dto.status).toBe('draft');
        expect(dto.version).toBe(1);
        expect(dto.projectName).toBe('บ้านคุณสมศรี');
        expect(dto.lines.map(l => l.lineKey)).toEqual([MASONRY_KEYS[0], MASONRY_KEYS[2]]);
        const index = indexBoq(SAMPLE_BOQ);
        const labour = keys.reduce((s, k) => s + (index.get(k)?.row.labTotal ?? 0), 0);
        expect(dto.estimateTotal).toBeCloseTo(labour, 1);
        expect(dto.sentAt).toBeNull();
        expect(dto.invitations).toEqual({ total: 0, viewed: 0, submitted: 0, declined: 0 });
        expect(dto.boqDrift).toEqual([]);
        expect(dto.versions).toHaveLength(1);
        expect(kit.activity.rows.map(r => r.action)).toContain('package.created');
        const stored = await kit.packages.findById(dto.id as never);
        expect(stored?.buyerWorkspaceId).toBe(BUYER_WS);
    });

    it('adds typed lines after the BOQ lines', async () => {
        const res = await useCase.execute({
            actorId: USERS.owner, projectId: PROJECT_ID,
            body: packageRequest({ customLines: [{ desc: 'รื้อผนังเดิม', unit: 'ตร.ม.', qty: 10, estUnit: 50 }] }),
        });
        if (!res.ok) throw new Error(res.error.message);
        const last = res.value.lines[res.value.lines.length - 1];
        expect(last?.lineKey).toBeNull();
        expect(last?.estTotal).toBe(500);
    });

    it('refuses unknown BOQ keys with 422 and lists them', async () => {
        const res = await useCase.execute({ actorId: USERS.owner, projectId: PROJECT_ID, body: packageRequest({ lineKeys: ['nope', MASONRY_KEYS[0]!] }) });
        expect(codeOf(res)).toBe('unprocessable');
        if (!res.ok) expect(res.error.details).toEqual({ unknownKeys: ['nope'] });
    });

    it("refuses sourcingMode 'open' (phase 2)", async () => {
        expect(codeOf(await useCase.execute({ actorId: USERS.owner, projectId: PROJECT_ID, body: packageRequest({ sourcingMode: 'open' }) })))
            .toBe('unprocessable');
    });

    it('refuses an archived project', async () => {
        const read = kit.projects.byId.get(PROJECT_ID);
        if (read === undefined) throw new Error('no project');
        kit.projects.add({ ...read, archived: true });
        expect(codeOf(await useCase.execute({ actorId: USERS.owner, projectId: PROJECT_ID, body: packageRequest() }))).toBe('unprocessable');
    });

    it("hides another tenant's project and an unknown project (not_found)", async () => {
        expect(codeOf(await useCase.execute({ actorId: USERS.owner, projectId: OTHER_PROJECT_ID, body: packageRequest() }))).toBe('not_found');
        expect(codeOf(await useCase.execute({
            actorId: USERS.owner, projectId: '00000000-0000-4000-c000-0000000000ff' as never, body: packageRequest(),
        }))).toBe('not_found');
    });

    it('BOQ lines already in another live package of the project → conflict { lineKeys }; freed by cancel / expiry', async () => {
        const kit = await SourcingKit.create();
        const first = await kit.draft({ lineKeys: MASONRY_KEYS.slice(0, 2) });
        expect(first.buyerWorkspaceId).toBe(BUYER_WS);
        const uc = kit.get(CreatePackageUseCase);
        const setStatus = (status: PackageStatus): void => {
            const row = kit.packages.rows.get(first.id as never);
            if (row !== undefined) kit.packages.rows.set(row.id, { ...row, status });
        };
        const create = (keys: string[]) => uc.execute({ actorId: USERS.owner, projectId: PROJECT_ID, body: packageRequest({ lineKeys: keys }) });
        const clash = await create(MASONRY_KEYS.slice(1, 3));
        expect(clash.ok ? undefined : clash.error).toMatchObject({ code: 'conflict', details: { lineKeys: [MASONRY_KEYS[1]] } });
        expect(codeOf(await create(MASONRY_KEYS.slice(2, 4)))).toBe('ok');
        for (const status of ['open', 'reviewing', 'awarded'] as const) {
            setStatus(status);
            expect(codeOf(await create(MASONRY_KEYS.slice(0, 1)))).toBe('conflict');
        }
        for (const status of ['cancelled', 'expired', 'closed'] as const) {
            setStatus(status);
            expect(codeOf(await create(MASONRY_KEYS.slice(0, 1)).then(r => {
                if (r.ok) kit.packages.rows.delete(r.value.id as never);
                return r;
            }))).toBe('ok');
        }
    });

    it('the same BOQ line may be in a package of another project', async () => {
        const kit = await SourcingKit.create();
        await kit.draft({ lineKeys: MASONRY_KEYS.slice(0, 2) });
        kit.roles.set(USERS.owner, OTHER_BUYER_WS, 'owner');
        const res = await kit.get(CreatePackageUseCase).execute({
            actorId: USERS.owner, projectId: OTHER_PROJECT_ID, body: packageRequest({ lineKeys: MASONRY_KEYS.slice(0, 2) }),
        });
        expect(codeOf(res)).toBe('ok');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], () => Promise.resolve(undefined),
        (k, user) => k.get(CreatePackageUseCase).execute({ actorId: user, projectId: PROJECT_ID, body: packageRequest() }));
});
