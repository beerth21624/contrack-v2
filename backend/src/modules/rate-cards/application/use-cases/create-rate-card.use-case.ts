import { Injectable } from '@nestjs/common';
import { Clock, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import {
    type DomainError, type Result, type UserId, type WorkspaceId, asRateCardId, ok,
} from '../../../../shared/domain';
import { RateCard } from '../../domain/entities/rate-card.entity';
import { checkNameFree, checkRoomForAnotherCard } from '../../domain/policies/rate-card-library.policy';
import { DailyRate } from '../../domain/value-objects/daily-rate.value-object';
import { RateCardName } from '../../domain/value-objects/rate-card-name.value-object';
import { rateCardNote } from '../../domain/value-objects/rate-card-note.value-object';
import { RateCardRepository } from '../ports/rate-card.repository';
import { RateCardAccess } from '../rate-card-access';

export interface CreateRateCardInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    name: string;
    skilledRate: number;
    labourerRate: number;
    note?: string | null;
}

@Injectable()
export class CreateRateCardUseCase {
    constructor(
        private readonly access: RateCardAccess,
        private readonly cards: RateCardRepository,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: CreateRateCardInput): Promise<Result<RateCard, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'rateCards.create');
        if (!granted.ok) return granted;
        const name = RateCardName.create(input.name);
        if (!name.ok) return name;
        const skilled = DailyRate.create(input.skilledRate, 'skilled');
        if (!skilled.ok) return skilled;
        const labourer = DailyRate.create(input.labourerRate, 'labourer');
        if (!labourer.ok) return labourer;
        const note = rateCardNote(input.note);
        if (!note.ok) return note;

        return this.uow.run(async (): Promise<Result<RateCard, DomainError>> => {
            await this.cards.lockLibrary(input.workspaceId);
            const room = checkRoomForAnotherCard(await this.cards.countActive(input.workspaceId));
            if (!room.ok) return room;
            const free = checkNameFree(name.value, await this.cards.findActiveByName(input.workspaceId, name.value));
            if (!free.ok) return free;

            const card = RateCard.create({
                id: asRateCardId(this.ids.newId()),
                workspaceId: input.workspaceId,
                name: name.value,
                skilledRate: skilled.value,
                labourerRate: labourer.value,
                note: note.value,
                createdBy: input.userId,
                now: this.clock.now(),
            });
            await this.cards.insert(card);
            return ok(card);
        });
    }
}
