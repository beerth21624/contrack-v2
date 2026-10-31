// ─── Projects: cloud projects, documents (optimistic concurrency), revisions, level assignments, activity ───
// Needs WorkspaceAccess (workspaces module) and RealtimePublisher (realtime module); provides ProjectDirectory and
// ProjectDocLookup, ProjectStatusLookup and MemberAssignmentCleanup to the others (runs ProjectDependents on delete).
import { Global, Module } from '@nestjs/common';
import {
    MemberAssignmentCleanup, ProjectCatalog, ProjectDirectory, ProjectDocLookup, ProjectReader, ProjectStatusLookup, RevisionLookup,
    RevisionWriter,
} from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { ActivityRepository } from './application/ports/activity.repository';
import { AssignmentRepository } from './application/ports/assignment.repository';
import { ProjectDocRepository } from './application/ports/project-doc.repository';
import { ProjectRepository } from './application/ports/project.repository';
import { RevisionRepository } from './application/ports/revision.repository';
import { ProjectAccess } from './application/project-access';
import { ProjectEvents } from './application/project-events';
import { CreateProjectUseCase } from './application/use-cases/create-project.use-case';
import { CreateRevisionUseCase } from './application/use-cases/create-revision.use-case';
import { DeleteProjectUseCase } from './application/use-cases/delete-project.use-case';
import { GetProjectUseCase } from './application/use-cases/get-project.use-case';
import { GetRevisionUseCase } from './application/use-cases/get-revision.use-case';
import { ListActivityUseCase } from './application/use-cases/list-activity.use-case';
import { ListAssignmentsUseCase } from './application/use-cases/list-assignments.use-case';
import { ListProjectsUseCase } from './application/use-cases/list-projects.use-case';
import { ListRevisionsUseCase } from './application/use-cases/list-revisions.use-case';
import { PutAssignmentUseCase } from './application/use-cases/put-assignment.use-case';
import { PutDocUseCase } from './application/use-cases/put-doc.use-case';
import { RemoveMemberAssignmentsUseCase } from './application/use-cases/remove-member-assignments.use-case';
import { RenameOrArchiveProjectUseCase } from './application/use-cases/rename-or-archive-project.use-case';
import { ProjectAssembler } from './domain/services/project-assembler.service';
import { DrizzleActivityRepository } from './infrastructure/adapters/drizzle-activity.repository';
import { DrizzleAssignmentRepository } from './infrastructure/adapters/drizzle-assignment.repository';
import { DrizzleProjectDocRepository } from './infrastructure/adapters/drizzle-project-doc.repository';
import { DrizzleProjectRepository } from './infrastructure/adapters/drizzle-project.repository';
import { DrizzleRevisionRepository } from './infrastructure/adapters/drizzle-revision.repository';
import { InMemoryActivityRepository } from './infrastructure/adapters/in-memory-activity.repository';
import { InMemoryAssignmentRepository } from './infrastructure/adapters/in-memory-assignment.repository';
import { InMemoryProjectDocRepository } from './infrastructure/adapters/in-memory-project-doc.repository';
import { InMemoryProjectRepository } from './infrastructure/adapters/in-memory-project.repository';
import { InMemoryRevisionRepository } from './infrastructure/adapters/in-memory-revision.repository';
import { ProjectsMemberAssignmentCleanup } from './infrastructure/adapters/member-assignment-cleanup.adapter';
import {
    RepositoryProjectCatalog, RepositoryProjectDirectory, RepositoryProjectDocLookup, RepositoryProjectStatusLookup,
} from './infrastructure/adapters/project-directory.adapter';
import { RepositoryProjectReader } from './infrastructure/adapters/project-reader.adapter';
import { ProjectsRevisionLookup, ProjectsRevisionWriter } from './infrastructure/adapters/revision-ports.adapter';
import { ProjectsController } from './presentation/projects.controller';
import { WorkspaceProjectsController } from './presentation/workspace-projects.controller';

@Global()
@Module({
    controllers: [WorkspaceProjectsController, ProjectsController],
    providers: [
        persistence(ProjectRepository, () => new InMemoryProjectRepository(), ctx => new DrizzleProjectRepository(ctx)),
        persistence(ProjectDocRepository, () => new InMemoryProjectDocRepository(), ctx => new DrizzleProjectDocRepository(ctx)),
        persistence(RevisionRepository, () => new InMemoryRevisionRepository(), ctx => new DrizzleRevisionRepository(ctx)),
        persistence(AssignmentRepository, () => new InMemoryAssignmentRepository(), ctx => new DrizzleAssignmentRepository(ctx)),
        persistence(ActivityRepository, () => new InMemoryActivityRepository(), ctx => new DrizzleActivityRepository(ctx)),
        { provide: ProjectAssembler, useValue: new ProjectAssembler() },
        ProjectAccess,
        ProjectEvents,
        ListProjectsUseCase,
        CreateProjectUseCase,
        GetProjectUseCase,
        RenameOrArchiveProjectUseCase,
        DeleteProjectUseCase,
        PutDocUseCase,
        CreateRevisionUseCase,
        ListRevisionsUseCase,
        GetRevisionUseCase,
        ListAssignmentsUseCase,
        PutAssignmentUseCase,
        ListActivityUseCase,
        RemoveMemberAssignmentsUseCase,
        { provide: ProjectDirectory, useClass: RepositoryProjectDirectory },
        { provide: ProjectDocLookup, useClass: RepositoryProjectDocLookup },
        { provide: ProjectStatusLookup, useClass: RepositoryProjectStatusLookup },
        { provide: MemberAssignmentCleanup, useClass: ProjectsMemberAssignmentCleanup },
        { provide: ProjectReader, useClass: RepositoryProjectReader },
        { provide: ProjectCatalog, useClass: RepositoryProjectCatalog },
        { provide: RevisionWriter, useClass: ProjectsRevisionWriter },
        { provide: RevisionLookup, useClass: ProjectsRevisionLookup },
    ],
    exports: [
        ProjectDirectory, ProjectDocLookup, ProjectStatusLookup, MemberAssignmentCleanup, ProjectReader, ProjectCatalog, RevisionWriter, RevisionLookup,
    ],
})
export class ProjectsModule {}
