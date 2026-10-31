import { APPROVAL_SUBJECT_DEFAULTS, type ApprovalPolicy, type Role } from '@contrack/contract';
import { type UserId, asUserId } from '../../../../shared/domain/ids';
import { normalizeApproverRoles, normalizePolicy } from './approval-policy.policy';
import { autoSkip, mayDecide } from './auto-skip.policy';

const OWNER = asUserId('00000000-0000-4000-a000-000000000001');
const PM = asUserId('00000000-0000-4000-a000-000000000002');
const ESTIMATOR = asUserId('00000000-0000-4000-a000-000000000003');
const ADMIN = asUserId('00000000-0000-4000-a000-000000000004');

const policy = (p: Partial<ApprovalPolicy> = {}): ApprovalPolicy => ({
    enabled: true, minAmount: null, approverRoles: ['owner', 'admin', 'pm'], selfApprove: true, ...p,
});
const members = (...list: [UserId, Role][]): { userId: UserId; role: Role }[] => list.map(([userId, role]) => ({ userId, role }));

describe('autoSkip (docs/erp/01-architecture.md §6.3)', () => {
    it('1. policy off, or amount below minAmount → approved', () => {
        const team = members([OWNER, 'owner'], [ESTIMATOR, 'estimator']);
        expect(autoSkip({ policy: policy({ enabled: false }), amount: 1e6, requestedBy: ESTIMATOR, requesterRole: 'estimator', members: team }))
            .toEqual({ status: 'approved', reason: 'policy_off' });
        expect(autoSkip({ policy: policy({ minAmount: 50_000 }), amount: 49_999.99, requestedBy: ESTIMATOR, requesterRole: 'estimator', members: team }))
            .toEqual({ status: 'approved', reason: 'below_threshold' });
        // at the threshold, or without an amount, approval is needed
        expect(autoSkip({ policy: policy({ minAmount: 50_000 }), amount: 50_000, requestedBy: ESTIMATOR, requesterRole: 'estimator', members: team }).status)
            .toBe('pending');
        expect(autoSkip({ policy: policy({ minAmount: 50_000 }), amount: null, requestedBy: ESTIMATOR, requesterRole: 'estimator', members: team }).status)
            .toBe('pending');
    });

    it('2. eligible = members with an approver role (others never approve)', () => {
        const out = autoSkip({
            policy: policy(), amount: 60_000, requestedBy: ESTIMATOR, requesterRole: 'estimator',
            members: members([OWNER, 'owner'], [PM, 'pm'], [ESTIMATOR, 'estimator']),
        });
        expect(out).toEqual({ status: 'pending', eligible: [OWNER, PM], notify: [OWNER, PM] });
    });

    it('3. the requester is eligible and selfApprove, or the only eligible member → approved', () => {
        expect(autoSkip({ policy: policy(), amount: 60_000, requestedBy: OWNER, requesterRole: 'owner', members: members([OWNER, 'owner']) }))
            .toEqual({ status: 'approved', reason: 'solo' });
        expect(autoSkip({
            policy: policy({ selfApprove: false }), amount: 60_000, requestedBy: OWNER, requesterRole: 'owner',
            members: members([OWNER, 'owner'], [ESTIMATOR, 'estimator']),
        })).toEqual({ status: 'approved', reason: 'solo' });
        expect(autoSkip({
            policy: policy(), amount: 60_000, requestedBy: PM, requesterRole: 'pm', members: members([OWNER, 'owner'], [PM, 'pm']),
        })).toEqual({ status: 'approved', reason: 'self_approve' });
    });

    it('4. nobody eligible → approved (no_approver)', () => {
        expect(autoSkip({
            policy: policy({ approverRoles: ['accounting'] }), amount: 1, requestedBy: ESTIMATOR, requesterRole: 'estimator',
            members: members([OWNER, 'owner'], [ESTIMATOR, 'estimator']),
        })).toEqual({ status: 'approved', reason: 'no_approver' });
    });

    it('5. otherwise pending; the requester is never notified', () => {
        expect(autoSkip({
            policy: policy({ selfApprove: false }), amount: 60_000, requestedBy: PM, requesterRole: 'pm',
            members: members([OWNER, 'owner'], [PM, 'pm'], [ADMIN, 'admin']),
        })).toEqual({ status: 'pending', eligible: [OWNER, PM, ADMIN], notify: [OWNER, ADMIN] });
    });

    it('a solo owner skips every subject under the default policies', () => {
        for (const d of Object.values(APPROVAL_SUBJECT_DEFAULTS)) {
            const out = autoSkip({ policy: d.policy, amount: 1e7, requestedBy: OWNER, requesterRole: 'owner', members: members([OWNER, 'owner']) });
            expect(out.status).toBe('approved');
        }
    });

    it('mayDecide: an approver role, and not the requester unless selfApprove', () => {
        const base = { approverRoles: ['owner', 'pm'] as Role[], requestedBy: PM };
        expect(mayDecide({ ...base, userId: OWNER, role: 'owner', selfApprove: false })).toBe(true);
        expect(mayDecide({ ...base, userId: ESTIMATOR, role: 'estimator', selfApprove: true })).toBe(false);
        expect(mayDecide({ ...base, userId: PM, role: 'pm', selfApprove: false })).toBe(false);
        expect(mayDecide({ ...base, userId: PM, role: 'pm', selfApprove: true })).toBe(true);
    });

    it('normalizes roles (owner always, ROLES order) and rounds minAmount', () => {
        expect(normalizeApproverRoles(['pm', 'admin', 'pm'])).toEqual(['owner', 'admin', 'pm']);
        expect(normalizePolicy(policy({ minAmount: 10.005, approverRoles: [] }))).toMatchObject({ minAmount: 10.01, approverRoles: ['owner'] });
    });
});
