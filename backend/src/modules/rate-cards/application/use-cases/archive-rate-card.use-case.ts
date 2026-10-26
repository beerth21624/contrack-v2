import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import {
    DomainError, type RateCardId, type Result, type UserId, type WorkspaceId, err, okVoid,
} from '../../../../shared/domain';
import { RateCardRepository } from '../ports/rate-card.repository';
import { RateCardAccess } from '../rate-card-access';

export interface ArchiveRateCardInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    rateCardId: RateCardId;
}

/**
 * Soft delete: the card leaves the library (and frees its name and its place in the 50-card limit); projects keep the
 * rates they copied. Archiving an archived card again is a no-op (a retried DELETE succeeds).
 */
@Injectable()
export class ArchiveRateCardUseCase {
    constructor(
        private readonly access: RateCardAccess,
        private readonly cards: RateCardRepository,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: ArchiveRateCardInput): Promise<Result<undefined, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'rateCards.archive');
        if (!granted.ok) return granted;
        return this.uow.run(async (): Promise<Result<undefined, DomainError>> => {
            await this.cards.lockLibrary(input.workspaceId);
            const card = await this.cards.find(input.workspaceId, input.rateCardId);
            if (card === undefined) return err(DomainError.notFound('Rate card'));
            if (card.archive(this.clock.now())) await this.cards.update(card);
            return okVoid();
        });
    }
}
