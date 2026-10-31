// ─── State machines of purchase requests and RFQs (docs/erp/02-domain-model.md §7.2) ───
import type { PurchaseRequestStatus, RfqStatus } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../shared/domain/result';

export const PURCHASE_REQUEST_TRANSITIONS: Readonly<Record<PurchaseRequestStatus, readonly PurchaseRequestStatus[]>> = {
    draft: ['pending_approval', 'approved', 'cancelled'],
    pending_approval: ['approved', 'rejected', 'cancelled'],
    approved: ['partially_ordered', 'ordered', 'cancelled'],
    rejected: [],
    partially_ordered: ['ordered', 'closed'],
    ordered: ['closed'],
    closed: [],
    cancelled: [],
};

export const RFQ_TRANSITIONS: Readonly<Record<RfqStatus, readonly RfqStatus[]>> = {
    draft: ['sent', 'cancelled'],
    sent: ['awarded', 'cancelled'],
    awarded: ['closed'],
    closed: [],
    cancelled: [],
};

/** conflict `invalid_transition` unless `current` is one of `allowed`. */
export function requireStatus<S extends string>(current: S, allowed: readonly S[]): Result<void, DomainError> {
    if (allowed.includes(current)) return okVoid();
    return err(DomainError.conflict(`The document is ${current}`, { reason: 'invalid_transition', status: current }));
}

/** Editing a purchase request: draft only; waiting for approval → `approval_pending`, submitted → `already_issued`. */
export function requireRequestDraft(current: PurchaseRequestStatus): Result<void, DomainError> {
    if (current === 'draft') return okVoid();
    if (current === 'pending_approval') {
        return err(DomainError.conflict('The purchase request is waiting for approval', { reason: 'approval_pending', status: current }));
    }
    if (current === 'cancelled' || current === 'rejected') return requireStatus(current, ['draft']);
    return err(DomainError.conflict('The purchase request has been submitted and can no longer be changed', { reason: 'already_issued', status: current }));
}
