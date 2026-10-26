import type { Role } from '@contrack/contract';
import {
    BUYER, INV_A, INV_B, OUTSIDER, PKG, VENDOR_A, VENDOR_A2, VENDOR_B, WS_BUYER, WS_VA, biddingKit, lumpBid, unitBid,
} from '../../testing/bidding-test-kit';

const codeOf = (r: { ok: boolean; error?: { code: string } }): string | undefined => (r.ok ? undefined : r.error?.code);

describe('SubmitBidUseCase', () => {
    it('submits version 1, marks the invitation submitted, drops the draft, logs and notifies the buyer', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { note: 'ร่าง' } });
        const r = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid({ adjustment: -300 }) });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value).toMatchObject({ version: 1, status: 'submitted', total: 3500, enteredByBuyer: false, outdated: false, packageVersion: 1 });
        expect(r.value.lines.map(l => l.total)).toEqual([900, 1200, 1700]);
        expect(r.value.submittedAt).toBe(kit.clock.now().toISOString());
        expect(await kit.bids.findDraft(INV_A)).toBeUndefined();
        expect(kit.packages.invitations.get(INV_A)?.status).toBe('submitted');
        expect(kit.activity.rows.map(a => a.action)).toEqual(['bid.submitted']);
        expect(kit.notifier.sent).toEqual([{
            template: 'sc.bid_received', toWorkspaceIds: [WS_BUYER],
            // no amount: viewers without sc.readPrices receive this notification too
            payload: { vendorName: 'ทีมช่าง A', title: 'งานก่อฉาบ', href: `/subcontracting/packages/${r.value.packageId}/leveling` },
        }]);
    });

    it('two submissions racing for the same version: the later one is a 409, not a 500', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        kit.notifier.sent.length = 0;
        // the second request read the version before the first one committed
        jest.spyOn(kit.bids, 'maxVersion').mockResolvedValueOnce(0);
        const r = await kit.submit.execute({ userId: VENDOR_A2, invitationId: INV_A, body: unitBid({ adjustment: -50 }) });
        expect(r.ok ? undefined : [r.error.code, (r.error.details as { reason: string }).reason]).toEqual(['conflict', 'bid_changed']);
        expect(kit.notifier.sent).toEqual([]);
        expect((await kit.bids.listSubmittedOfInvitation(INV_A)).map(b => [b.version, b.status, b.total])).toEqual([[1, 'submitted', 3800]]);
    });

    it('an award that won the race (package no longer open inside the transaction) → 409, no notification', async () => {
        const kit = biddingKit();
        kit.seed();
        jest.spyOn(kit.packages, 'markSubmitted').mockImplementationOnce(() => {
            const p = kit.packages.packages.get(PKG);
            if (p !== undefined) kit.packages.packages.set(PKG, { ...p, status: 'awarded' });
            return Promise.resolve();
        });
        const r = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        expect(r.ok ? undefined : [r.error.code, (r.error.details as { reason: string }).reason]).toEqual(['conflict', 'package_not_open']);
        expect(kit.notifier.sent).toEqual([]);
    });

    it('a new submission is version + 1 and supersedes the previous one (kept readable)', async () => {
        const kit = biddingKit();
        kit.seed();
        const v1 = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        const v2 = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid({ adjustment: -100 }) });
        if (!v1.ok || !v2.ok) throw new Error('submit failed');
        expect(v2.value.version).toBe(2);
        const state = await kit.bidState.execute({ userId: VENDOR_A.owner, invitationId: INV_A });
        if (!state.ok) throw new Error(state.error.message);
        expect(state.value.draft).toBeNull();
        expect(state.value.submitted.map(b => [b.version, b.status, b.total])).toEqual([[1, 'superseded', 3800], [2, 'submitted', 3700]]);
    });

    it('a lump bid on a vendor_choice package', async () => {
        const kit = biddingKit();
        kit.seed();
        const r = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: lumpBid(4200, { adjustment: -200 }) });
        expect(r.ok && [r.value.mode, r.value.total, r.value.lumpTotal]).toEqual(['lump', 4000, 4200]);
    });

    it('validation errors are 422 (unpriced line, missing answers, mode not allowed)', async () => {
        const kit = biddingKit();
        kit.seed({ pricingMode: 'unit' });
        const unpriced = unitBid({ lines: unitBid().lines.slice(1) });
        expect(codeOf(await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unpriced }))).toBe('unprocessable');
        expect(codeOf(await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid({ answers: [] }) }))).toBe('unprocessable');
        expect(codeOf(await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: lumpBid(1) }))).toBe('unprocessable');
        expect(kit.notifier.sent).toEqual([]);
        expect(await kit.bids.maxVersion(INV_A)).toBe(0);
    });

    it('photos must be the caller\'s uploads', async () => {
        const kit = biddingKit();
        kit.seed();
        const foreign = kit.files.add(VENDOR_B, 'bid_photo');
        const mine = kit.files.add(VENDOR_A.owner, 'bid_photo');
        expect(codeOf(await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid({ photoFileIds: [foreign.id] }) }))).toBe('unprocessable');
        const r = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid({ photoFileIds: [mine.id] }) });
        expect(r.ok && r.value.photos.map(p => p.id)).toEqual([mine.id]);
    });

    it('deadline passed / package not open / buyer module off', async () => {
        const kit = biddingKit();
        kit.seed();
        kit.clock.set(new Date('2026-01-10T10:00:00.000Z'));
        expect(codeOf(await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() }))).toBe('conflict');
        const reviewing = biddingKit();
        reviewing.seed({ status: 'reviewing' });
        expect(codeOf(await reviewing.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() }))).toBe('conflict');
        const off = biddingKit();
        off.seed();
        off.flags.set(WS_BUYER, 'subcontracting', false);
        expect(codeOf(await off.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() }))).toBe('module_disabled');
    });

    it('cross-vendor isolation: crew B, the buyer and outsiders cannot submit on crew A\'s invitation', async () => {
        const kit = biddingKit();
        kit.seed();
        for (const userId of [VENDOR_B, BUYER.owner, OUTSIDER]) {
            expect(codeOf(await kit.submit.execute({ userId, invitationId: INV_A, body: unitBid() }))).toBe('not_found');
        }
        expect(codeOf(await kit.submit.execute({ userId: VENDOR_B, invitationId: INV_B, body: unitBid() }))).toBeUndefined();
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', false], ['viewer', false]])(
        'crew %s may submit: %s',
        async (role, allowed) => {
            const kit = biddingKit();
            kit.seed();
            const r = await kit.submit.execute({ userId: VENDOR_A[role], invitationId: INV_A, body: unitBid() });
            expect(codeOf(r)).toBe(allowed ? undefined : 'forbidden');
        },
    );

    it('a declined invitee may still bid before the deadline; a decided one may not', async () => {
        const kit = biddingKit();
        kit.seed();
        kit.invitation(INV_A, WS_VA, { status: 'declined' });
        expect(codeOf(await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() }))).toBeUndefined();
        kit.invitation(INV_A, WS_VA, { status: 'lost' });
        expect(codeOf(await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() }))).toBe('conflict');
    });
});

