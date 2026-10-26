import type { Role } from '@contrack/contract';
import {
    BUYER, INV_A, INV_B, INV_C, LINES, PKG, VENDOR_A, VENDOR_B, WS_BUYER, WS_VA, WS_VB, type BiddingKit, biddingKit, lumpBid, unitBid,
} from '../../testing/bidding-test-kit';
import { Bid } from '../../domain/entities/bid.entity';

const codeOf = (r: { ok: boolean; error?: { code: string } }): string | undefined => (r.ok ? undefined : r.error?.code);
const reasonOf = (r: { ok: boolean; error?: { details?: unknown } }): unknown => (r.ok ? undefined : (r.error?.details as { reason?: string }).reason);

/** A: unit 3 800 − 380 = 3 420; B: lump 4 600; C (manual, no account): unit 3 800. Returns the bid ids. */
async function bidsOf(kit: BiddingKit): Promise<{ a: string; b: string; c: string }> {
    const a = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid({ adjustment: -380 }) });
    const b = await kit.submit.execute({ userId: VENDOR_B, invitationId: INV_B, body: lumpBid(4600, { installmentsProposal: [{ no: 1, pct: 1, condition: 'จบงาน' }] }) });
    const c = await kit.manualBid.execute({ userId: BUYER.owner, invitationId: INV_C, body: unitBid() });
    if (!a.ok || !b.ok || !c.ok) throw new Error('seeding bids failed');
    kit.notifier.sent.length = 0;
    return { a: a.value.id, b: b.value.id, c: c.value.id };
}

const all = (bidId: string) => LINES.map(l => ({ idx: l.idx, bidId }));

