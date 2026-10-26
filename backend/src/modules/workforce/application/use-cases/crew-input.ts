// ─── Raw crew fields (from the edge) → validated domain values; the people and card they name are checked here too ───
import {
    DomainError, type PersonId, type RateCardId, type Result, type WorkspaceId, asPersonId, asRateCardId, err, ok, okVoid,
} from '../../../../shared/domain';
import { MAX_CREW_HEADCOUNT } from '@contrack/contract';
import type { Crew, CrewChanges, CrewFields } from '../../domain/entities/crew.entity';
import { bahtPerDay, distinct, headcount, trade, workforceNote } from '../../domain/value-objects/workforce-fields';
import { WorkforceName } from '../../domain/value-objects/workforce-name.value-object';
import type { WorkforceReferences } from '../workforce-references';

export interface CrewInput {
    name?: string;
    trade?: string;
    leaderId?: string | null;
    memberIds?: readonly string[];
    skilledCount?: number;
    labourerCount?: number;
    rateCardId?: string | null;
    dailyCostOverride?: number | null;
    note?: string | null;
}

/** Validates the fields that are given (undefined = not given); null clears an optional field. */
export function parseCrewChanges(input: CrewInput): Result<CrewChanges, DomainError> {
    const changes: CrewChanges = {};
    if (input.name !== undefined) {
        const r = WorkforceName.create(input.name, 'crew');
        if (!r.ok) return r;
        changes.name = r.value;
    }
    if (input.trade !== undefined) {
        const r = trade(input.trade);
        if (!r.ok) return r;
        changes.trade = r.value;
    }
    if (input.leaderId !== undefined) changes.leaderId = input.leaderId === null ? null : asPersonId(input.leaderId.toLowerCase());
    if (input.memberIds !== undefined) {
        const members = distinct(input.memberIds.map(id => asPersonId(id.toLowerCase())));
        if (members.length > MAX_CREW_HEADCOUNT) {
            return err(DomainError.validation(`A crew lists at most ${MAX_CREW_HEADCOUNT} named members`));
        }
        changes.memberIds = members;
    }
    if (input.skilledCount !== undefined) {
        const r = headcount(input.skilledCount, 'skilled count');
        if (!r.ok) return r;
        changes.skilledCount = r.value;
    }
    if (input.labourerCount !== undefined) {
        const r = headcount(input.labourerCount, 'labourer count');
        if (!r.ok) return r;
        changes.labourerCount = r.value;
    }
    if (input.rateCardId !== undefined) changes.rateCardId = input.rateCardId === null ? null : asRateCardId(input.rateCardId.toLowerCase());
    if (input.dailyCostOverride !== undefined) {
        const r = bahtPerDay(input.dailyCostOverride, 'daily cost');
        if (!r.ok) return r;
        changes.dailyCostOverride = r.value;
    }
    if (input.note !== undefined) {
        const r = workforceNote(input.note);
        if (!r.ok) return r;
        changes.note = r.value;
    }
    return ok(changes);
}

/** Every field of a new crew (name, trade and both counts required; the rest default to empty). */
export function parseNewCrew(
    input: CrewInput & { name: string; trade: string; skilledCount: number; labourerCount: number },
): Result<CrewFields, DomainError> {
    const parsed = parseCrewChanges({ leaderId: null, memberIds: [], rateCardId: null, dailyCostOverride: null, note: null, ...input });
    if (!parsed.ok) return parsed;
    const c = parsed.value;
    if (c.name === undefined || c.trade === undefined || c.skilledCount === undefined || c.labourerCount === undefined) {
        throw new Error('required crew fields missing');
    }
    return ok({
        name: c.name,
        trade: c.trade,
        leaderId: c.leaderId ?? null,
        memberIds: c.memberIds ?? [],
        skilledCount: c.skilledCount,
        labourerCount: c.labourerCount,
        rateCardId: c.rateCardId ?? null,
        dailyCostOverride: c.dailyCostOverride ?? null,
        note: c.note ?? null,
    });
}

/**
 * The leader, members and rate card a write names must be active and of the workspace (422 otherwise). On an update
 * only what changes is checked: a crew keeps a card that was archived after it was picked until someone picks another.
 */
export async function checkCrewReferences(
    refs: WorkforceReferences, workspaceId: WorkspaceId, changes: CrewChanges, current?: Crew,
): Promise<Result<undefined, DomainError>> {
    const leader: PersonId | null | undefined = changes.leaderId;
    if (leader !== undefined && leader !== null && leader !== current?.leaderId) {
        const r = await refs.activePeople(workspaceId, [leader], 'leaderId');
        if (!r.ok) return r;
    }
    if (changes.memberIds !== undefined) {
        const known = new Set(current?.memberIds ?? []);
        const r = await refs.activePeople(workspaceId, changes.memberIds.filter(id => !known.has(id)), 'memberIds');
        if (!r.ok) return r;
    }
    const card: RateCardId | null | undefined = changes.rateCardId;
    if (card !== undefined && card !== null && card !== current?.rateCardId) {
        const r = await refs.activeRateCard(workspaceId, card);
        if (!r.ok) return r;
    }
    return okVoid();
}
