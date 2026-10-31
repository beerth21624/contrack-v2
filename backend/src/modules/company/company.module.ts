// ─── Company profile (ERP foundation, docs/erp/02-domain-model.md §1.3): seller details for documents ───
// Provides CompanyProfiles (src/shared/application/ports.ts) to every module. Routes gated by `project-hub`.
// Needs ModuleAccess (platform), WorkspaceDirectory (workspaces), FileService (platform), AuditLog (audit).
import { Global, Module } from '@nestjs/common';
import { CompanyProfiles } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { CompanyRepository } from './application/ports/company.repository';
import { GetCompanyUseCase, PutCompanyUseCase } from './application/use-cases/company.use-cases';
import { RepositoryCompanyProfiles } from './infrastructure/adapters/company-profiles.adapter';
import { DrizzleCompanyRepository } from './infrastructure/adapters/drizzle-company.repository';
import { InMemoryCompanyRepository } from './infrastructure/adapters/in-memory-company.repository';
import { CompanyController } from './presentation/company.controller';

@Global()
@Module({
    controllers: [CompanyController],
    providers: [
        persistence(CompanyRepository, () => new InMemoryCompanyRepository(), ctx => new DrizzleCompanyRepository(ctx)),
        RepositoryCompanyProfiles,
        { provide: CompanyProfiles, useExisting: RepositoryCompanyProfiles },
        GetCompanyUseCase,
        PutCompanyUseCase,
    ],
    exports: [CompanyProfiles],
})
export class CompanyModule {}
