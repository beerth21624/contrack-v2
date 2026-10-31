// ─── Project status machine (docs/erp/02-domain-model.md §1.9) ───
import { type HubProjectStatus, PROJECT_STATUSES, PROJECT_STATUS_ORDER, PROJECT_STATUS_TRANSITIONS, type Role } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../shared/domain/result';

export const canTransition = (from: HubProjectStatus, to: HubProjectStatus): boolean => PROJECT_STATUS_TRANSITIONS[from].includes(to);

/** Re-opening a closed project (`closed → warranty`) is for the owner only. */
const ownerOnly = (from: HubProjectStatus, to: HubProjectStatus): boolean => from === 'closed' && to === 'warranty';

/** A user's status change: off-table → conflict `invalid_transition`; the owner-only step by someone else → forbidden. */
export function checkUserTransition(from: HubProjectStatus, to: HubProjectStatus, role: Role): Result<void, DomainError> {
    if (!canTransition(from, to)) {
        return err(DomainError.conflict(`A project cannot move from ${from} to ${to}`, { reason: 'invalid_transition', from, to }));
    }
    if (ownerOnly(from, to) && role !== 'owner') return err(DomainError.forbidden('Only the owner can re-open a closed project'));
    return ok(undefined);
}

/** The statuses `role` may move a project in `from` to (for the overview's status menu). */
export const nextStatusesFor = (from: HubProjectStatus, role: Role): HubProjectStatus[] =>
    PROJECT_STATUSES.filter(to => canTransition(from, to) && (!ownerOnly(from, to) || role === 'owner'));

/**
 * The status an automatic advance to `to` leaves: `to` when it lies ahead of `from` on the forward path, else `from`
 * (already there or past it, or the project is `lost` / `cancelled`).
 */
export function advancedStatus(from: HubProjectStatus, to: HubProjectStatus): HubProjectStatus {
    const at = PROJECT_STATUS_ORDER.indexOf(from);
    const target = PROJECT_STATUS_ORDER.indexOf(to);
    if (at < 0 || target < 0) return from;
    return target > at ? to : from;
}
