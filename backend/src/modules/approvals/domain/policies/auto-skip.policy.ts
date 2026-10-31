// ─── Auto-skip rules of a new approval request (docs/erp/01-architecture.md §6.3), pure ───
// 1. policy off, or amount below minAmount → approved (policy_off / below_threshold)
// 2. eligible = members whose role is one of the policy's approver roles
// 3. the requester is eligible and (selfApprove, or the only eligible member) → approved (self_approve / solo)
// 4. nobody eligible → approved (no_approver)
// 5. else pending; `notify` = eligible members other than the requester
import type { ApprovalAutoReason, ApprovalPolicy, Role } from '@contrack/contract';
import type { UserId } from '../../../../shared/domain/ids';

export interface AutoSkipInput {
    policy: ApprovalPolicy;
    /** null = the document has no amount (never "below" the threshold). */
    amount: number | null;
    requestedBy: UserId;
    requesterRole: Role;
    members: readonly { userId: UserId; role: Role }[];
}

export type AutoSkipOutcome =
    | { status: 'approved'; reason: ApprovalAutoReason }
    | { status: 'pending'; eligible: UserId[]; notify: UserId[] };

export function autoSkip(input: AutoSkipInput): AutoSkipOutcome {
    const { policy } = input;
    if (!policy.enabled) return { status: 'approved', reason: 'policy_off' };
    if (policy.minAmount !== null && input.amount !== null && input.amount < policy.minAmount) {
        return { status: 'approved', reason: 'below_threshold' };
    }

    const roles = new Set<Role>(policy.approverRoles);
    const eligible = [...new Set(input.members.filter(m => roles.has(m.role)).map(m => m.userId))];
    // The requester's role comes from the access check of the same request (the member list may lag behind).
    const requesterEligible = roles.has(input.requesterRole);
    if (requesterEligible && !eligible.includes(input.requestedBy)) eligible.push(input.requestedBy);
    if (!requesterEligible) {
        const at = eligible.indexOf(input.requestedBy);
        if (at >= 0) eligible.splice(at, 1);
    }

    if (requesterEligible) {
        if (eligible.length === 1) return { status: 'approved', reason: 'solo' };
        if (policy.selfApprove) return { status: 'approved', reason: 'self_approve' };
    }
    if (eligible.length === 0) return { status: 'approved', reason: 'no_approver' };
    return { status: 'pending', eligible, notify: eligible.filter(u => u !== input.requestedBy) };
}

/** May `userId` (with `role`) decide a pending request of these approver roles, asked by `requestedBy`? */
export function mayDecide(input: {
    userId: UserId; role: Role; approverRoles: readonly Role[]; requestedBy: UserId; selfApprove: boolean;
}): boolean {
    if (!input.approverRoles.includes(input.role)) return false;
    return input.userId !== input.requestedBy || input.selfApprove;
}
