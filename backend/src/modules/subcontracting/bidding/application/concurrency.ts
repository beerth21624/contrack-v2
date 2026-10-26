// ─── Concurrent changes inside a bidding transaction ───
// `UnitOfWork.run` commits even when the work returns an error Result, so a check that can only be made after a first
// write (a row lock, a compare-and-set) throws `ConcurrentChange` instead: the throw rolls the transaction back, and
// `runRefusingRaces` turns it (and a duplicate bid version) into a 409 after the rollback.
// Lock order shared by submit / withdraw / award: package row → invitation row(s) → bid rows.
import type { UnitOfWork } from '../../../../shared/application/ports';
import { DomainError, type Result, err, ok } from '../../../../shared/domain';
import { BidVersionTaken } from './ports/bid.repository';

export class ConcurrentChange extends Error {
    constructor(readonly reason: string, message: string, readonly details: Record<string, unknown> = {}) {
        super(message);
        this.name = 'ConcurrentChange';
    }
}

/** Runs `work` in one transaction; a concurrent change rolls it back and comes back as a 409 conflict. */
export async function runRefusingRaces<T>(uow: UnitOfWork, work: () => Promise<T>): Promise<Result<T, DomainError>> {
    try {
        return ok(await uow.run(work));
    } catch (error) {
        if (error instanceof ConcurrentChange) return err(DomainError.conflict(error.message, { reason: error.reason, ...error.details }));
        if (error instanceof BidVersionTaken) return err(bidChangedMeanwhile());
        throw error;
    }
}

/** Two saves / submissions of one invitation at the same time: the later one is refused (reload and retry). */
export function bidChangedMeanwhile(): DomainError {
    return DomainError.conflict('The bid was changed at the same time, reload and try again', { reason: 'bid_changed' });
}
