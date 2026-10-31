// ─── State machines of claims and invoices (docs/erp/02-domain-model.md §4.1, §4.2) ───
import type { ArClaimStatus, InvoiceStatus } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../shared/domain/result';

export const CLAIM_TRANSITIONS: Readonly<Record<ArClaimStatus, readonly ArClaimStatus[]>> = {
    draft: ['pending_approval', 'submitted', 'cancelled'],
    pending_approval: ['submitted', 'draft', 'cancelled'],
    submitted: ['certified', 'draft', 'cancelled'],
    // certified → invoiced; a voided claim invoice brings the claim back to certified.
    certified: ['invoiced'],
    invoiced: ['certified'],
    cancelled: [],
};

/** conflict `invalid_transition` unless the claim may move from `current` to `to`. */
export function requireClaimTransition(current: ArClaimStatus, to: ArClaimStatus): Result<void, DomainError> {
    if (CLAIM_TRANSITIONS[current].includes(to)) return okVoid();
    return err(DomainError.conflict(`The claim is ${current}`, { reason: 'invalid_transition', status: current }));
}

/** conflict `invalid_transition` unless `current` is one of `allowed`. */
export function requireClaimStatus(current: ArClaimStatus, allowed: readonly ArClaimStatus[]): Result<void, DomainError> {
    if (allowed.includes(current)) return okVoid();
    return err(DomainError.conflict(`The claim is ${current}`, { reason: 'invalid_transition', status: current }));
}

/** conflict `invalid_transition` unless the invoice is one of `allowed`. */
export function requireInvoiceStatus(current: InvoiceStatus, allowed: readonly InvoiceStatus[]): Result<void, DomainError> {
    if (allowed.includes(current)) return okVoid();
    return err(DomainError.conflict(`The invoice is ${current}`, { reason: 'invalid_transition', status: current }));
}
