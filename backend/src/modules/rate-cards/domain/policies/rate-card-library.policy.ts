// ─── Rules of a workspace's rate-card library: at most 50 active cards, active names unique (ignoring case) ───
import { MAX_ACTIVE_RATE_CARDS, type RateCardConflictDetails } from '@contrack/contract';
import { DomainError, type RateCardId, type Result, err, okVoid } from '../../../../shared/domain';
import type { RateCardName } from '../value-objects/rate-card-name.value-object';

/** One more active card fits when the library holds fewer than MAX_ACTIVE_RATE_CARDS. */
export function checkRoomForAnotherCard(activeCount: number): Result<undefined, DomainError> {
    if (activeCount < MAX_ACTIVE_RATE_CARDS) return okVoid();
    const details: RateCardConflictDetails = { reason: 'limit_reached', limit: MAX_ACTIVE_RATE_CARDS };
    return err(DomainError.conflict(`A workspace keeps at most ${MAX_ACTIVE_RATE_CARDS} rate cards; archive one first`, details));
}

/**
 * `name` is free unless another active card (`holder`, found by the same key) uses it. The card being renamed may keep
 * its own name with another case ("team a" → "Team A").
 */
export function checkNameFree(
    name: RateCardName, holder: { id: RateCardId } | undefined, self?: RateCardId,
): Result<undefined, DomainError> {
    if (holder === undefined || holder.id === self) return okVoid();
    const details: RateCardConflictDetails = { reason: 'name_taken', name: name.value };
    return err(DomainError.conflict(`A rate card named "${name.value}" already exists`, details));
}
