// ─── Checks the people, crews and rate cards a request names: active, and of the same workspace ───
// Anything else (unknown, archived, another workspace's) → 422 unprocessable with { field, ids }, so the form can say
// which pick is stale. Another workspace's ids are indistinguishable from unknown ones.
import { Injectable } from '@nestjs/common';
import { RateCardLookup } from '../../../shared/application/ports';
import {
    type CrewId, DomainError, type PersonId, type RateCardId, type Result, type WorkspaceId, err, okVoid,
} from '../../../shared/domain';
import { CrewRepository } from './ports/crew.repository';
import { PersonRepository } from './ports/person.repository';

export interface StaleReference {
    field: string;
    ids: string[];
}

const stale = (what: string, field: string, ids: string[]): DomainError =>
    DomainError.unprocessable(`${what} must be active and of this workspace`, { field, ids } satisfies StaleReference);

@Injectable()
export class WorkforceReferences {
    constructor(
        private readonly people: PersonRepository,
        private readonly crews: CrewRepository,
        private readonly cards: RateCardLookup,
    ) {}

    async activePeople(workspaceId: WorkspaceId, ids: readonly PersonId[], field: string): Promise<Result<undefined, DomainError>> {
        if (ids.length === 0) return okVoid();
        const found = new Set((await this.people.findMany(workspaceId, ids)).filter(p => !p.isArchived).map(p => p.id));
        const missing = [...new Set(ids)].filter(id => !found.has(id));
        return missing.length === 0 ? okVoid() : err(stale('People', field, missing));
    }

    async activeCrew(workspaceId: WorkspaceId, id: CrewId, field = 'crewId'): Promise<Result<undefined, DomainError>> {
        const crew = await this.crews.find(workspaceId, id);
        return crew !== undefined && !crew.isArchived ? okVoid() : err(stale('The crew', field, [id]));
    }

    async activeRateCard(workspaceId: WorkspaceId, id: RateCardId, field = 'rateCardId'): Promise<Result<undefined, DomainError>> {
        const card = (await this.cards.findMany(workspaceId, [id])).get(id);
        return card !== undefined && !card.archived ? okVoid() : err(stale('The rate card', field, [id]));
    }
}