describe('WithdrawBidUseCase', () => {
    it('withdraws the latest version before the deadline; a later submit is the next version', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        const r = await kit.withdraw.execute({ userId: VENDOR_A.owner, invitationId: INV_A });
        expect(r.ok).toBe(true);
        expect(kit.packages.calls).toContain(`markBidWithdrawn:${INV_A}`);
        expect((await kit.directory.latestSubmitted([INV_A])).size).toBe(0);
        expect(kit.activity.rows.map(a => a.action)).toEqual(['bid.submitted', 'bid.withdrawn']);
        const again = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        expect(again.ok && again.value.version).toBe(2);
        const state = await kit.bidState.execute({ userId: VENDOR_A.owner, invitationId: INV_A });
        expect(state.ok && state.value.submitted.map(b => b.status)).toEqual(['withdrawn', 'submitted']);
    });

    it('nothing to withdraw → conflict; deadline passed → conflict', async () => {
        const kit = biddingKit();
        kit.seed();
        expect(codeOf(await kit.withdraw.execute({ userId: VENDOR_A.owner, invitationId: INV_A }))).toBe('conflict');
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        kit.clock.set(new Date('2026-01-11T00:00:00.000Z'));
        expect(codeOf(await kit.withdraw.execute({ userId: VENDOR_A.owner, invitationId: INV_A }))).toBe('conflict');
    });

    it('a submit / award that changed the bid meanwhile → 409 no_bid, nothing logged', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        // the stored status is no longer "submitted" when the compare-and-set runs
        jest.spyOn(kit.bids, 'transition').mockResolvedValueOnce(false);
        const r = await kit.withdraw.execute({ userId: VENDOR_A.owner, invitationId: INV_A });
        expect(r.ok ? undefined : [r.error.code, (r.error.details as { reason: string }).reason]).toEqual(['conflict', 'no_bid']);
        expect(kit.activity.rows.map(a => a.action)).toEqual(['bid.submitted']);
        expect((await kit.directory.latestSubmitted([INV_A])).get(INV_A)?.status).toBe('submitted');
    });

    it('authorization: other crew not_found, estimator forbidden', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        expect(codeOf(await kit.withdraw.execute({ userId: VENDOR_B, invitationId: INV_A }))).toBe('not_found');
        expect(codeOf(await kit.withdraw.execute({ userId: VENDOR_A.estimator, invitationId: INV_A }))).toBe('forbidden');
    });
});
