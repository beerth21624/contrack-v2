import { asUserId, asWorkspaceId } from '../../../../../shared/domain';
import { asBidId, asPackageId, asScInvitationId } from '../../../shared/ids';
import { LINES, unitBid } from '../../testing/bidding-test-kit';
import { priceBid } from '../policies/bid-pricing.policy';
import { Bid } from './bid.entity';

const owner = {
    id: asBidId('00000000-0000-4000-8000-000000000001'),
    buyerWorkspaceId: asWorkspaceId('00000000-0000-4000-8000-0000000000aa'),
    packageId: asPackageId('00000000-0000-4000-8000-0000000000bb'),
    invitationId: asScInvitationId('00000000-0000-4000-8000-0000000000cc'),
    vendorWorkspaceId: null,
    packageVersion: 1,
};
const at = new Date('2026-01-01T00:00:00.000Z');
const later = new Date('2026-01-02T00:00:00.000Z');

describe('Bid', () => {
    it('a draft is version 0 and can be revised', () => {
        const bid = Bid.draft(owner, priceBid(LINES, unitBid()), at);
        expect(bid.isDraft).toBe(true);
        expect(bid.version).toBe(0);
        bid.revise(priceBid(LINES, unitBid({ adjustment: -800 })), 2, later);
        expect(bid.total).toBe(3000);
        expect(bid.packageVersion).toBe(2);
        expect(bid.toProps().updatedAt).toEqual(later);
    });

    it('a submitted version moves only its status: superseded, withdrawn, selected / not_selected (once)', () => {
        const make = () => Bid.submitted({ ...owner, version: 1, enteredByBuyer: false, submittedBy: asUserId(owner.id) }, priceBid(LINES, unitBid()), at);
        const a = make();
        expect(a.status).toBe('submitted');
        expect(() => { a.revise(priceBid(LINES, unitBid()), 1, later); }).toThrow();
        expect(a.supersede(later)).toBe(true);
        expect(a.supersede(later)).toBe(false);
        expect(a.withdraw(later)).toBe(false);
        const b = make();
        expect(b.withdraw(later)).toBe(true);
        expect(b.toProps().withdrawnAt).toEqual(later);
        expect(b.decide(true, later)).toBe(false);
        const c = make();
        expect(c.decide(false, later)).toBe(true);
        expect(c.status).toBe('not_selected');
        expect(make().decide(true, later) ).toBe(true);
    });

    it('refuses version 0 for a submitted bid', () => {
        expect(() => Bid.submitted({ ...owner, version: 0, enteredByBuyer: false, submittedBy: asUserId(owner.id) }, priceBid(LINES, unitBid()), at)).toThrow();
    });

    it('toView exposes what other streams need', () => {
        const bid = Bid.submitted({ ...owner, version: 3, enteredByBuyer: true, submittedBy: asUserId(owner.id) }, priceBid(LINES, unitBid()), at);
        expect(bid.toView()).toMatchObject({ id: owner.id, version: 3, status: 'submitted', mode: 'unit', total: 3800, enteredByBuyer: true, submittedAt: at });
    });
});
