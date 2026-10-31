// ─── Running document numbers (ERP foundation, docs/erp/01-architecture.md §8): concurrency-safe, never reused ───
// Provides DocumentNumbering (src/shared/application/ports.ts) to every module and registers the project / workspace
// deletion guards (issued documents) and the SearchSources entry for document numbers (WP-35). Routes gated by
// `project-hub`. Needs ModuleAccess (platform), AuditLog (audit), ProjectCatalog (projects).
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { DocumentNumbering, SearchSources } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { NumberingSearch } from './application/numbering-search';
import { NumberingRepository } from './application/ports/numbering.repository';
import { ListNumberingSeriesUseCase, PutNumberingSeriesUseCase } from './application/use-cases/numbering-series.use-cases';
import { RepositoryDocumentNumbering } from './infrastructure/adapters/document-numbering.adapter';
import { DrizzleNumberingRepository } from './infrastructure/adapters/drizzle-numbering.repository';
import { InMemoryNumberingRepository } from './infrastructure/adapters/in-memory-numbering.repository';
import { NumberingController } from './presentation/numbering.controller';

@Global()
@Module({
    controllers: [NumberingController],
    providers: [
        persistence(NumberingRepository, () => new InMemoryNumberingRepository(), ctx => new DrizzleNumberingRepository(ctx)),
        RepositoryDocumentNumbering,
        { provide: DocumentNumbering, useExisting: RepositoryDocumentNumbering },
        ListNumberingSeriesUseCase,
        PutNumberingSeriesUseCase,
        NumberingSearch,
    ],
    exports: [DocumentNumbering],
})
export class NumberingModule implements OnModuleInit {
    constructor(private readonly search: SearchSources, private readonly numbers: NumberingSearch) {}

    onModuleInit(): void {
        // Each hit is checked against its own module and read permission.
        this.search.register('project-hub', null, ctx => this.numbers.search(ctx));
    }
}
