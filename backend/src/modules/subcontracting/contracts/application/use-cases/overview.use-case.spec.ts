import type { Role } from '@contrack/contract';
import { subcontractableRows } from '@contrack/domain/subcontracting/snapshot';
import { asPackageId, asScInvitationId, asVendorListEntryId } from '../../../shared/ids';
import {
    BUYER, BUYER_WS, OUTSIDER, PROJECT, SAMPLE_BOQ, VENDOR, VENDOR_WS, activeContract, codeOf, contractsKit, masonryLines, must,
    payInstallment,
} from '../../testing/contracts-test-kit';

const rows = subcontractableRows(SAMPLE_BOQ);
const labourOf = (trade: string) => Math.round(rows.filter(r => r.trade === trade).reduce((s, r) => s + r.row.labTotal, 0) * 100) / 100;

describe('GetOverviewUseCase', () => {
    it('lists trades with BOQ estimates; empty project = nothing sourced', async () => {
        const kit = contractsKit();
        const o = must(await kit.overview.execute({ userId: BUYER.estimator, projectId: PROJECT }));
        expect(o.contractedTotal).toBe(0);
        expect(o.coverage).toBe(0);
        expect(o.trades.every(t => t.status === 'not_sourced')).toBe(true);
        expect(o.trades.find(t => t.trade === 'masonry')?.estimate).toBeCloseTo(labourOf('masonry'), 1);
        expect(o.estimateTotal).toBeCloseTo(rows.reduce((s, r) => s + r.row.labTotal, 0), 1);
        expect(o.todo).toEqual([]);
    });

    it('a viewer without sc.readPrices reads the overview with every money figure 0', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const o = must(await kit.overview.execute({ userId: BUYER.viewer, projectId: PROJECT }));
        expect(o.estimateTotal).toBe(0);
        expect(o.contractedTotal).toBe(0);
        expect(o.trades.every(t => t.estimate === 0 && t.contracted === 0 && t.subcontracts.every(s => s.total === 0))).toBe(true);
        expect(o.trades.find(t => t.trade === 'masonry')).toMatchObject({ status: 'contracted', subcontracts: [{ id, total: 0 }] });
        await kit.settingsRepo.put(BUYER_WS, { ...(await kit.settings.get(BUYER_WS)), viewerSeesPrices: true }, BUYER.owner, kit.clock.now());
        expect(must(await kit.overview.execute({ userId: BUYER.viewer, projectId: PROJECT })).contractedTotal).toBe(500_000);
    });

    it('a trade with only part of its rows contracted compares contracted with the estimate of the contracted scope', async () => {
        const kit = contractsKit();
        const lines = masonryLines(2);
        await activeContract(kit, { lines });
        const o = must(await kit.overview.execute({ userId: BUYER.owner, projectId: PROJECT }));
        const masonry = o.trades.find(t => t.trade === 'masonry');
        const scope = lines.reduce((s, l) => s + l.estTotal, 0);
        expect(masonry?.estimate).toBeCloseTo(scope, 2);
        expect(masonry?.estimate).toBeLessThan(labourOf('masonry'));
    });

    it('a contracted trade, coverage of its rows, material counted when the vendor supplies it, and the to-do list', async () => {
        const kit = contractsKit();
        const lines = masonryLines(2, true);
        const id = await activeContract(kit, { lines });
        const claim = must(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 1, note: '', photoFileIds: [] }));
        const o = must(await kit.overview.execute({ userId: BUYER.owner, projectId: PROJECT }));
        const masonry = o.trades.find(t => t.trade === 'masonry');
        const keys = new Set(lines.map(l => l.lineKey));
        expect(masonry).toMatchObject({ status: 'contracted', contracted: 500_000, problem: null, subcontracts: [{ id, vendorName: 'ทีมช่างสมชาย', total: 500_000 }] });
        // the contracted scope: the two awarded rows, labour + material (the vendor supplies it)
        const scope = rows.filter(r => keys.has(r.row.key)).reduce((s, r) => s + r.row.labTotal + r.row.matTotal, 0);
        expect(masonry?.estimate).toBeCloseTo(scope, 1);
        const covered = rows.filter(r => keys.has(r.row.key)).reduce((s, r) => s + r.row.labTotal + r.row.matTotal, 0);
        expect(o.coverage).toBeCloseTo(covered / o.estimateTotal, 3);
        expect(o.todo).toEqual([{ kind: 'claim_to_inspect', label: expect.stringContaining('ตรวจรับงวด 1'), href: `/subcontracting/contracts/${id}` }]);
        expect(claim.status).toBe('requested');
    });

    it('shows packages waiting for bids, deadlines and problems', async () => {
        const kit = contractsKit();
        await kit.award({ status: 'open' });
        const pkg = [...kit.packages.packages.values()][0]!;
        kit.packages.packages.set(pkg.id, { ...pkg, trade: 'painting', bidDeadline: new Date('2026-10-26T10:00:00Z') });
        kit.packages.invitations.clear();
        const declined = asPackageId('00000000-0000-4000-b000-0000000000aa');
        kit.packages.packages.set(declined, { ...pkg, id: declined, trade: 'tiling', title: 'ปูกระเบื้อง', status: 'open', bidDeadline: new Date('2026-11-05T10:00:00Z') });
        kit.packages.invitations.set(asScInvitationId('00000000-0000-4000-b000-0000000000bb'), {
            id: asScInvitationId('00000000-0000-4000-b000-0000000000bb'), packageId: declined, buyerWorkspaceId: BUYER_WS,
            vendorListEntryId: asVendorListEntryId('00000000-0000-4000-b000-0000000000cc'), vendorWorkspaceId: VENDOR_WS, displayName: 'x',
            phone: '+66', channel: 'link', status: 'declined', sentAt: new Date(), viewedAt: null,
        });
        const o = must(await kit.overview.execute({ userId: BUYER.owner, projectId: PROJECT }));
        expect(o.trades.find(t => t.trade === 'painting')).toMatchObject({ status: 'waiting_bids' });
        expect(o.trades.find(t => t.trade === 'tiling')).toMatchObject({ status: 'problem', problem: 'ทีมช่างปฏิเสธทั้งหมด' });
        expect(o.todo.map(t => t.kind)).toEqual(expect.arrayContaining(['deadline_today', 'awaiting_acceptance']));
    });

    it('access: non-member not_found, module off module_disabled, vendors not_found', async () => {
        const kit = contractsKit();
        expect(codeOf(await kit.overview.execute({ userId: OUTSIDER, projectId: PROJECT }))).toBe('not_found');
        expect(codeOf(await kit.overview.execute({ userId: VENDOR.owner, projectId: PROJECT }))).toBe('not_found');
        kit.flags.set(BUYER_WS, 'subcontracting', false);
        expect(codeOf(await kit.overview.execute({ userId: BUYER.owner, projectId: PROJECT }))).toBe('module_disabled');
    });
});

