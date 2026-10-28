import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import {
    DomainError, type RateCardId, type Result, type UserId, type WorkspaceId, err, ok,
} from '../../../../shared/domain';
import type { RateCard, RateCardChanges } from '../../domain/entities/rate-card.entity';
import { checkNameFree } from '../../domain/policies/rate-card-library.policy';
import { DailyRate } from '../../domain/value-objects/daily-rate.value-object';
import { RateCardName } from '../../domain/value-objects/rate-card-name.value-object';
import { rateCardNote } from '../../domain/value-objects/rate-card-note.value-object';
import { RateCardRepository } from '../ports/rate-card.repository';
import { RateCardAccess } from '../rate-card-access';

export interface UpdateRateCardInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    rateCardId: RateCardId;
    name?: string;
    skilledRate?: number;
    labourerRate?: number;
    /** null or blank clears the note; undefined keeps it. */
    note?: string | null;
}

function parseChanges(input: UpdateRateCardInput): Result<RateCardChanges, DomainError> {
    const changes: RateCardChanges = {};
    if (input.name !== undefined) {
        const name = RateCardName.create(input.name);
        if (!name.ok) return name;
        changes.name = name.value;
    }
    if (input.skilledRate !== undefined) {
        const rate = DailyRate.create(input.skilledRate, 'skilled');
        if (!rate.ok) return rate;
        changes.skilledRate = rate.value;
    }
    if (input.labourerRate !== undefined) {
        const rate = DailyRate.create(input.labourerRate, 'labourer');
        if (!rate.ok) return rate;
        changes.labourerRate = rate.value;
    }
    if (input.note !== undefined) {
        const note = rateCardNote(input.note);
        if (!note.ok) return note;
        changes.note = note.value;
    }
    return ok(changes);
}

/** Renames a card or changes its rates / note. An archived card is gone from the library (not_found). */
@Injectable()
export class UpdateRateCardUseCase {
    constructor(
        private readonly access: RateCardAccess,
        private readonly cards: RateCardRepository,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: UpdateRateCardInput): Promise<Result<RateCard, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'rateCards.edit');
        if (!granted.ok) return granted;
        if (input.name === undefined && input.skilledRate === undefined && input.labourerRate === undefined
            && input.note === undefined) {
            return err(DomainError.validation('Nothing to update'));
        }
        const changes = parseChanges(input);
        if (!changes.ok) return changes;
        const { name } = changes.value;

        return this.uow.run(async (): Promise<Result<RateCard, DomainError>> => {
            await this.cards.lockLibrary(input.workspaceId);
            const card = await this.cards.find(input.workspaceId, input.rateCardId);
            if (card === undefined || card.isArchived) return err(DomainError.notFound('Rate card'));
            if (name !== undefined) {
                const free = checkNameFree(name, await this.cards.findActiveByName(input.workspaceId, name), card.id);
                if (!free.ok) return free;
            }
            if (card.update(changes.value, this.clock.now())) await this.cards.update(card);
            return ok(card);
        });
    }
}
