// ─── State machine of a main contract (docs/erp/02-domain-model.md §3) ───
import type { MainContractStatus } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../shared/domain/result';

export const MAIN_CONTRACT_TRANSITIONS: Readonly<Record<MainContractStatus, readonly MainContractStatus[]>> = {
    draft: ['signed', 'cancelled'],
    signed: ['completed', 'terminated'],
    completed: ['closed'],
    closed: [],
    cancelled: [],
    terminated: [],
};

/** Statuses of a contract in force or done (block unlocking the baseline, count in the hub). */
export const SIGNED_STATUSES: readonly MainContractStatus[] = ['signed', 'completed', 'closed'];

/** conflict `invalid_transition` unless `current` may move to `to`. */
export function requireTransition(current: MainContractStatus, to: MainContractStatus): Result<void, DomainError> {
    if (MAIN_CONTRACT_TRANSITIONS[current].includes(to)) return okVoid();
    return err(DomainError.conflict(`The contract is ${current}`, { reason: 'invalid_transition', status: current }));
}

/** conflict `invalid_transition` unless `current` is one of `allowed`. */
export function requireStatus(current: MainContractStatus, allowed: readonly MainContractStatus[]): Result<void, DomainError> {
    if (allowed.includes(current)) return okVoid();
    return err(DomainError.conflict(`The contract is ${current}`, { reason: 'invalid_transition', status: current }));
}

/** Editing the content: draft only; signed / completed / closed → `already_issued`, cancelled / terminated → `invalid_transition`. */
export function requireDraft(current: MainContractStatus): Result<void, DomainError> {
    if (current === 'draft') return okVoid();
    if (current === 'cancelled' || current === 'terminated') return requireStatus(current, ['draft']);
    return err(DomainError.conflict('The contract has been signed and can no longer be changed', { reason: 'already_issued', status: current }));
}
