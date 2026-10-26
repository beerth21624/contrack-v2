import { asPackageId, asScInvitationId } from '../../../shared/ids';
import {
    BUYER, INV_A, INV_B, LINES, OUTSIDER, PKG, VENDOR_A, VENDOR_B, WS_BUYER, WS_VA, WS_VB, biddingKit, unitBid,
} from '../../testing/bidding-test-kit';

const codeOf = (r: { ok: boolean; error?: { code: string } }): string | undefined => (r.ok ? undefined : r.error?.code);

describe('GetVendorInboxUseCase', () => {
    it('lists the crew\'s invitations with package info, draft flag, latest total, outcome and unread messages', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { note: 'ร่าง' } });
        await kit.sendMessage.execute({ userId: BUYER.owner, invitationId: INV_A, side: 'buyer', body: { text: 'สนใจไหม', targetTotal: null } });
        await kit.sendMessage.execute({ userId: BUYER.owner, invitationId: INV_A, side: 'buyer', body: { text: 'ตอบด้วย', targetTotal: null } });
        const r = await kit.inbox.execute({ userId: VENDOR_A.viewer, workspaceId: WS_VA });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.invitations).toEqual([{
            invitationId: INV_A, packageId: PKG, buyerName: 'บริษัท ผู้รับเหมา', title: 'งานก่อฉาบ', trade: 'masonry',
            province: 'กรุงเทพมหานคร', bidDeadline: '2026-01-10T10:00:00.000Z', status: 'viewed', packageStatus: 'open',
            hasDraft: true, latestBidTotal: null, outcome: 'pending', unreadMessages: 2, receivedAt: '2025-12-30T00:00:00.000Z',
        }]);
    });

    it('after submitting: latest total, no draft; after award: won / lost', async () => {
        const kit = biddingKit();
        kit.seed();
        const a = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        await kit.submit.execute({ userId: VENDOR_B, invitationId: INV_B, body: unitBid({ adjustment: 100 }) });
        if (!a.ok) throw new Error('submit');
        const before = await kit.inbox.execute({ userId: VENDOR_A.owner, workspaceId: WS_VA });
        expect(before.ok && before.value.invitations[0]).toMatchObject({ hasDraft: false, latestBidTotal: 3800, status: 'submitted' });
        await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: LINES.map(l => ({ idx: l.idx, bidId: a.value.id })), installmentsFrom: {}, note: '' } });
        const won = await kit.inbox.execute({ userId: VENDOR_A.owner, workspaceId: WS_VA });
        const lost = await kit.inbox.execute({ userId: VENDOR_B, workspaceId: WS_VB });
        expect(won.ok && won.value.invitations[0]?.outcome).toBe('won');
        expect(lost.ok && lost.value.invitations[0]?.outcome).toBe('lost');
    });

    it('cancelled packages show as cancelled; withdrawn invitations and draft packages are hidden; newest first', async () => {
        const kit = biddingKit();
        kit.seed({ status: 'cancelled' });
        const P2 = asPackageId('00000000-0000-4000-a000-000000000301');
        const P3 = asPackageId('00000000-0000-4000-a000-000000000302');
        kit.pkg({ id: P2, title: 'งานทาสี' });
        kit.pkg({ id: P3, title: 'ร่าง', status: 'draft' });
        kit.invitation(asScInvitationId('00000000-0000-4000-a000-000000000410'), WS_VA, { packageId: P2, sentAt: new Date('2026-01-01T00:00:00.000Z') });
        kit.invitation(asScInvitationId('00000000-0000-4000-a000-000000000411'), WS_VA, { packageId: P2, status: 'withdrawn' });
        kit.invitation(asScInvitationId('00000000-0000-4000-a000-000000000412'), WS_VA, { packageId: P3 });
        const r = await kit.inbox.execute({ userId: VENDOR_A.owner, workspaceId: WS_VA });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.invitations.map(i => [i.title, i.outcome])).toEqual([['งานทาสี', 'pending'], ['งานก่อฉาบ', 'cancelled']]);
    });

    it('only members of the vendor workspace (not_found otherwise); platform off → module_disabled', async () => {
        const kit = biddingKit();
        kit.seed();
        expect(codeOf(await kit.inbox.execute({ userId: VENDOR_B, workspaceId: WS_VA }))).toBe('not_found');
        expect(codeOf(await kit.inbox.execute({ userId: OUTSIDER, workspaceId: WS_VA }))).toBe('not_found');
        expect(codeOf(await kit.inbox.execute({ userId: BUYER.owner, workspaceId: WS_VA }))).toBe('not_found');
        // the buyer switching its module off does not hide the crew's inbox
        kit.flags.set(WS_BUYER, 'subcontracting', false);
        expect(codeOf(await kit.inbox.execute({ userId: VENDOR_A.owner, workspaceId: WS_VA }))).toBeUndefined();
        kit.flags.platform.clear();
        expect(codeOf(await kit.inbox.execute({ userId: VENDOR_A.owner, workspaceId: WS_VA }))).toBe('module_disabled');
    });
});
