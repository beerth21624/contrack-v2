import { asBidId, asPackageId } from '../../../shared/ids';
import { BidVersionTaken } from '../../application/ports/bid.repository';
import { BUYER, INV_A, INV_B, INV_C, LINES, PKG, VENDOR_A, VENDOR_B, WS_OTHER_BUYER, biddingKit, unitBid } from '../../testing/bidding-test-kit';

describe('RepositoryBidDirectory + InMemoryBidRepository', () => {
    it('latestSubmitted: latest version per invitation, none when it was withdrawn, drafts never', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid({ adjustment: -1 }) });
        await kit.submit.execute({ userId: VENDOR_B, invitationId: INV_B, body: unitBid() });
        await kit.withdraw.execute({ userId: VENDOR_B, invitationId: INV_B });
        const draft = await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: {} });
        const latest = await kit.directory.latestSubmitted([INV_A, INV_B, INV_C]);
        expect([...latest.keys()]).toEqual([INV_A]);
        expect(latest.get(INV_A)).toMatchObject({ version: 2, total: 3799, status: 'submitted' });
        expect(draft.ok && await kit.directory.find(asBidId(draft.value.id))).toBeUndefined();
        expect(await kit.directory.find(asBidId('00000000-0000-4000-8000-0000000fffff'))).toBeUndefined();
    });

    it('insert refuses a second row with the same (invitation, version)', async () => {
        const kit = biddingKit();
        kit.seed();
        const a = await kit.manualBid.execute({ userId: BUYER.owner, invitationId: INV_A, body: unitBid() });
        if (!a.ok) throw new Error('manual');
        const bid = await kit.bids.findById(asBidId(a.value.id));
        if (bid === undefined) throw new Error('missing');
        await expect(kit.bids.insert(bid)).rejects.toBeInstanceOf(BidVersionTaken);
    });

    it('resetDecisions: selected / not_selected bids of the package go back to submitted, so it can be awarded again', async () => {
        const kit = biddingKit();
        const pkg = kit.seed();
        const a = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        const b = await kit.submit.execute({ userId: VENDOR_B, invitationId: INV_B, body: unitBid({ adjustment: -10 }) });
        if (!a.ok || !b.ok) throw new Error('submit');
        const all = (bidId: string) => LINES.map(l => ({ idx: l.idx, bidId }));
        const first = await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(a.value.id), installmentsFrom: {}, note: '' } });
        expect(first.ok).toBe(true);

        kit.clock.set(new Date('2026-01-20T00:00:00.000Z'));
        await kit.directory.resetDecisions(PKG);
        const bids = await kit.bids.listSubmittedOfPackage(pkg.buyerWorkspaceId, PKG);
        expect(bids.map(x => [x.id, x.status])).toEqual(expect.arrayContaining([[a.value.id, 'submitted'], [b.value.id, 'submitted']]));
        expect(bids.every(x => x.toProps().decidedAt === null)).toBe(true);
        expect(bids.every(x => x.toProps().updatedAt.toISOString() === '2026-01-20T00:00:00.000Z')).toBe(true);
        expect((await kit.directory.latestSubmitted([INV_A, INV_B])).size).toBe(2);

        // contracts reopens the package (reviewing): it can be awarded again, to the other bid
        kit.pkg({ ...pkg, status: 'reviewing' });
        const again = await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: all(b.value.id), installmentsFrom: {}, note: '' } });
        expect(again.ok).toBe(true);
        expect((await kit.directory.find(asBidId(b.value.id)))?.status).toBe('selected');
        expect((await kit.directory.find(asBidId(a.value.id)))?.status).toBe('not_selected');
    });

    it('resetDecisions only touches the bids of that package in its buyer workspace; superseded / withdrawn stay', async () => {
        const kit = biddingKit();
        kit.seed();
        const v1 = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid() });
        const v2 = await kit.submit.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: unitBid({ adjustment: -1 }) });
        if (!v1.ok || !v2.ok) throw new Error('submit');
        await kit.award.execute({ userId: BUYER.owner, packageId: PKG, body: { allocations: LINES.map(l => ({ idx: l.idx, bidId: v2.value.id })), installmentsFrom: {}, note: '' } });
        await kit.bids.resetDecisions(WS_OTHER_BUYER, PKG, kit.clock.now());
        expect((await kit.directory.find(asBidId(v2.value.id)))?.status).toBe('selected');
        await kit.directory.resetDecisions(asPackageId('00000000-0000-4000-a000-000000000fff'));
        expect((await kit.directory.find(asBidId(v2.value.id)))?.status).toBe('selected');
        await kit.directory.resetDecisions(PKG);
        expect((await kit.directory.find(asBidId(v1.value.id)))?.status).toBe('superseded');
        expect((await kit.directory.find(asBidId(v2.value.id)))?.status).toBe('submitted');
    });
});
