import {
    BUYER, INV_A, INV_B, INV_C, LINES, PKG, VENDOR_A, VENDOR_B, WS_BUYER, WS_VA, biddingKit, lumpBid, unitBid,
} from '../../testing/bidding-test-kit';

const codeOf = (r: { ok: boolean; error?: { code: string } }): string | undefined => (r.ok ? undefined : r.error?.code);

describe('GetLevelingUseCase', () => {
    it('one column per latest bid, sorted by normalized total, with cells, flags, vendor tier and stats', async () => {
        const kit = biddingKit();
        kit.seed();
        kit.stats.byWs.set(WS_VA, { lastEngagedAt: null, ratingFromUs: 4.5, completedWithUs: 2 });
        // A: 3 800 (normalized 3 800). B: lump 4 600. C (manual): line 2 excluded → normalized 2 100 + 2 000.
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        await kit.submit.execute({ userId: VENDOR_B, invitationId: INV_B, body: lumpBid(4600, { validUntil: '2025-12-31' }) });
        await kit.manualBid.execute({
            userId: BUYER.owner, invitationId: INV_C,
            body: unitBid({ lines: unitBid().lines.map(l => (l.idx === 2 ? { ...l, unitPrice: null, matUnitPrice: null, excluded: true, reason: 'ไม่รับ' } : l)) }),
        });
        const r = await kit.leveling.execute({ userId: BUYER.owner, packageId: PKG });
        if (!r.ok) throw new Error(r.error.message);
        const d = r.value;
        expect(d).toMatchObject({ packageId: PKG, version: 1, estimateTotal: 4000, threshold: 0.2, questions: ['มีนั่งร้านไหม'] });
        expect(d.bidders.map(b => [b.invitationId, b.total, b.normalizedTotal])).toEqual([
            [INV_A, 3800, 3800], [INV_C, 2100, 4100], [INV_B, 4600, 4600],
        ]);
        const [a, c, b] = d.bidders;
        expect(a).toMatchObject({ tier: 'L1', ratingFromUs: 4.5, completedWithUs: 2, diffPct: -0.05, flag: null, expired: false, displayName: 'ช่าง 0' });
        expect(b).toMatchObject({ tier: 'L0', mode: 'lump', expired: true, diffPct: 0.15, ratingFromUs: null, completedWithUs: 0 });
        expect(c).toMatchObject({ enteredByBuyer: true, vendorWorkspaceId: null, tier: null });
        expect(d.lines.map(l => [l.idx, l.estUnit, l.estTotal])).toEqual([[0, 100, 1000], [1, 50, 1000], [2, 350, 2000]]);
        // line 1 of A: 60 × 20 = 1 200 vs 1 000 → +20 % (not above the threshold)
        expect(d.lines[1]?.cells[0]).toMatchObject({ bidId: a?.bidId, unitPrice: 60, total: 1200, diffPct: 0.2, flag: null, filled: false });
        // C excluded line 2 → filled with the estimate
        expect(d.lines[2]?.cells[1]).toMatchObject({ excluded: true, filled: true, total: 2000 });
        // B lump spread by estimate share
        expect(d.lines.map(l => l.cells[2]?.total)).toEqual([1150, 1150, 2300]);
        expect(kit.activity.rows.at(-1)).toMatchObject({ action: 'prices.viewed', data: { view: 'leveling', bidders: 3 } });
    });

    it('uses the workspace threshold for flags', async () => {
        const kit = biddingKit();
        kit.seed();
        kit.settings.set(WS_BUYER, { levelingThreshold: 0.1 });
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        const r = await kit.leveling.execute({ userId: BUYER.owner, packageId: PKG });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.threshold).toBe(0.1);
        expect(r.value.lines.map(l => l.cells[0]?.flag)).toEqual([null, 'high', 'low']);
    });

    it('leaves out withdrawn bids and invitees without a bid', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        await kit.withdraw.execute({ userId: VENDOR_A.owner, invitationId: INV_A });
        const r = await kit.leveling.execute({ userId: BUYER.owner, packageId: PKG });
        expect(r.ok && r.value.bidders).toEqual([]);
        expect(r.ok && r.value.lines.every(l => l.cells.length === 0)).toBe(true);
    });

    it('an outdated bid is never moved onto the new lines: own total, no diff / flag, prices on unchanged lines only, listed last', async () => {
        const kit = biddingKit();
        const pkg = kit.seed();
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        kit.packages.versions.set(`${PKG}|1`, structuredClone(LINES));
        // version 2 drops line k0, doubles k1, keeps k2 as it was
        kit.pkg({ ...pkg, version: 2, estimateTotal: 4000, lines: [{ ...LINES[1]!, idx: 0, qtyPriced: 40, qtyNet: 40, estTotal: 2000 }, { ...LINES[2]!, idx: 1 }] });
        // B resubmitted on version 2 (dearer than A's old total, still listed first)
        await kit.submit.execute({ userId: VENDOR_B, invitationId: INV_B, body: lumpBid(4600) });
        const r = await kit.leveling.execute({ userId: BUYER.owner, packageId: PKG });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.bidders.map(b => [b.invitationId, b.outdated])).toEqual([[INV_B, false], [INV_A, true]]);
        expect(r.value.bidders[1]).toMatchObject({ total: 3800, normalizedTotal: 3800, diffPct: null, flag: null });
        // line k1 changed (20 → 40): empty; line k2 unchanged: A's own price
        expect(r.value.lines[0]?.cells[1]).toMatchObject({ unitPrice: null, total: 0, filled: false, excluded: false, diffPct: null, flag: null });
        expect(r.value.lines[1]?.cells[1]).toMatchObject({ unitPrice: 300, total: 1700, filled: false });
        // B (current) is levelled as before
        expect(r.value.bidders[0]).toMatchObject({ total: 4600, normalizedTotal: 4600, diffPct: 0.15 });
    });

    it('authorization: estimator yes, viewer forbidden, crew not_found, module off', async () => {
        const kit = biddingKit();
        kit.seed();
        expect(codeOf(await kit.leveling.execute({ userId: BUYER.estimator, packageId: PKG }))).toBeUndefined();
        expect(codeOf(await kit.leveling.execute({ userId: BUYER.viewer, packageId: PKG }))).toBe('forbidden');
        expect(codeOf(await kit.leveling.execute({ userId: VENDOR_A.owner, packageId: PKG }))).toBe('not_found');
        kit.flags.set(WS_BUYER, 'subcontracting', false);
        expect(codeOf(await kit.leveling.execute({ userId: BUYER.owner, packageId: PKG }))).toBe('module_disabled');
    });
});
