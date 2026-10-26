import {
    BUYER, INV_A, INV_C, OUTSIDER, PKG, VENDOR_A, VENDOR_B, WS_BUYER, WS_VA, biddingKit,
} from '../../testing/bidding-test-kit';

const codeOf = (r: { ok: boolean; error?: { code: string } }): string | undefined => (r.ok ? undefined : r.error?.code);

describe('negotiation messages', () => {
    it('buyer → vendor with a target price; vendor reads (marks read) and answers; each side is notified', async () => {
        const kit = biddingKit();
        kit.seed();
        const sent = await kit.sendMessage.execute({ userId: BUYER.owner, invitationId: INV_A, side: 'buyer', body: { text: 'ลดได้ไหม', targetTotal: 3500 } });
        if (!sent.ok) throw new Error(sent.error.message);
        expect(sent.value).toMatchObject({ from: 'buyer', text: 'ลดได้ไหม', targetTotal: 3500 });
        expect(kit.notifier.sent[0]).toEqual({
            template: 'sc.message', toWorkspaceIds: [WS_VA],
            payload: { fromName: 'บริษัท ผู้รับเหมา', title: 'งานก่อฉาบ', href: `/vendor/invitations/${INV_A}` },
        });
        expect((await kit.messages.unreadCounts([INV_A], 'buyer')).get(INV_A)).toBe(1);

        const list = await kit.listMessages.execute({ userId: VENDOR_A.viewer, invitationId: INV_A, side: 'vendor' });
        expect(list.ok && list.value.map(m => m.text)).toEqual(['ลดได้ไหม']);
        expect((await kit.messages.unreadCounts([INV_A], 'buyer')).get(INV_A)).toBeUndefined();

        kit.clock.advance(60_000);
        const reply = await kit.sendMessage.execute({ userId: VENDOR_A.estimator, invitationId: INV_A, side: 'vendor', body: { text: 'ได้ 3,600', targetTotal: null } });
        expect(reply.ok && reply.value.from).toBe('vendor');
        expect(kit.notifier.sent[1]).toEqual({
            template: 'sc.message', toWorkspaceIds: [WS_BUYER],
            payload: { fromName: 'ทีมช่าง A', title: 'งานก่อฉาบ', href: `/subcontracting/packages/${PKG}/leveling` },
        });
        const buyerView = await kit.listMessages.execute({ userId: BUYER.viewer, invitationId: INV_A, side: 'buyer' });
        expect(buyerView.ok && buyerView.value.map(m => m.from)).toEqual(['buyer', 'vendor']);
        expect((await kit.messages.unreadCounts([INV_A], 'vendor')).size).toBe(0);
    });

    it('a vendor cannot set a target price', async () => {
        const kit = biddingKit();
        kit.seed();
        const r = await kit.sendMessage.execute({ userId: VENDOR_A.owner, invitationId: INV_A, side: 'vendor', body: { text: 'x', targetTotal: 1 } });
        expect(codeOf(r)).toBe('validation_failed');
    });

    it('a message to an invitee without an account is stored but notifies nobody', async () => {
        const kit = biddingKit();
        kit.seed();
        const r = await kit.sendMessage.execute({ userId: BUYER.owner, invitationId: INV_C, side: 'buyer', body: { text: 'โทรกลับด้วย', targetTotal: null } });
        expect(r.ok).toBe(true);
        expect(kit.notifier.sent).toEqual([]);
    });

    it('closed for cancelled packages and withdrawn invitations', async () => {
        const kit = biddingKit();
        kit.seed({ status: 'cancelled' });
        expect(codeOf(await kit.sendMessage.execute({ userId: BUYER.owner, invitationId: INV_A, side: 'buyer', body: { text: 'x', targetTotal: null } }))).toBe('conflict');
        const k2 = biddingKit();
        k2.seed();
        k2.invitation(INV_A, WS_VA, { status: 'withdrawn' });
        expect(codeOf(await k2.sendMessage.execute({ userId: VENDOR_A.owner, invitationId: INV_A, side: 'vendor', body: { text: 'x', targetTotal: null } }))).toBe('conflict');
    });

    it('authorization per side', async () => {
        const kit = biddingKit();
        kit.seed();
        const body = { text: 'x', targetTotal: null };
        expect(codeOf(await kit.sendMessage.execute({ userId: BUYER.viewer, invitationId: INV_A, side: 'buyer', body }))).toBe('forbidden');
        expect(codeOf(await kit.sendMessage.execute({ userId: VENDOR_A.viewer, invitationId: INV_A, side: 'vendor', body }))).toBe('forbidden');
        expect(codeOf(await kit.sendMessage.execute({ userId: VENDOR_B, invitationId: INV_A, side: 'vendor', body }))).toBe('not_found');
        expect(codeOf(await kit.listMessages.execute({ userId: VENDOR_B, invitationId: INV_A, side: 'vendor' }))).toBe('not_found');
        expect(codeOf(await kit.listMessages.execute({ userId: VENDOR_A.owner, invitationId: INV_A, side: 'buyer' }))).toBe('not_found');
        expect(codeOf(await kit.listMessages.execute({ userId: OUTSIDER, invitationId: INV_A, side: 'buyer' }))).toBe('not_found');
        kit.flags.set(WS_BUYER, 'subcontracting', false);
        expect(codeOf(await kit.sendMessage.execute({ userId: VENDOR_A.owner, invitationId: INV_A, side: 'vendor', body }))).toBe('module_disabled');
        expect(codeOf(await kit.sendMessage.execute({ userId: BUYER.owner, invitationId: INV_A, side: 'buyer', body }))).toBe('module_disabled');
    });
});