describe('GetReportUseCase', () => {
    it('estimate vs contracted vs paid per trade; totals add up', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        await payInstallment(kit, id, 1);
        const r = must(await kit.report.execute({ userId: BUYER.estimator, projectId: PROJECT }));
        const masonry = r.rows.find(x => x.trade === 'masonry')!;
        expect(masonry.contracted).toBe(500_000);
        // paid = value of the work paid for (gross + adjustments), not the cash net of retention / WHT (184,000)
        expect(masonry.paid).toBe(200_000);
        expect(masonry.diff).toBeCloseTo(500_000 - masonry.estimate, 2);
        expect(r.totals.paid).toBe(200_000);
        expect(r.totals.estimate).toBeCloseTo(r.rows.reduce((s, x) => s + x.estimate, 0), 2);
    });

    it.each<[Role, string]>([['owner', 'ok'], ['admin', 'ok'], ['estimator', 'ok'], ['viewer', 'forbidden']])(
        '%s reads the report: %s', async (role, code) => {
            const kit = contractsKit();
            expect(codeOf(await kit.report.execute({ userId: BUYER[role], projectId: PROJECT }))).toBe(code);
        },
    );

    it('viewer reads it when the workspace lets viewers see prices; a terminated contract counts what was paid', async () => {
        const kit = contractsKit();
        await kit.settingsRepo.put(BUYER_WS, { ...(await kit.settings.get(BUYER_WS)), viewerSeesPrices: true }, BUYER.owner, kit.clock.now());
        const id = await activeContract(kit);
        await payInstallment(kit, id, 1);
        must(await kit.terminate.execute({ userId: BUYER.owner, subcontractId: id, reason: 'x' }));
        const r = must(await kit.report.execute({ userId: BUYER.viewer, projectId: PROJECT }));
        expect(r.rows.find(x => x.trade === 'masonry')).toMatchObject({ contracted: 200_000, paid: 200_000 });
    });
});

describe('Lists', () => {
    it('project and vendor lists show summaries; cancelled stay listed', async () => {
        const kit = contractsKit();
        const a = await activeContract(kit);
        const b = await kit.award();
        must(await kit.cancel.execute({ userId: BUYER.owner, subcontractId: b, reason: 'x' }));
        const project = must(await kit.listProject.execute({ userId: BUYER.viewer, projectId: PROJECT }));
        expect(project.map(s => [s.id, s.status])).toEqual([[a, 'active'], [b, 'cancelled']]);
        const vendor = must(await kit.listVendor.execute({ userId: VENDOR.viewer, workspaceId: VENDOR_WS }));
        expect(vendor.map(s => s.id)).toEqual([a, b]);
        expect(codeOf(await kit.listVendor.execute({ userId: BUYER.owner, workspaceId: VENDOR_WS }))).toBe('not_found');
        expect(codeOf(await kit.listProject.execute({ userId: VENDOR.owner, projectId: PROJECT }))).toBe('not_found');
    });

    it('workspace retention lists contracts holding retention with the next due date', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        expect(must(await kit.listWorkspaceRetention.execute({ userId: BUYER.viewer, workspaceId: BUYER_WS }))).toEqual([]);
        await payInstallment(kit, id, 1);
        await payInstallment(kit, id, 2);
        must(await kit.complete.execute({ userId: BUYER.owner, subcontractId: id }));
        expect(must(await kit.listWorkspaceRetention.execute({ userId: BUYER.owner, workspaceId: BUYER_WS }))).toEqual([{
            subcontractId: id, contractNo: 'SC-2026-0001', projectName: 'บ้านคุณสมศรี', vendorName: 'ทีมช่างสมชาย', balance: 25_000,
            nextDueAt: '2026-10-26', status: 'completed',
        }]);
        // a viewer without sc.readPrices sees the rows but not the money
        expect(must(await kit.listWorkspaceRetention.execute({ userId: BUYER.viewer, workspaceId: BUYER_WS }))[0]?.balance).toBe(0);
        expect(codeOf(await kit.listWorkspaceRetention.execute({ userId: VENDOR.owner, workspaceId: BUYER_WS }))).toBe('not_found');
    });
});