describe('AwardPackageUseCase', () => {
    it('awards the whole package to one unit bid: subcontract, statuses, award row, notifications after commit', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        const r = await kit.award.execute({ userId: BUYER.admin, packageId: PKG, body: { allocations: all(ids.a), installmentsFrom: {}, note: 'ถูกสุด' } });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.packageStatus).toBe('awarded');
        expect(r.value.subcontractIds).toHaveLength(1);

        const part = kit.creator.parts[0]!;
        expect(part.total).toBe(3420);
        expect(part.vendorName).toBe('ทีมช่าง A');
        expect(part.lines).toEqual([
            { idx: 0, desc: 'ก่ออิฐ', unit: 'ตร.ม.', qty: 10, unitPrice: 90, matUnitPrice: null, total: 810 },
            { idx: 1, desc: 'ฉาบปูน', unit: 'ตร.ม.', qty: 20, unitPrice: 60, matUnitPrice: null, total: 1080 },
            { idx: 2, desc: 'เสาเอ็น', unit: 'ม.', qty: 5, unitPrice: 100, matUnitPrice: 200, total: 1530 },
        ]);
        expect(part.installments.map(i => i.pct)).toEqual([0.5, 0.5]);
        expect(part.bid).toMatchObject({ id: ids.a, status: 'selected' });
        expect(part.decidedBy).toBe(BUYER.admin);

        expect((await kit.directory.find(ids.a as never))?.status).toBe('selected');
        expect((await kit.directory.find(ids.b as never))?.status).toBe('not_selected');
        expect((await kit.directory.find(ids.c as never))?.status).toBe('not_selected');
        expect(kit.packages.calls).toContain(`markAwarded:${PKG}:${INV_A}`);
        expect(kit.awards.rows[0]).toMatchObject({ packageId: PKG, buyerWorkspaceId: WS_BUYER, note: 'ถูกสุด', subcontractIds: r.value.subcontractIds });
        expect(kit.activity.rows.map(a => a.action).slice(-4)).toEqual(['bid.selected', 'bid.not_selected', 'bid.not_selected', 'package.awarded']);

        expect(kit.notifier.sent).toEqual([
            { template: 'sc.outcome_won', toWorkspaceIds: [WS_VA], payload: { buyerName: 'บริษัท ผู้รับเหมา', title: 'งานก่อฉาบ', href: `/vendor/invitations/${INV_A}` } },
            {
                template: 'sc.contract_to_accept', toWorkspaceIds: [WS_VA],
                payload: { buyerName: 'บริษัท ผู้รับเหมา', title: 'งานก่อฉาบ', total: '3,420 บาท', href: `/vendor/contracts/${r.value.subcontractIds[0] ?? ''}` },
            },
            { template: 'sc.outcome_lost', toWorkspaceIds: [WS_VB], payload: { buyerName: 'บริษัท ผู้รับเหมา', title: 'งานก่อฉาบ', href: `/vendor/invitations/${INV_B}` } },
        ]);
    });

    it('partial award: lines 0–1 to A (adjustment pro rata), line 2 to C; one subcontract per winner', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        const r = await kit.award.execute({
            userId: BUYER.owner, packageId: PKG,
            body: { allocations: [{ idx: 0, bidId: ids.a }, { idx: 2, bidId: ids.c }, { idx: 1, bidId: ids.a }], installmentsFrom: {}, note: '' },
        });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.subcontractIds).toHaveLength(2);
        const [pa, pc] = kit.creator.parts;
        // 2 100 of 3 800 priced → adjustment −380 × 2 100 / 3 800 = −210
        expect(pa?.total).toBe(1890);
        expect(pa?.lines.map(l => [l.idx, l.total])).toEqual([[0, 810], [1, 1080]]);
        expect(pc?.total).toBe(1700);
        expect(pc?.vendorName).toBe('ช่าง 2');
        expect(kit.packages.calls).toContain(`markAwarded:${PKG}:${INV_A},${INV_C}`);
        expect(kit.notifier.templates()).toEqual(['sc.outcome_won', 'sc.contract_to_accept', 'sc.outcome_lost']);
    });

    it('a lump bid wins all lines at its total, with its own installments when chosen', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        const part = await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: [{ idx: 0, bidId: ids.b }], installmentsFrom: {}, note: '' } });
        expect(reasonOf(part)).toBe('lump_needs_all_lines');
        const r = await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(ids.b), installmentsFrom: { [ids.b]: 'bid' }, note: '' } });
        if (!r.ok) throw new Error(r.error.message);
        const p = kit.creator.parts[0]!;
        expect(p.total).toBe(4600);
        expect(p.lines.map(l => l.total)).toEqual([1150, 1150, 2300]);
        expect(p.lines.every(l => l.unitPrice === null)).toBe(true);
        expect(p.installments).toEqual([{ no: 1, pct: 1, condition: 'จบงาน' }]);
    });

    it('installments from a bid that proposed none → 422', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        const r = await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(ids.a), installmentsFrom: { [ids.a]: 'bid' }, note: '' } });
        expect(reasonOf(r)).toBe('no_installments_proposal');
    });

    it('only the latest submitted version can win; withdrawn bids cannot', async () => {
        const kit = biddingKit();
        kit.seed();
        const v1 = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid({ adjustment: -10 }) });
        if (!v1.ok) throw new Error('submit');
        expect(reasonOf(await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(v1.value.id), installmentsFrom: {}, note: '' } })))
            .toBe('bid_not_latest');
        const b = await kit.submit.execute({ userId: VENDOR_B, invitationId: INV_B, body: unitBid() });
        await kit.withdraw.execute({ userId: VENDOR_B, invitationId: INV_B });
        if (!b.ok) throw new Error('submit');
        expect(reasonOf(await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(b.value.id), installmentsFrom: {}, note: '' } })))
            .toBe('bid_not_latest');
        expect(reasonOf(await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all('00000000-0000-4000-8000-0000000fffff'), installmentsFrom: {}, note: '' } })))
            .toBe('bid_not_latest');
    });

    it('each line once, known lines only, priced lines only', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        expect(reasonOf(await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: [{ idx: 0, bidId: ids.a }, { idx: 0, bidId: ids.c }], installmentsFrom: {}, note: '' } })))
            .toBe('duplicate_line');
        expect(reasonOf(await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: [{ idx: 9, bidId: ids.a }], installmentsFrom: {}, note: '' } })))
            .toBe('unknown_line');
        const ex = await kit.manualBid.execute({
            userId: BUYER.owner, invitationId: INV_C,
            body: unitBid({ lines: unitBid().lines.map(l => (l.idx === 2 ? { ...l, unitPrice: null, matUnitPrice: null, excluded: true, reason: 'ไม่รับ' } : l)) }),
        });
        if (!ex.ok) throw new Error('manual');
        expect(reasonOf(await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: [{ idx: 2, bidId: ex.value.id }], installmentsFrom: {}, note: '' } })))
            .toBe('line_not_priced');
        expect(kit.creator.parts).toEqual([]);
    });

    it('an awarded or cancelled package cannot be awarded (again)', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(ids.a), installmentsFrom: {}, note: '' } });
        expect(codeOf(await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(ids.a), installmentsFrom: {}, note: '' } }))).toBe('conflict');
        const k2 = biddingKit();
        k2.seed({ status: 'cancelled' });
        expect(codeOf(await k2.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(ids.a), installmentsFrom: {}, note: '' } }))).toBe('conflict');
    });

    it('awarding after the deadline (package expired / reviewing) works', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        kit.pkg({ ...(await kit.packages.findPackage(PKG))!, status: 'reviewing' });
        kit.clock.set(new Date('2026-01-12T00:00:00.000Z'));
        expect(codeOf(await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(ids.c), installmentsFrom: {}, note: '' } }))).toBeUndefined();
    });

    it('a failing subcontract creation aborts before any notification', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        kit.creator.fail = true;
        await expect(kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(ids.a), installmentsFrom: {}, note: '' } })).rejects.toThrow();
        expect(kit.notifier.sent).toEqual([]);
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', false], ['viewer', false]])(
        'buyer %s may award: %s',
        async (role, allowed) => {
            const kit = biddingKit();
            kit.seed();
            const ids = await bidsOf(kit);
            const r = await kit.award.execute({ userId: BUYER[role], packageId: PKG, body: { allocations: all(ids.a), installmentsFrom: {}, note: '' } });
            expect(codeOf(r)).toBe(allowed ? undefined : 'forbidden');
        },
    );

    it('an estimator may award when the workspace setting allows it; vendors never; module off', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        const body = { allocations: all(ids.a), installmentsFrom: {}, note: '' };
        expect(codeOf(await kit.award.execute({ userId: VENDOR_A.owner, packageId: PKG, body }))).toBe('not_found');
        kit.flags.set(WS_BUYER, 'subcontracting', false);
        expect(codeOf(await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body }))).toBe('module_disabled');
        kit.flags.set(WS_BUYER, 'subcontracting', true);
        kit.settings.set(WS_BUYER, { estimatorCanAward: true });
        expect(codeOf(await kit.award.execute({ userId: BUYER.estimator, packageId: PKG, body }))).toBeUndefined();
    });

    it('an outdated bid (made before an addendum) is refused: 422 bid_outdated, nothing written', async () => {
        const kit = biddingKit();
        const pkg = kit.seed();
        const a = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        if (!a.ok) throw new Error('submit');
        kit.packages.versions.set(`${PKG}|1`, structuredClone(LINES));
        // version 2: line k1 doubled, the others unchanged; even an unchanged line cannot go to the old bid
        kit.pkg({ ...pkg, version: 2, lines: [{ ...LINES[0]! }, { ...LINES[1]!, qtyPriced: 40, qtyNet: 40, estTotal: 2000 }, { ...LINES[2]! }] });
        const r = await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: [{ idx: 0, bidId: a.value.id }], installmentsFrom: {}, note: '' } });
        expect(codeOf(r)).toBe('unprocessable');
        expect(r.ok ? undefined : r.error.details).toMatchObject({ reason: 'bid_outdated', bidId: a.value.id, bidPackageVersion: 1, packageVersion: 2 });
        expect(kit.creator.parts).toEqual([]);
        expect(kit.packages.calls.some(c => c.startsWith('markAwarded'))).toBe(false);
        expect((await kit.directory.find(a.value.id as never))?.status).toBe('submitted');
        // once the vendor resubmits on version 2, the new bid can win
        const v2 = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        if (!v2.ok) throw new Error('resubmit');
        const ok = await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(v2.value.id), installmentsFrom: {}, note: '' } });
        expect(codeOf(ok)).toBeUndefined();
        expect(kit.creator.parts[0]?.total).toBe(5000);
    });

    it('refused when markAwarded says no (double click / concurrent award / cancelled meanwhile): 409 and nothing written', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        const activityBefore = kit.activity.rows.length;
        jest.spyOn(kit.packages, 'markAwarded').mockResolvedValueOnce(false);
        const r = await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(ids.a), installmentsFrom: {}, note: '' } });
        expect(codeOf(r)).toBe('conflict');
        expect(reasonOf(r)).toBe('package_not_open');
        for (const id of [ids.a, ids.b, ids.c]) expect((await kit.directory.find(id as never))?.status).toBe('submitted');
        expect(kit.creator.parts).toEqual([]);
        expect(kit.awards.rows).toEqual([]);
        expect(kit.activity.rows).toHaveLength(activityBefore);
        expect(kit.notifier.sent).toEqual([]);
    });

    it('markAwarded is the first write of the transaction', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        const awarded = jest.spyOn(kit.packages, 'markAwarded');
        const writes = [jest.spyOn(kit.bids, 'transition'), jest.spyOn(kit.bids, 'update'), jest.spyOn(kit.activity, 'record'), jest.spyOn(kit.creator, 'create'), jest.spyOn(kit.awards, 'insert')];
        expect(codeOf(await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(ids.a), installmentsFrom: {}, note: '' } }))).toBeUndefined();
        const first = awarded.mock.invocationCallOrder[0]!;
        for (const spy of writes) for (const at of spy.mock.invocationCallOrder) expect(at).toBeGreaterThan(first);
    });

    it('a chosen bid that changed meanwhile (superseded / withdrawn) → 409 bid_changed, no subcontract, no notification', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        jest.spyOn(kit.bids, 'transition').mockResolvedValueOnce(false);
        const r = await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(ids.a), installmentsFrom: {}, note: '' } });
        expect(codeOf(r)).toBe('conflict');
        expect(reasonOf(r)).toBe('bid_changed');
        expect(kit.creator.parts).toEqual([]);
        expect(kit.notifier.sent).toEqual([]);
    });

    it('a part below 0 is refused (422 negative_total)', async () => {
        const kit = biddingKit();
        kit.seed();
        const ids = await bidsOf(kit);
        // a stored bid whose adjustment exceeds what it priced (cannot be submitted today; older data / manual fixes)
        const stored = await kit.bids.findById(ids.c as never);
        if (stored === undefined) throw new Error('missing');
        await kit.bids.update(Bid.rehydrate({ ...stored.toProps(), adjustment: -5000, total: -1200 }));
        const r = await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(ids.c), installmentsFrom: {}, note: '' } });
        expect(codeOf(r)).toBe('unprocessable');
        expect(reasonOf(r)).toBe('negative_total');
        expect(kit.creator.parts).toEqual([]);
    });
});
