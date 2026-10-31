// ─── Portal (module `portal`, docs/erp/02-domain-model.md §6, WP-35) ───
// No tables. The role-based home page gathers tasks from the PortalSources registry (core), risky projects from the
// HubRollups registry, module tiles from ModuleStatesLookup (platform) and quick actions by role + active modules; the
// global search gathers hits from the SearchSources registry. Modules register their sources in `onModuleInit`.
import { Module } from '@nestjs/common';
import { GetPortalUseCase, GlobalSearchUseCase } from './application/portal.use-cases';
import { PortalController } from './presentation/portal.controller';

@Module({
    controllers: [PortalController],
    providers: [GetPortalUseCase, GlobalSearchUseCase],
})
export class PortalModule {}
