// ─── State machine of a variation order (docs/erp/02-domain-model.md §5) ───
import type { VariationStatus } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../shared/domain/result';

export const VARIATION_TRANSITIONS: Readonly<Record<VariationStatus, readonly VariationStatus[]>> = {
    draft: ['pending_approval', 'submitted', 'cancelled'],
    pending_approval: ['submitted', 'draft', 'cancelled'],
    submitted: ['accepted', 'rejected', 'withdrawn'],
    accepted: [],
    rejected: [],
    withdrawn: [],
    cancelled: [],
};

/** conflict `invalid_transition` unless `current` is one of `allowed`. */
export function requireStatus(current: VariationStatus, allowed: readonly VariationStatus[]): Result<void, DomainError> {
    if (allowed.includes(current)) return okVoid();
    return err(DomainError.conflict(`The variation is ${current}`, { reason: 'invalid_transition', status: current }));
}

/** conflict `invalid_transition` unless `current` may move to `to`. */
export function requireTransition(current: VariationStatus, to: VariationStatus): Result<void, DomainError> {
    return VARIATION_TRANSITIONS[current].includes(to) ? okVoid() : requireStatus(current, []);
}

/** Editing the content: draft only; waiting for approval → `approval_pending`, sent → `already_issued`. */
export function requireDraft(current: VariationStatus): Result<void, DomainError> {
    if (current === 'draft') return okVoid();
    if (current === 'pending_approval') {
        return err(DomainError.conflict('The variation is waiting for approval', { reason: 'approval_pending', status: current }));
    }
    if (current === 'cancelled') return requireStatus(current, ['draft']);
    return err(DomainError.conflict('The variation has been submitted and can no longer be changed', { reason: 'already_issued', status: current }));
}
