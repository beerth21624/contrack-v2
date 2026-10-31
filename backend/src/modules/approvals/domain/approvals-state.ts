// ─── State machine of an approval request (docs/erp/02-domain-model.md §1.4): every end state is final ───
import type { ApprovalStatus } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../shared/domain/result';

export const APPROVAL_TRANSITIONS: Readonly<Record<ApprovalStatus, readonly ApprovalStatus[]>> = {
    pending: ['approved', 'rejected', 'cancelled'],
    approved: [],
    rejected: [],
    cancelled: [],
};

export function canTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
    return APPROVAL_TRANSITIONS[from].includes(to);
}

/** conflict `invalid_transition` unless `current` is one of `allowed`. */
export function requireStatus(current: ApprovalStatus, allowed: readonly ApprovalStatus[]): Result<void, DomainError> {
    if (allowed.includes(current)) return okVoid();
    return err(DomainError.conflict(`The approval request is ${current}`, { reason: 'invalid_transition', status: current }));
}
