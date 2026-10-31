// ─── Government reference prices (ERP foundation `price-reference`, WP-21): search the imported catalogue ───
// The catalogue is platform-wide (books with a null workspace); read route gated by `project-hub`.
import { Module } from '@nestjs/common';
import { persistence } from '../../shared/infrastructure/core.module';
import { PriceReferenceRepository } from './application/ports/price-reference.repository';
import { SearchPriceReferenceUseCase } from './application/use-cases/search-price-reference.use-case';
import { DrizzlePriceReferenceRepository } from './infrastructure/adapters/drizzle-price-reference.repository';
import { InMemoryPriceReferenceRepository } from './infrastructure/adapters/in-memory-price-reference.repository';
import { PriceReferenceController } from './presentation/price-reference.controller';

@Module({
    controllers: [PriceReferenceController],
    providers: [
        persistence(PriceReferenceRepository, () => new InMemoryPriceReferenceRepository(), ctx => new DrizzlePriceReferenceRepository(ctx)),
        SearchPriceReferenceUseCase,
    ],
})
export class PriceReferenceModule {}
