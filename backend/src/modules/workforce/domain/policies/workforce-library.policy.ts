// ─── Rules of a workspace's people and crews: limits, unique crew names, nothing archived while still on a job ───
import {
    MAX_ACTIVE_CREWS, MAX_ACTIVE_PEOPLE, type WorkforceConflictDetails,
} from '@contrack/contract';
import { type CrewId, DomainError, type Result, err, okVoid } from '../../../../shared/domain';
import type { WorkforceName } from '../value-objects/workforce-name.value-object';

function limitReached(what: string, limit: number): DomainError {
    const details: WorkforceConflictDetails = { reason: 'limit_reached', limit };
    return DomainError.conflict(`A workspace keeps at most ${limit} active ${what}; archive one first`, details);
}

/** One more active person fits when the workspace has fewer than MAX_ACTIVE_PEOPLE. */
export function checkRoomForAnotherPerson(activeCount: number): Result<undefined, DomainError> {
    return activeCount < MAX_ACTIVE_PEOPLE ? okVoid() : err(limitReached('people', MAX_ACTIVE_PEOPLE));
}

/** One more active crew fits when the workspace has fewer than MAX_ACTIVE_CREWS. */
export function checkRoomForAnotherCrew(activeCount: number): Result<undefined, DomainError> {
    return activeCount < MAX_ACTIVE_CREWS ? okVoid() : err(limitReached('crews', MAX_ACTIVE_CREWS));
}

/**
 * `name` is free unless another active crew (`holder`, found by the same key) uses it. The crew being renamed may keep
 * its own name with another case ("ทีม a" → "ทีม A").
 */
export function checkCrewNameFree(name: WorkforceName, holder: { id: CrewId } | undefined, self?: CrewId): Result<undefined, DomainError> {
    if (holder === undefined || holder.id === self) return okVoid();
    const details: WorkforceConflictDetails = { reason: 'name_taken', name: name.value };
    return err(DomainError.conflict(`A crew named "${name.value}" already exists`, details));
}

/**
 * A person or crew may be archived only when no assignment that ends today or later still uses it (move or delete
 * those first). Past assignments are history and do not block.
 */
export function checkNotInUse(what: 'person' | 'crew', openAssignments: number): Result<undefined, DomainError> {
    if (openAssignments <= 0) return okVoid();
    const details: WorkforceConflictDetails = { reason: 'in_use', assignments: openAssignments };
    return err(DomainError.conflict(`The ${what} is still assigned to ${openAssignments} task(s) that have not ended`, details));
}
