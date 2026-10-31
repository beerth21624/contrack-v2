// ─── BOQ control (module `boq-control`, docs/erp/02-domain-model.md §1.10) ───
// WP-17: one `boq_versions` row (+ sections, lines) per project revision, made by a RevisionHooks hook while the
// module is active and lazily for older revisions when versions are read; list / get / compare (also with the live BOQ).
// Reads revisions through RevisionLookup and the live project through ProjectReader (both provided by projects).
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { ProjectDependents, RevisionHooks } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { BoqVersionRepository } from './application/ports/boq-version.repository';
import {
    BoqVersionReader, BoqVersionRecorder, CompareBoqVersionsUseCase, GetBoqVersionUseCase, ListBoqVersionsUseCase,
} from './application/use-cases/boq-versions.use-cases';
import { DrizzleBoqVersionRepository } from './infrastructure/adapters/drizzle-boq-version.repository';
import { InMemoryBoqVersionRepository } from './infrastructure/adapters/in-memory-boq-version.repository';
import { BoqControlController } from './presentation/boq-control.controller';

@Global()
@Module({
    controllers: [BoqControlController],
    providers: [
        persistence(BoqVersionRepository, () => new InMemoryBoqVersionRepository(), ctx => new DrizzleBoqVersionRepository(ctx)),
        BoqVersionRecorder,
        BoqVersionReader,
        ListBoqVersionsUseCase,
        GetBoqVersionUseCase,
        CompareBoqVersionsUseCase,
    ],
    exports: [],
})
export class BoqControlModule implements OnModuleInit {
    constructor(
        private readonly dependents: ProjectDependents,
        private readonly hooks: RevisionHooks,
        private readonly repo: BoqVersionRepository,
        private readonly recorder: BoqVersionRecorder,
    ) {}

    onModuleInit(): void {
        this.hooks.register(revision => this.recorder.onRevisionCreated(revision));
        // Memory adapter: forget a deleted project's versions (PostgreSQL drops them with the project).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
