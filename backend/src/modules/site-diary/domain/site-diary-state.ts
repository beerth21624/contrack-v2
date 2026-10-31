// ─── State machine of a daily report (docs/erp/02-domain-model.md §8.1) ───
import type { SiteReportStatus } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../shared/domain/result';

export const SITE_REPORT_TRANSITIONS: Readonly<Record<SiteReportStatus, readonly SiteReportStatus[]>> = {
    draft: ['submitted'],
    // Reopen: back to draft to fix it (the posted labour cost is reversed).
    submitted: ['draft'],
};

/** conflict `invalid_transition` unless `current` is one of `allowed`. */
export function requireStatus(current: SiteReportStatus, allowed: readonly SiteReportStatus[]): Result<void, DomainError> {
    if (allowed.includes(current)) return okVoid();
    return err(DomainError.conflict(`The report is ${current}`, { reason: 'invalid_transition', status: current }));
}

/** conflict `invalid_transition` unless `current` may move to `to`. */
export function requireTransition(current: SiteReportStatus, to: SiteReportStatus): Result<void, DomainError> {
    return SITE_REPORT_TRANSITIONS[current].includes(to) ? okVoid() : requireStatus(current, []);
}

/** unprocessable `future_date` for a report date after today (Bangkok). */
export function requireNotFuture(reportDate: string, today: string): Result<void, DomainError> {
    if (reportDate <= today) return okVoid();
    return err(DomainError.unprocessable('A daily report cannot be written for a future date', { reason: 'future_date', today }));
}
