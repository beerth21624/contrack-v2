// ─── BOQ control (module `boq-control`, docs/erp/02-domain-model.md §1.10) ───
// WP-17: one `boq_versions` row (+ sections, lines) per project revision, made by a RevisionHooks hook while the
// module is active and lazily for older revisions when versions are read; list / get / compare (also with the live BOQ).
// WP-18: baseline lock / unlock + cost codes; BoqEditLocks freezes `calc:*` / `boq:*` / `journey` while locked;
// provides CostCodeLookup and BaselineControl to the other ERP modules.
// Reads revisions through RevisionLookup and the live project through ProjectReader (both provided by projects).
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import {
    BaselineControl, BoqEditLocks, CostCodeLookup, ModuleFlags, ProjectDependents, RevisionHooks,
} from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { BaselineRepository, CostCodeRepository } from './application/ports/baseline.repository';
import { BoqVersionRepository } from './application/ports/boq-version.repository';
import {
    BaselineService, BaselineViews, CostCodeService, GetBaselineUseCase, ListCostCodesUseCase, LockBaselineUseCase, UnlockBaselineUseCase,
    isBaselineDoc,
} from './application/use-cases/baseline.use-cases';
import {
    BoqVersionReader, BoqVersionRecorder, CompareBoqVersionsUseCase, GetBoqVersionUseCase, ListBoqVersionsUseCase,
} from './application/use-cases/boq-versions.use-cases';
import { DrizzleBaselineRepository, DrizzleCostCodeRepository } from './infrastructure/adapters/drizzle-baseline.repository';
import { DrizzleBoqVersionRepository } from './infrastructure/adapters/drizzle-boq-version.repository';
import { InMemoryBaselineRepository, InMemoryCostCodeRepository } from './infrastructure/adapters/in-memory-baseline.repository';
import { InMemoryBoqVersionRepository } from './infrastructure/adapters/in-memory-boq-version.repository';
import { BoqControlController } from './presentation/boq-control.controller';

@Global()
@Module({
    controllers: [BoqControlController],
    providers: [
        persistence(BoqVersionRepository, () => new InMemoryBoqVersionRepository(), ctx => new DrizzleBoqVersionRepository(ctx)),
        persistence(BaselineRepository, () => new InMemoryBaselineRepository(), ctx => new DrizzleBaselineRepository(ctx)),
        persistence(CostCodeRepository, () => new InMemoryCostCodeRepository(), ctx => new DrizzleCostCodeRepository(ctx)),
        BoqVersionRecorder,
        BoqVersionReader,
        ListBoqVersionsUseCase,
        GetBoqVersionUseCase,
        CompareBoqVersionsUseCase,
        CostCodeService,
        BaselineService,
        BaselineViews,
        GetBaselineUseCase,
        LockBaselineUseCase,
        UnlockBaselineUseCase,
        ListCostCodesUseCase,
        { provide: CostCodeLookup, useExisting: CostCodeService },
        { provide: BaselineControl, useExisting: BaselineService },
    ],
    exports: [CostCodeLookup, BaselineControl],
})
export class BoqControlModule implements OnModuleInit {
    constructor(
        private readonly dependents: ProjectDependents,
        private readonly hooks: RevisionHooks,
        private readonly locks: BoqEditLocks,
        private readonly flags: ModuleFlags,
        private readonly repo: BoqVersionRepository,
        private readonly baselines: BaselineRepository,
        private readonly costCodes: CostCodeRepository,
        private readonly recorder: BoqVersionRecorder,
    ) {}

    onModuleInit(): void {
        this.hooks.register(revision => this.recorder.onRevisionCreated(revision));
        // Locked BOQ: only while the module is active (off = release-1 behaviour, every document writable).
        this.locks.register(async (workspaceId, projectId, docKey) => isBaselineDoc(docKey)
            && await this.flags.isEnabled(workspaceId, 'boq-control')
            && await this.baselines.active(workspaceId, projectId) !== undefined);
        // Memory adapter: forget a deleted project's rows (PostgreSQL drops them with the project).
        this.dependents.register(async (workspaceId, projectId) => {
            await this.baselines.deleteByProject(workspaceId, projectId);
            await this.costCodes.deleteByProject(workspaceId, projectId);
            await this.repo.deleteByProject(workspaceId, projectId);
        });
    }
}
