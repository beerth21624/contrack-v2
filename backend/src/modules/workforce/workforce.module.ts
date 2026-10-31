// ─── Workforce (W1/W2, business module `workforce`): people, crews, crews on planned tasks, site supervisors, waits ───
// docs/workforce/00-crew-management-design.md. Needs WorkspaceAccess (workspaces), ProjectStatusLookup (projects) and
// RateCardLookup (rate-cards); provides CrewDailyCost (site diary, WP-42); registers its per-project rows with
// ProjectDependents, so deleting a project removes its
// assignments, supervisors and task waits (PostgreSQL also cascades). Always loaded: while MODULES_ENABLED leaves
// `workforce` out, its routes answer 404 `module_disabled` (RequiresModule on every controller) and its data is kept.
// No realtime: the gateway has project rooms only; clients refetch after their own writes.
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { CrewDailyCost, ProjectDependents } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { WorkforceCrewDailyCost } from './application/crew-daily-cost';
import { CrewPricing } from './application/crew-pricing';
import { CrewAssignmentRepository } from './application/ports/crew-assignment.repository';
import { CrewRepository } from './application/ports/crew.repository';
import { PersonRepository } from './application/ports/person.repository';
import { ProjectSupervisorRepository } from './application/ports/project-supervisor.repository';
import { ProjectTaskLagRepository } from './application/ports/project-task-lag.repository';
import { WorkforceLock } from './application/ports/workforce-lock.port';
import { ArchiveCrewUseCase } from './application/use-cases/archive-crew.use-case';
import { ArchivePersonUseCase } from './application/use-cases/archive-person.use-case';
import { CreateCrewAssignmentUseCase } from './application/use-cases/create-crew-assignment.use-case';
import { CreateCrewUseCase } from './application/use-cases/create-crew.use-case';
import { CreatePersonUseCase } from './application/use-cases/create-person.use-case';
import { DeleteCrewAssignmentUseCase } from './application/use-cases/delete-crew-assignment.use-case';
import { ListCrewAssignmentsUseCase } from './application/use-cases/list-crew-assignments.use-case';
import { ListCrewsUseCase } from './application/use-cases/list-crews.use-case';
import { ListPeopleUseCase } from './application/use-cases/list-people.use-case';
import { GetProjectSupervisorsUseCase, PutProjectSupervisorsUseCase } from './application/use-cases/project-supervisors.use-case';
import {
    GetProjectTaskLagsUseCase, ListWorkspaceTaskLagsUseCase, PutProjectTaskLagsUseCase,
} from './application/use-cases/project-task-lags.use-case';
import { UpdateCrewAssignmentUseCase } from './application/use-cases/update-crew-assignment.use-case';
import { UpdateCrewUseCase } from './application/use-cases/update-crew.use-case';
import { UpdatePersonUseCase } from './application/use-cases/update-person.use-case';
import { WorkforceAccess } from './application/workforce-access';
import { WorkforceReferences } from './application/workforce-references';
import { DrizzleCrewAssignmentRepository } from './infrastructure/adapters/drizzle-crew-assignment.repository';
import { DrizzleCrewRepository } from './infrastructure/adapters/drizzle-crew.repository';
import { DrizzlePersonRepository } from './infrastructure/adapters/drizzle-person.repository';
import { DrizzleProjectSupervisorRepository } from './infrastructure/adapters/drizzle-project-supervisor.repository';
import { DrizzleProjectTaskLagRepository } from './infrastructure/adapters/drizzle-project-task-lag.repository';
import { DrizzleWorkforceLock } from './infrastructure/adapters/drizzle-workforce-lock.adapter';
import {
    InMemoryCrewAssignmentRepository, InMemoryCrewRepository, InMemoryPersonRepository, InMemoryProjectSupervisorRepository,
    InMemoryProjectTaskLagRepository, InMemoryWorkforceLock,
} from './infrastructure/adapters/in-memory-workforce.repositories';
import { CrewAssignmentsController } from './presentation/crew-assignments.controller';
import { CrewsController } from './presentation/crews.controller';
import { PeopleController } from './presentation/people.controller';
import { ProjectSupervisorsController } from './presentation/project-supervisors.controller';
import { TaskLagsController } from './presentation/task-lags.controller';

@Global()
@Module({
    controllers: [PeopleController, CrewsController, CrewAssignmentsController, ProjectSupervisorsController, TaskLagsController],
    providers: [
        persistence(PersonRepository, () => new InMemoryPersonRepository(), ctx => new DrizzlePersonRepository(ctx)),
        persistence(CrewRepository, () => new InMemoryCrewRepository(), ctx => new DrizzleCrewRepository(ctx)),
        persistence(CrewAssignmentRepository, () => new InMemoryCrewAssignmentRepository(), ctx => new DrizzleCrewAssignmentRepository(ctx)),
        persistence(ProjectSupervisorRepository, () => new InMemoryProjectSupervisorRepository(), ctx => new DrizzleProjectSupervisorRepository(ctx)),
        persistence(ProjectTaskLagRepository, () => new InMemoryProjectTaskLagRepository(), ctx => new DrizzleProjectTaskLagRepository(ctx)),
        persistence(WorkforceLock, () => new InMemoryWorkforceLock(), ctx => new DrizzleWorkforceLock(ctx)),
        WorkforceAccess,
        WorkforceReferences,
        CrewPricing,
        WorkforceCrewDailyCost,
        { provide: CrewDailyCost, useExisting: WorkforceCrewDailyCost },
        ListPeopleUseCase,
        CreatePersonUseCase,
        UpdatePersonUseCase,
        ArchivePersonUseCase,
        ListCrewsUseCase,
        CreateCrewUseCase,
        UpdateCrewUseCase,
        ArchiveCrewUseCase,
        ListCrewAssignmentsUseCase,
        CreateCrewAssignmentUseCase,
        UpdateCrewAssignmentUseCase,
        DeleteCrewAssignmentUseCase,
        GetProjectSupervisorsUseCase,
        PutProjectSupervisorsUseCase,
        GetProjectTaskLagsUseCase,
        PutProjectTaskLagsUseCase,
        ListWorkspaceTaskLagsUseCase,
    ],
    exports: [CrewDailyCost],
})
export class WorkforceModule implements OnModuleInit {
    constructor(
        private readonly dependents: ProjectDependents,
        private readonly assignments: CrewAssignmentRepository,
        private readonly supervisors: ProjectSupervisorRepository,
        private readonly taskLags: ProjectTaskLagRepository,
    ) {}

    onModuleInit(): void {
        this.dependents.register(async (workspaceId, projectId) => {
            await this.assignments.deleteByProject(workspaceId, projectId);
            await this.supervisors.deleteByProject(workspaceId, projectId);
            await this.taskLags.deleteByProject(workspaceId, projectId);
        });
    }
}
