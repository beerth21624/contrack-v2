// ─── Rate cards: the workspace library of daily wage sets (crew-management phase W0) ───
// Needs WorkspaceAccess (workspaces module). Provides RateCardLookup (crews price their day from a card, W1).
// No realtime: the realtime gateway has project rooms only; clients refetch the list after their own writes.
import { Global, Module } from '@nestjs/common';
import { RateCardLookup } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { RateCardRepository } from './application/ports/rate-card.repository';
import { RateCardAccess } from './application/rate-card-access';
import { ArchiveRateCardUseCase } from './application/use-cases/archive-rate-card.use-case';
import { CreateRateCardUseCase } from './application/use-cases/create-rate-card.use-case';
import { ListRateCardsUseCase } from './application/use-cases/list-rate-cards.use-case';
import { UpdateRateCardUseCase } from './application/use-cases/update-rate-card.use-case';
import { DrizzleRateCardRepository } from './infrastructure/adapters/drizzle-rate-card.repository';
import { InMemoryRateCardRepository } from './infrastructure/adapters/in-memory-rate-card.repository';
import { RepositoryRateCardLookup } from './infrastructure/adapters/rate-card-lookup.adapter';
import { RateCardsController } from './presentation/rate-cards.controller';

@Global()
@Module({
    controllers: [RateCardsController],
    providers: [
        persistence(RateCardRepository, () => new InMemoryRateCardRepository(), ctx => new DrizzleRateCardRepository(ctx)),
        RateCardAccess,
        ListRateCardsUseCase,
        CreateRateCardUseCase,
        UpdateRateCardUseCase,
        ArchiveRateCardUseCase,
        { provide: RateCardLookup, useClass: RepositoryRateCardLookup },
    ],
    exports: [RateCardLookup],
})
export class RateCardsModule {}
