// ─── State machines of labour (docs/erp/02-domain-model.md §8.2) ───
import { PAY_PERIOD_LOCKED_STATUSES, type PayPeriodStatus, type WageAdvanceStatus } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../shared/domain/result';

export const PAY_PERIOD_TRANSITIONS: Readonly<Record<PayPeriodStatus, readonly PayPeriodStatus[]>> = {
    // open → approved when the approval is skipped (policy off, solo, …).
    open: ['pending_approval', 'approved'],
    // Rejected: back to open (rebuild, approve again).
    pending_approval: ['approved', 'open'],
    approved: ['paid'],
    paid: [],
};

export const WAGE_ADVANCE_TRANSITIONS: Readonly<Record<WageAdvanceStatus, readonly WageAdvanceStatus[]>> = {
    open: ['partially_recovered', 'recovered', 'written_off'],
    partially_recovered: ['open', 'recovered', 'written_off'],
    // A rebuilt pay period can give a recovery back.
    recovered: ['open', 'partially_recovered'],
    written_off: [],
};

/** conflict `invalid_transition` unless the period may move to `to`. */
export function requirePeriodTransition(current: PayPeriodStatus, to: PayPeriodStatus): Result<void, DomainError> {
    if (PAY_PERIOD_TRANSITIONS[current].includes(to)) return okVoid();
    return err(DomainError.conflict(`The pay period is ${current}`, { reason: 'invalid_transition', status: current }));
}

/** conflict `period_locked` when timesheets of a period in this status may not change. */
export function requirePeriodUnlocked(status: PayPeriodStatus | undefined, periodKey: string): Result<void, DomainError> {
    if (status === undefined || !PAY_PERIOD_LOCKED_STATUSES.includes(status)) return okVoid();
    return err(DomainError.conflict(`The pay period ${periodKey} is ${status}`, { reason: 'period_locked', periodKey, status }));
}

/** unprocessable `future_work_date` for a work date after today (Bangkok). */
export function requireNotFuture(workDate: string, today: string): Result<void, DomainError> {
    if (workDate <= today) return okVoid();
    return err(DomainError.unprocessable('Timesheets cannot be written for a future date', { reason: 'future_work_date', today }));
}

/** Status of an advance (not written off) from what is recovered. */
export function advanceStatusOf(amount: number, recovered: number): WageAdvanceStatus {
    if (recovered <= 0) return 'open';
    return recovered >= amount ? 'recovered' : 'partially_recovered';
}
