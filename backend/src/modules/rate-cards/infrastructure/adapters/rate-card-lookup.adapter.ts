// ─── RateCardLookup for the other modules (crews price their day from a company card) ───
import { Injectable } from '@nestjs/common';
import { RateCardLookup, type RateCardRates } from '../../../../shared/application/ports';
import type { RateCardId, WorkspaceId } from '../../../../shared/domain';
import { RateCardRepository } from '../../application/ports/rate-card.repository';

@Injectable()
export class RepositoryRateCardLookup extends RateCardLookup {
    constructor(private readonly cards: RateCardRepository) {
        super();
    }

    async findMany(workspaceId: WorkspaceId, ids: readonly RateCardId[]): Promise<Map<RateCardId, RateCardRates>> {
        const unique = [...new Set(ids)];
        const found = await this.cards.findMany(workspaceId, unique);
        return new Map(found.map(c => [c.id, {
            id: c.id, skilledRate: c.skilledRate.baht, labourerRate: c.labourerRate.baht, archived: c.isArchived,
        }]));
    }
}
