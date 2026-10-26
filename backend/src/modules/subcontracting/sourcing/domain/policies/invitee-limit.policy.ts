// ─── How many crews a package may be sent to (plan §4.3 step 3) ───
// direct: exactly one crew in total (skips the comparison); rfq: up to 8. Withdrawn and declined invitations do not
// count, so a buyer can replace a crew that said no.
import type { SourcingMode } from '@contrack/contract';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../../../shared/domain/result';
import { SourcingErrors } from '../sourcing.errors';

export const MAX_RFQ_INVITEES = 8;

export function checkInviteeCount(mode: SourcingMode, inRunning: number, adding: number): Result<undefined, DomainError> {
    const total = inRunning + adding;
    if (mode === 'direct') return total === 1 ? okVoid() : err(SourcingErrors.tooManyInvitees(1));
    if (mode === 'rfq') return total <= MAX_RFQ_INVITEES ? okVoid() : err(SourcingErrors.tooManyInvitees(MAX_RFQ_INVITEES));
    return err(SourcingErrors.openSourcingUnsupported());
}
