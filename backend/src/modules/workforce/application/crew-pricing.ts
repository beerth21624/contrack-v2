// ─── Prices crews for the list / responses: the rate cards they name, read in one lookup ───
import { Injectable } from '@nestjs/common';
import { RateCardLookup, type RateCardRates } from '../../../shared/application/ports';
import type { RateCardId, WorkspaceId } from '../../../shared/domain';
import type { Crew } from '../domain/entities/crew.entity';
import { crewDailyCost } from '../domain/policies/crew-cost.policy';

export interface PricedCrew {
    crew: Crew;
    /** ฿/day (override, else from the rate card, else null) — before the role decides whether it is shown. */
    dailyCost: number | null;
}

@Injectable()
export class CrewPricing {
    constructor(private readonly cards: RateCardLookup) {}

    async price(workspaceId: WorkspaceId, crews: readonly Crew[]): Promise<PricedCrew[]> {
        const ids = crews.flatMap(c => (c.rateCardId === null || c.dailyCostOverride !== null ? [] : [c.rateCardId]));
        const cards = ids.length === 0 ? new Map<RateCardId, RateCardRates>() : await this.cards.findMany(workspaceId, ids);
        return crews.map(crew => ({
            crew,
            dailyCost: crewDailyCost(crew, crew.rateCardId === null ? undefined : cards.get(crew.rateCardId)),
        }));
    }

    async priceOne(workspaceId: WorkspaceId, crew: Crew): Promise<PricedCrew> {
        const [priced] = await this.price(workspaceId, [crew]);
        return priced ?? { crew, dailyCost: null };
    }
}
