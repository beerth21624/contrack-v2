import { asPackageId } from '../../../shared/ids';
import { BUYER, BUYER_WS, VENDOR_WS, contractsKit, masonryLines } from '../../testing/contracts-test-kit';

describe('CreateSubcontractUseCase (SubcontractCreator)', () => {
    it('creates a pending subcontract with terms, installments and document v1', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        const sc = await kit.subcontracts.findById(id);
        expect(sc?.status).toBe('pending_acceptance');
        const s = sc!.state;
        expect(s.contractNo).toBe('SC-2026-0001');
        expect(s.total).toBe(500_000);
        expect(s.terms).toMatchObject({ retentionPct: 0.05, warrantyMonths: 12, whtPct: 0.03, vat: false });
        expect(s.vendorWorkspaceId).toBe(VENDOR_WS);
        expect(s.schedule).toEqual({ start: '2026-11-01', finish: '2026-12-15', days: 30 });
        expect(s.lines.every(l => l.lineKey !== null && l.materialBy === 'buyer')).toBe(true);
        expect(sc!.installmentAmounts().map(i => i.amount)).toEqual([200_000, 300_000]);
        const doc = await kit.documents.findDocument(id, 1);
        expect(doc?.html).toContain('SC-2026-0001');
        expect(doc?.html).toContain('ทีมช่างสมชาย');
        expect(doc?.html).toContain('ห้าแสนบาทถ้วน');
        expect(kit.activity.rows.map(r => r.action)).toEqual(['created']);
        expect(kit.notifier.sent).toEqual([]);
    });

    it('numbers contracts per buyer workspace and year', async () => {
        const kit = contractsKit();
        await kit.award();
        const second = await kit.award();
        expect((await kit.subcontracts.findById(second))?.state.contractNo).toBe('SC-2026-0002');
        kit.clock.set(new Date('2027-01-02T00:00:00Z'));
        const next = await kit.award();
        expect((await kit.subcontracts.findById(next))?.state.contractNo).toBe('SC-2027-0001');
    });

    it('takes WHT from the workspace settings, VAT from the crew card, and the workspace template', async () => {
        const kit = contractsKit();
        await kit.settingsRepo.put(BUYER_WS, {
            ...(await kit.settings.get(BUYER_WS)), defaultWhtPct: 0.01,
            contractTemplateHtml: '<h1>สัญญาของเรา {{contractNo}}</h1><p>{{vendorName}} {{totalText}}</p>',
        }, BUYER.owner, kit.clock.now());
        const card = kit.vendors.cardsById.get(VENDOR_WS);
        kit.vendors.cardsById.set(VENDOR_WS, { ...card!, vatRegistered: true });
        const id = await kit.award();
        const sc = await kit.subcontracts.findById(id);
        expect(sc?.terms).toMatchObject({ whtPct: 0.01, vat: true });
        expect((await kit.documents.findDocument(id, 1))?.html).toBe('<h1>สัญญาของเรา SC-2026-0001</h1><p>ทีมช่างสมชาย ห้าแสนบาทถ้วน</p>');
    });

    it('a winner without an account gets a subcontract with no vendor workspace (no VAT)', async () => {
        const kit = contractsKit();
        const id = await kit.award({ vendorWorkspaceId: null });
        const sc = await kit.subcontracts.findById(id);
        expect(sc?.vendorWorkspaceId).toBeNull();
        expect(sc?.terms.vat).toBe(false);
    });

    it('takes line keys and material from the CURRENT package version by idx, never from the older version the bid was made on', async () => {
        const kit = contractsKit();
        const current = masonryLines(2, true);
        const packageId = asPackageId('00000000-0000-4000-b000-000000000001');
        kit.packages.versions.set(`${packageId}|1`, masonryLines(3).map(l => ({ ...l, lineKey: `old-${l.idx}`, materialBy: 'buyer' as const })));
        const id = await kit.award({ packageId, lines: current, bidPackageVersion: 1 });
        const pkg = kit.packages.packages.get(packageId)!;
        kit.packages.packages.set(packageId, { ...pkg, version: 2 });
        const again = await kit.award({ packageId, lines: current, bidPackageVersion: 1 });
        for (const sc of [id, again]) {
            const lines = (await kit.subcontracts.findById(sc))?.state.lines ?? [];
            expect(lines.map(l => [l.lineKey, l.materialBy])).toEqual(current.map(l => [l.lineKey, 'vendor']));
        }
    });

    it('numbers through the counter: no clash with a number already used, never the same number twice', async () => {
        const kit = contractsKit();
        const seqs = await Promise.all([1, 2, 3].map(() => kit.subcontracts.nextSeq(BUYER_WS, 2026)));
        expect(seqs).toEqual([1, 2, 3]);
        const id = await kit.award();
        expect((await kit.subcontracts.findById(id))?.state.contractNo).toBe('SC-2026-0004');
    });
});
