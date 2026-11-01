// ─── State machine of supplier bills (docs/erp/02-domain-model.md §10) ───
import type { SupplierBillStatus } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../shared/domain/result';

export const SUPPLIER_BILL_TRANSITIONS: Readonly<Record<SupplierBillStatus, readonly SupplierBillStatus[]>> = {
    // draft → approved when the approval is skipped (policy off, solo, …).
    draft: ['pending_approval', 'approved', 'voided'],
    // Rejected: back to draft. Voiding a pending bill withdraws its approval request.
    pending_approval: ['approved', 'draft', 'voided'],
    // scheduled / paid: payment runs (WP-50). An approved bill not paid yet may be voided (reversed).
    approved: ['scheduled', 'voided'],
    scheduled: ['approved', 'paid'],
    paid: [],
    voided: [],
};

/** conflict `invalid_transition` unless the bill may move to `to`. */
export function requireBillTransition(current: SupplierBillStatus, to: SupplierBillStatus): Result<void, DomainError> {
    if (SUPPLIER_BILL_TRANSITIONS[current].includes(to)) return okVoid();
    return err(DomainError.conflict(`The supplier bill is ${current}`, { reason: 'invalid_transition', status: current }));
}

/** Editing: draft only (waiting for approval → `approval_pending`). */
export function requireBillDraft(current: SupplierBillStatus): Result<void, DomainError> {
    if (current === 'draft') return okVoid();
    if (current === 'pending_approval') {
        return err(DomainError.conflict('The supplier bill is waiting for approval', { reason: 'approval_pending', status: current }));
    }
    return err(DomainError.conflict(`The supplier bill is ${current}`, { reason: 'invalid_transition', status: current }));
}
