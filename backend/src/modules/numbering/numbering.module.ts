// ─── Running document numbers (ERP foundation, docs/erp/01-architecture.md §8): concurrency-safe, never reused ───
// Provides DocumentNumbering (src/shared/application/ports.ts) to every module and registers the project / workspace
// deletion guards (issued documents). Routes gated by `project-hub`. Needs ModuleAccess (platform), AuditLog (audit).
import { Global, Module } from '@nestjs/common';
import { DocumentNumbering } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
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
    ],
    exports: [DocumentNumbering],
})
export class NumberingModule {}
