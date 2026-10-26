// Manual bid, bid list and the vendor's own bid state.
import type { Role } from '@contrack/contract';
import {
    BUYER, INV_A, INV_B, INV_C, OUTSIDER, PKG, VENDOR_A, VENDOR_B, WS_BUYER, WS_OTHER_BUYER, biddingKit, unitBid,
} from '../../testing/bidding-test-kit';

const codeOf = (r: { ok: boolean; error?: { code: string } }): string | undefined => (r.ok ? undefined : r.error?.code);

describe('EnterManualBidUseCase', () => {
    it('the buyer enters a price for an invitee without an account (enteredByBuyer), even after the deadline', async () => {
        const kit = biddingKit();
        kit.seed({ status: 'expired' });
        kit.clock.set(new Date('2026-01-20T00:00:00.000Z'));
        const r = await kit.manualBid.execute({ userId: BUYER.estimator, invitationId: INV_C, body: unitBid() });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value).toMatchObject({ enteredByBuyer: true, version: 1, status: 'submitted', total: 3800 });
        expect(kit.packages.invitations.get(INV_C)?.status).toBe('submitted');
        expect(kit.activity.rows.map(a => a.action)).toEqual(['bid.entered_by_buyer']);
        expect(kit.notifier.sent).toEqual([]);
    });

    it('supersedes the invitee\'s own online bid and keeps the invitee\'s draft', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { note: 'ยังร่าง' } });
        const r = await kit.manualBid.execute({ userId: BUYER.owner, invitationId: INV_A, body: unitBid({ adjustment: -500 }) });
        expect(r.ok && r.value.version).toBe(2);
        expect(await kit.bids.findDraft(INV_A)).toBeDefined();
    });

    it('refused after award, on a draft package and on a withdrawn invitation', async () => {
        for (const status of ['awarded', 'draft', 'cancelled'] as const) {
            const kit = biddingKit();
            kit.seed({ status });
            expect(codeOf(await kit.manualBid.execute({ userId: BUYER.owner, invitationId: INV_A, body: unitBid() }))).toBe('conflict');
        }
        const kit = biddingKit();
        kit.seed();
        kit.invitation(INV_B, null, { status: 'withdrawn' });
        expect(codeOf(await kit.manualBid.execute({ userId: BUYER.owner, invitationId: INV_B, body: unitBid() }))).toBe('conflict');
    });

    it('authorization: viewer forbidden, vendors and outsiders not_found, module off', async () => {
        const kit = biddingKit();
        kit.seed();
        expect(codeOf(await kit.manualBid.execute({ userId: BUYER.viewer, invitationId: INV_A, body: unitBid() }))).toBe('forbidden');
        for (const userId of [VENDOR_A.owner, OUTSIDER]) {
            expect(codeOf(await kit.manualBid.execute({ userId, invitationId: INV_A, body: unitBid() }))).toBe('not_found');
        }
        kit.flags.set(WS_BUYER, 'subcontracting', false);
        expect(codeOf(await kit.manualBid.execute({ userId: BUYER.owner, invitationId: INV_A, body: unitBid() }))).toBe('module_disabled');
    });
});

describe('ListPackageBidsUseCase', () => {
    it('lists every submitted version (not drafts) and logs that prices were viewed', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid({ adjustment: -100 }) });
        await kit.saveDraft.execute({ userId: VENDOR_B, invitationId: INV_B, body: {} });
        const r = await kit.listBids.execute({ userId: BUYER.owner, packageId: PKG });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.map(b => [b.invitationId, b.version, b.status])).toEqual([[INV_A, 1, 'superseded'], [INV_A, 2, 'submitted']]);
        expect(kit.activity.rows.at(-1)).toMatchObject({ entity: 'package', entityId: PKG, action: 'prices.viewed', actorUserId: BUYER.owner });
    });

    it('marks bids made for an older package version as outdated', async () => {
        const kit = biddingKit();
        const pkg = kit.seed();
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        kit.pkg({ ...pkg, version: 2 });
        const r = await kit.listBids.execute({ userId: BUYER.owner, packageId: PKG });
        expect(r.ok && r.value[0]?.outdated).toBe(true);
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', true], ['viewer', false]])(
        'buyer %s may read prices: %s',
        async (role, allowed) => {
            const kit = biddingKit();
            kit.seed();
            expect(codeOf(await kit.listBids.execute({ userId: BUYER[role], packageId: PKG }))).toBe(allowed ? undefined : 'forbidden');
        },
    );

    it('a viewer reads prices when the workspace setting allows it', async () => {
        const kit = biddingKit();
        kit.seed();
        kit.settings.set(WS_BUYER, { viewerSeesPrices: true });
        expect(codeOf(await kit.listBids.execute({ userId: BUYER.viewer, packageId: PKG }))).toBeUndefined();
    });

    it('another buyer workspace and vendors → not_found; unknown package → not_found', async () => {
        const kit = biddingKit();
        kit.seed();
        kit.pkg({ id: PKG, buyerWorkspaceId: WS_OTHER_BUYER });
        expect(codeOf(await kit.listBids.execute({ userId: BUYER.owner, packageId: PKG }))).toBe('not_found');
        const k2 = biddingKit();
        k2.seed();
        expect(codeOf(await k2.listBids.execute({ userId: VENDOR_A.owner, packageId: PKG }))).toBe('not_found');
        expect(codeOf(await k2.listBids.execute({ userId: BUYER.owner, packageId: INV_A as unknown as typeof PKG }))).toBe('not_found');
    });
});

describe('GetMyBidStateUseCase', () => {
    it('returns the draft and the submitted history of the caller\'s invitation', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { note: 'v2' } });
        const r = await kit.bidState.execute({ userId: VENDOR_A.viewer, invitationId: INV_A });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.draft?.note).toBe('v2');
        expect(r.value.submitted.map(b => b.version)).toEqual([1]);
    });

    it('vendor A cannot read vendor B\'s bid (not_found), nor can the buyer through the vendor route', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.submit.execute({ userId: VENDOR_B, invitationId: INV_B, body: unitBid() });
        expect(codeOf(await kit.bidState.execute({ userId: VENDOR_A.owner, invitationId: INV_B }))).toBe('not_found');
        expect(codeOf(await kit.bidState.execute({ userId: BUYER.owner, invitationId: INV_B }))).toBe('not_found');
        expect(codeOf(await kit.bidState.execute({ userId: VENDOR_A.owner, invitationId: INV_C }))).toBe('not_found');
    });

    it('reading works while the buyer has the module off; the platform switch hides it', async () => {
        const kit = biddingKit();
        kit.seed();
        kit.flags.set(WS_BUYER, 'subcontracting', false);
        expect(codeOf(await kit.bidState.execute({ userId: VENDOR_A.owner, invitationId: INV_A }))).toBeUndefined();
        kit.flags.platform.clear();
        expect(codeOf(await kit.bidState.execute({ userId: VENDOR_A.owner, invitationId: INV_A }))).toBe('module_disabled');
    });
});
