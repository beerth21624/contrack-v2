// ─── Project Hub (module `project-hub`, docs/erp/02-domain-model.md §1.9, §12) ───
// Owns the hub columns of `projects` (the projects module never touches them). Provides ProjectLifecycle; reads the
// projects through ProjectCatalog (projects), customers through CustomerLookup, codes from DocumentNumbering and the
// cross-module figures from the HubRollups registry (core).
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { ProjectDependents, ProjectLifecycle } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { HubProjectRepository } from './application/ports/hub-project.repository';
import {
    AssignHubProjectCodeUseCase, GetHubProjectUseCase, HubProjectViews, HubSummaryUseCase, ListHubProjectsUseCase, UpdateHubProjectUseCase,
} from './application/use-cases/hub.use-cases';
import { DrizzleHubProjectRepository } from './infrastructure/adapters/drizzle-hub-project.repository';
import { InMemoryHubProjectRepository } from './infrastructure/adapters/in-memory-hub-project.repository';
import { HubProjectLifecycle } from './infrastructure/adapters/project-lifecycle.adapter';
import { HubController } from './presentation/hub.controller';

@Global()
@Module({
    controllers: [HubController],
    providers: [
        persistence(HubProjectRepository, () => new InMemoryHubProjectRepository(), ctx => new DrizzleHubProjectRepository(ctx)),
        HubProjectViews,
        ListHubProjectsUseCase,
        HubSummaryUseCase,
        GetHubProjectUseCase,
        UpdateHubProjectUseCase,
        AssignHubProjectCodeUseCase,
        HubProjectLifecycle,
        { provide: ProjectLifecycle, useExisting: HubProjectLifecycle },
    ],
    exports: [ProjectLifecycle],
})
export class HubModule implements OnModuleInit {
    constructor(private readonly dependents: ProjectDependents, private readonly repo: HubProjectRepository) {}

    onModuleInit(): void {
        // Memory adapter: forget a deleted project's hub columns (PostgreSQL drops them with the row).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
