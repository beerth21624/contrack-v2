import { asUserId, asWorkspaceId } from '../../../../../shared/domain';
import { asClaimId, asSubcontractId, asVariationId } from '../../../shared/ids';
import { Claim } from './claim.entity';
import { contractNumber } from './subcontract.entity';
import { Variation } from './variation.entity';

const now = new Date('2026-10-26T00:00:00Z');
const user = asUserId('00000000-0000-4000-8000-000000000001');
const amounts = { gross: 100, adjustments: [], retention: 5, wht: 3, vat: 0, net: 92 };

function claim(): Claim {
    return Claim.request({
        id: asClaimId('00000000-0000-4000-8000-0000000000c1'), subcontractId: asSubcontractId('00000000-0000-4000-8000-0000000000a1'),
        buyerWorkspaceId: asWorkspaceId('00000000-0000-4000-8000-0000000000b1'), installmentNo: 1, condition: 'x', requestedBy: 'vendor',
        requestedByUser: user, photoFileIds: [], note: '', amounts, now,
    });
}

const inspection = (result: 'pass' | 'pass_with_fixes' | 'fail', done = false) => ({
    result, checklist: [], fixes: result === 'pass_with_fixes' ? [{ text: 'แก้', done }] : [], note: '', byUserId: user, byName: 'u', at: now,
});

describe('contractNumber', () => {
    it('pads the sequence', () => {
        expect(contractNumber(2026, 1)).toBe('SC-2026-0001');
        expect(contractNumber(2026, 12345)).toBe('SC-2026-12345');
    });
});

describe('Claim state machine', () => {
    it('requested → inspected → approved → paid', () => {
        const c = claim();
        expect(c.approve(amounts, user, now).ok).toBe(false);
        expect(c.pay({ paidAt: '2026-11-01', amount: 92, channel: '', ref: '', by: user, now }).ok).toBe(false);
        expect(c.inspect(inspection('pass')).ok).toBe(true);
        expect(c.approve(amounts, user, now).ok).toBe(true);
        expect(c.reject('x', now).ok).toBe(false);
        expect(c.pay({ paidAt: '2026-11-01', amount: 92, channel: '', ref: '', by: user, now }).ok).toBe(true);
        expect(c.status).toBe('paid');
    });

    it('fail → can be claimed again; never approved while failed', () => {
        const c = claim();
        expect(c.canBeRequestedAgain()).toBe(false);
        c.inspect(inspection('fail'));
        expect(c.approve(amounts, user, now).ok).toBe(false);
        expect(c.requestAgain({ requestedBy: 'buyer', requestedByUser: user, photoFileIds: [], note: 'again', amounts, now }).ok).toBe(true);
        expect(c.status).toBe('requested');
        expect(c.inspection).toBeNull();
    });

    it('follow-up after approval keeps result and status, updates fixes', () => {
        const c = claim();
        c.inspect(inspection('pass_with_fixes'));
        expect(c.hasOpenFixes()).toBe(true);
        c.approve(amounts, user, now);
        const r = c.inspect(inspection('pass_with_fixes', true));
        expect(r.ok && r.value.followUp).toBe(true);
        expect(c.hasOpenFixes()).toBe(false);
        expect(c.status).toBe('approved');
    });

    it('rejected is final', () => {
        const c = claim();
        expect(c.reject('x', now).ok).toBe(true);
        expect(c.inspect(inspection('pass')).ok).toBe(false);
    });
});

describe('Variation', () => {
    it('totals lines and is answered once by the other side', () => {
        const v = Variation.propose({
            id: asVariationId('00000000-0000-4000-8000-0000000000d1'), subcontractId: asSubcontractId('00000000-0000-4000-8000-0000000000a1'),
            buyerWorkspaceId: asWorkspaceId('00000000-0000-4000-8000-0000000000b1'), proposedBy: 'vendor', proposedByUser: user,
            lines: [{ desc: 'a', unit: 'm', qty: 1.5, unitPrice: 33.33 }, { desc: 'b', unit: 'm', qty: -2, unitPrice: 10 }], reason: 'r', now,
        });
        expect(v.state.lines.map(l => l.total)).toEqual([50, -20]);
        expect(v.amount).toBe(30);
        expect(v.respond('vendor', true, user, now).ok).toBe(false);
        expect(v.respond('buyer', true, user, now).ok).toBe(true);
        expect(v.respond('buyer', false, user, now).ok).toBe(false);
    });
});
