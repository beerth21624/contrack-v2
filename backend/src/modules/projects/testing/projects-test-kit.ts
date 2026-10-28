// ─── Test kit of the projects module: in-memory adapters, fixed clock/ids, fakes for the other modules' ports ───
// Not a spec itself; imported by the *.spec.ts files next to the code they test.
import type {
    AssignmentUpdatedEvent, DocUpdatedEvent, ProjectDeletedEvent, ProjectUpdatedEvent, Role,
} from '@contrack/contract';
import { ProjectDependents, RealtimePublisher, WorkspaceAccess } from '../../../shared/application/ports';
import { asUserId, asWorkspaceId, type UserId, type WorkspaceId } from '../../../shared/domain';
import { InMemoryUnitOfWork } from '../../../shared/infrastructure/database/database';
import { FixedClock, SequentialIdGenerator } from '../../../shared/infrastructure/system';
import { ProjectAccess } from '../application/project-access';
import { ProjectEvents } from '../application/project-events';
import { CreateProjectUseCase, type InitialDocInput } from '../application/use-cases/create-project.use-case';
import { CreateRevisionUseCase } from '../application/use-cases/create-revision.use-case';
import { DeleteProjectUseCase } from '../application/use-cases/delete-project.use-case';
import { GetProjectUseCase } from '../application/use-cases/get-project.use-case';
import { GetRevisionUseCase } from '../application/use-cases/get-revision.use-case';
import { ListActivityUseCase } from '../application/use-cases/list-activity.use-case';
import { ListAssignmentsUseCase } from '../application/use-cases/list-assignments.use-case';
import { ListProjectsUseCase } from '../application/use-cases/list-projects.use-case';
import { ListRevisionsUseCase } from '../application/use-cases/list-revisions.use-case';
import { PutAssignmentUseCase } from '../application/use-cases/put-assignment.use-case';
import { PutDocUseCase } from '../application/use-cases/put-doc.use-case';
import { RemoveMemberAssignmentsUseCase } from '../application/use-cases/remove-member-assignments.use-case';
import { RenameOrArchiveProjectUseCase } from '../application/use-cases/rename-or-archive-project.use-case';
import type { Project } from '../domain/entities/project.entity';
import { ProjectAssembler } from '../domain/services/project-assembler.service';
import { InMemoryActivityRepository } from '../infrastructure/adapters/in-memory-activity.repository';
import { InMemoryAssignmentRepository } from '../infrastructure/adapters/in-memory-assignment.repository';
import { InMemoryProjectDocRepository } from '../infrastructure/adapters/in-memory-project-doc.repository';
import { InMemoryProjectRepository } from '../infrastructure/adapters/in-memory-project.repository';
import { InMemoryRevisionRepository } from '../infrastructure/adapters/in-memory-revision.repository';

export class FakeWorkspaceAccess extends WorkspaceAccess {
    private readonly roles = new Map<string, Role>();
    calls = 0;

    set(userId: UserId, workspaceId: WorkspaceId, role: Role | undefined): void {
        const key = `${userId}|${workspaceId}`;
        if (role === undefined) this.roles.delete(key);
        else this.roles.set(key, role);
    }

    roleOf(userId: UserId, workspaceId: WorkspaceId): Promise<Role | undefined> {
        this.calls += 1;
        return Promise.resolve(this.roles.get(`${userId}|${workspaceId}`));
    }
}

export type PublishedEvent =
    | { type: 'doc.updated'; event: DocUpdatedEvent }
    | { type: 'project.updated'; event: ProjectUpdatedEvent }
    | { type: 'assignment.updated'; event: AssignmentUpdatedEvent }
    | { type: 'project.deleted'; event: ProjectDeletedEvent };

export class FakeRealtimePublisher extends RealtimePublisher {
    readonly events: PublishedEvent[] = [];
    /** Called on every publish (to look at the stores at that moment). */
    onPublish: ((e: PublishedEvent) => void | Promise<void>) | undefined;
    /** Make every publish throw. */
    failing = false;

    private async record(e: PublishedEvent): Promise<void> {
        await this.onPublish?.(e);
        if (this.failing) throw new Error('realtime is down');
        this.events.push(e);
    }

    docUpdated(event: DocUpdatedEvent): Promise<void> {
        return this.record({ type: 'doc.updated', event });
    }

    projectUpdated(event: ProjectUpdatedEvent): Promise<void> {
        return this.record({ type: 'project.updated', event });
    }

    assignmentUpdated(event: AssignmentUpdatedEvent): Promise<void> {
        return this.record({ type: 'assignment.updated', event });
    }

    projectDeleted(event: ProjectDeletedEvent): Promise<void> {
        return this.record({ type: 'project.deleted', event });
    }
}

