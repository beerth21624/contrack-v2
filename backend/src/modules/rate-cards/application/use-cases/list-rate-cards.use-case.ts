import { Injectable } from '@nestjs/common';
import { type DomainError, type Result, type UserId, type WorkspaceId, ok } from '../../../../shared/domain';
import type { RateCard } from '../../domain/entities/rate-card.entity';
import { RateCardRepository } from '../ports/rate-card.repository';
import { RateCardAccess } from '../rate-card-access';

export interface ListRateCardsInput {
    userId: UserId;
    workspaceId: WorkspaceId;
}

/** The workspace's active rate cards, oldest first. */
@Injectable()
export class ListRateCardsUseCase {
    constructor(private readonly access: RateCardAccess, private readonly cards: RateCardRepository) {}

    async execute(input: ListRateCardsInput): Promise<Result<RateCard[], DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'rateCards.read');
        if (!granted.ok) return granted;
        return ok(await this.cards.listActive(input.workspaceId));
    }
}
