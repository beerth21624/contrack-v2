// ─── Site diary (module `site-diary`, docs/erp/02-domain-model.md §8.1, WP-42) ───
// One report per project per day (weather, manpower, work done per cost code, photos, issues). Submitting sets the cost
// codes' reported progress (CostCodeLookup) and, while `labour` is off, posts the crews' estimated labour cost
// (CrewDailyCost from workforce → CostLedger, source `site_diary`); reopening reverses it. Registers HubRollups
// (progressPct), PortalSources (no report today on a project in progress) and ProjectDependents.
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { HubRollups, PortalSources, ProjectDependents } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { SiteDiaryRepository } from './application/ports/site-diary.repository';
import { SiteDiaryHandlers } from './application/site-diary-handlers';
import { MODULE, SiteDiaryEffects, SiteDiaryViews } from './application/site-diary.service';
import {
    GetSiteProgressUseCase, GetSiteReportUseCase, ListSiteIssuesUseCase, ListSiteReportsUseCase, PatchSiteIssueUseCase,
    PutSiteReportUseCase, ReopenSiteReportUseCase, SubmitSiteReportUseCase,
} from './application/use-cases/site-diary.use-cases';
import { DrizzleSiteDiaryRepository } from './infrastructure/adapters/drizzle-site-diary.repository';
import { InMemorySiteDiaryRepository } from './infrastructure/adapters/in-memory-site-diary.repository';
import { SiteDiaryController } from './presentation/site-diary.controller';

@Global()
@Module({
    controllers: [SiteDiaryController],
    providers: [
        persistence(SiteDiaryRepository, () => new InMemorySiteDiaryRepository(), ctx => new DrizzleSiteDiaryRepository(ctx)),
        SiteDiaryViews,
        SiteDiaryEffects,
        SiteDiaryHandlers,
        ListSiteReportsUseCase,
        GetSiteReportUseCase,
        GetSiteProgressUseCase,
        PutSiteReportUseCase,
        SubmitSiteReportUseCase,
        ReopenSiteReportUseCase,
        ListSiteIssuesUseCase,
        PatchSiteIssueUseCase,
    ],
})
export class SiteDiaryModule implements OnModuleInit {
    constructor(
        private readonly rollups: HubRollups,
        private readonly portal: PortalSources,
        private readonly dependents: ProjectDependents,
        private readonly repo: SiteDiaryRepository,
        private readonly handlers: SiteDiaryHandlers,
    ) {}

    onModuleInit(): void {
        this.rollups.register(MODULE, (ws, projectIds) => this.handlers.rollup(ws, projectIds));
        this.portal.register(MODULE, 'site.report', ctx => this.handlers.portalMissingReports(ctx));
        // Memory adapter: forget a deleted project's reports (PostgreSQL drops them with the project).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
