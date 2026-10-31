// ─── State machine of a quotation version (docs/erp/02-domain-model.md §2) ───
import type { QuotationResponseAction, QuotationVersionStatus } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../shared/domain/result';

export const QUOTATION_VERSION_TRANSITIONS: Readonly<Record<QuotationVersionStatus, readonly QuotationVersionStatus[]>> = {
    // cancelled from pending_approval = the draft withdrawn while waiting (the approval request is cancelled too, D-189)
    draft: ['pending_approval', 'issued', 'cancelled'],
    pending_approval: ['issued', 'draft', 'cancelled'],
    issued: ['accepted', 'change_requested', 'rejected', 'expired', 'superseded'],
    change_requested: ['superseded'],
    accepted: [],
    rejected: [],
    expired: [],
    superseded: [],
    cancelled: [],
};

export function canTransition(from: QuotationVersionStatus, to: QuotationVersionStatus): boolean {
    return QUOTATION_VERSION_TRANSITIONS[from].includes(to);
}

/** conflict `invalid_transition` unless `current` is one of `allowed`. */
export function requireStatus(current: QuotationVersionStatus, allowed: readonly QuotationVersionStatus[]): Result<void, DomainError> {
    if (allowed.includes(current)) return okVoid();
    return err(DomainError.conflict(`The quotation version is ${current}`, { reason: 'invalid_transition', status: current }));
}

/** Editing anything but a draft: 409 `approval_pending` while waiting, `invalid_transition` when cancelled, `already_issued` otherwise. */
export function requireDraft(current: QuotationVersionStatus): Result<void, DomainError> {
    if (current === 'draft') return okVoid();
    if (current === 'pending_approval') {
        return err(DomainError.conflict('The quotation version is waiting for approval', { reason: 'approval_pending' }));
    }
    if (current === 'cancelled') return requireStatus(current, ['draft']);
    return err(DomainError.conflict('The quotation version has been issued; make a new version to change it', { reason: 'already_issued', status: current }));
}

/** Status a customer's answer moves an issued version to. */
export const RESPONSE_STATUS: Readonly<Record<QuotationResponseAction, QuotationVersionStatus>> = {
    accept: 'accepted',
    request_change: 'change_requested',
    reject: 'rejected',
};

/** `${base}-R<n>` for the n-th re-issue (the first issue carries the base number). */
export function revisionNumber(base: string, reissues: number): string {
    return reissues <= 0 ? base : `${base}-R${reissues}`;
}