/** Two tenants: workspace A with one member per role, workspace B with its own owner. */
export const WS_A = asWorkspaceId('aaaaaaaa-0000-4000-8000-00000000000a');
export const WS_B = asWorkspaceId('bbbbbbbb-0000-4000-8000-00000000000b');
export const OWNER = asUserId('10000000-0000-4000-8000-000000000001');
export const ADMIN = asUserId('10000000-0000-4000-8000-000000000002');
export const ESTIMATOR = asUserId('10000000-0000-4000-8000-000000000003');
export const VIEWER = asUserId('10000000-0000-4000-8000-000000000004');
export const OUTSIDER = asUserId('10000000-0000-4000-8000-000000000005');
export const OWNER_B = asUserId('20000000-0000-4000-8000-000000000001');

export const ROLE_USERS: Record<Role, UserId> = { owner: OWNER, admin: ADMIN, estimator: ESTIMATOR, viewer: VIEWER };

export function projectsKit() {
    const clock = new FixedClock(new Date('2026-03-01T08:00:00.000Z'));
    const ids = new SequentialIdGenerator();
    const workspaces = new FakeWorkspaceAccess();
    const publisher = new FakeRealtimePublisher();
    const uow = new InMemoryUnitOfWork();
    const projects = new InMemoryProjectRepository();
    const docs = new InMemoryProjectDocRepository();
    const revisions = new InMemoryRevisionRepository();
    const assignments = new InMemoryAssignmentRepository();
    const activity = new InMemoryActivityRepository();
    const assembler = new ProjectAssembler();
    const access = new ProjectAccess(workspaces, projects);
    const events = new ProjectEvents(publisher);
    const dependents = new ProjectDependents();

    workspaces.set(OWNER, WS_A, 'owner');
    workspaces.set(ADMIN, WS_A, 'admin');
    workspaces.set(ESTIMATOR, WS_A, 'estimator');
    workspaces.set(VIEWER, WS_A, 'viewer');
    workspaces.set(OWNER_B, WS_B, 'owner');

    const useCases = {
        listProjects: new ListProjectsUseCase(access, projects),
        createProject: new CreateProjectUseCase(access, projects, docs, activity, assembler, uow, clock, ids),
        getProject: new GetProjectUseCase(access, docs),
        renameOrArchive: new RenameOrArchiveProjectUseCase(access, projects, activity, events, uow, clock),
        deleteProject: new DeleteProjectUseCase(access, projects, docs, revisions, assignments, activity, events, uow, dependents),
        putDoc: new PutDocUseCase(access, projects, docs, activity, assembler, events, uow, clock),
        createRevision: new CreateRevisionUseCase(access, projects, docs, revisions, activity, assembler, uow, clock, ids),
        listRevisions: new ListRevisionsUseCase(access, revisions),
        getRevision: new GetRevisionUseCase(access, revisions),
        listAssignments: new ListAssignmentsUseCase(access, assignments),
        putAssignment: new PutAssignmentUseCase(access, workspaces, projects, assignments, activity, events, uow, clock),
        listActivity: new ListActivityUseCase(access, activity),
        removeMemberAssignments: new RemoveMemberAssignmentsUseCase(assignments, activity, events, uow, clock),
    };

    /** A project created through the use case (fails the test when creation fails). */
    async function seedProject(
        options: { by?: UserId; workspaceId?: WorkspaceId; name?: string; start?: 'blank' | 'sample'; docs?: InitialDocInput[] } = {},
    ): Promise<Project> {
        const r = await useCases.createProject.execute({
            userId: options.by ?? OWNER,
            workspaceId: options.workspaceId ?? WS_A,
            name: options.name ?? 'บ้านคุณสมชาย',
            start: options.start ?? 'sample',
            docs: options.docs,
        });
        if (!r.ok) throw new Error(`seedProject failed: ${r.error.code} ${r.error.message}`);
        return r.value.project;
    }

    return {
        clock, ids, workspaces, publisher, uow, projects, docs, revisions, assignments, activity, assembler, access, events,
        dependents, ...useCases, seedProject,
    };
}

export type ProjectsKit = ReturnType<typeof projectsKit>;

/** Valid documents for tests (shapes from the shared domain's own tests). */
export const SAMPLE_DOCS = {
    meta: { docKey: 'meta', data: { projectName: 'บ้านคุณสมชาย', ownerName: 'สมชาย' } },
    fill: { docKey: 'calc:fill', data: { width: 10, length: 12, height: 0.5 } },
    r13: { docKey: 'boq:R13', data: { mat: 350 } },
    journey: { docKey: 'journey', data: { 'project-info': 'done', 'land-inspection': 'done', demolition: 'skipped' } },
} as const satisfies Record<string, InitialDocInput>;

/** Shape-valid, but the footing calculator cannot compute with it (validateProject fails). */
export const BREAKING_DOC = { docKey: 'calc:footing', data: { rows: 'not a list' } } as const;
