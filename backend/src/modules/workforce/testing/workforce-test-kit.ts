// ─── Test kit of the workforce module: in-memory adapters, fixed clock/ids, fakes for the other modules' ports ───
// Not a spec itself; imported by the *.spec.ts files next to the code they test.
import type { Role } from '@contrack/contract';
import {
    type ProjectStatus, ProjectStatusLookup, RateCardLookup, type RateCardRates, WorkspaceAccess,
} from '../../../shared/application/ports';
import {
    type CrewId, type ProjectId, type RateCardId, type UserId, type WorkspaceId, asProjectId, asRateCardId, asUserId,
    asWorkspaceId,
} from '../../../shared/domain';
import { InMemoryUnitOfWork } from '../../../shared/infrastructure/database/database';
import { FixedClock, SequentialIdGenerator } from '../../../shared/infrastructure/system';
import { CrewPricing } from '../application/crew-pricing';
import { FakeModuleFlags } from '../../../shared/testing/platform-fakes';
import { WorkforceAccess } from '../application/workforce-access';
import { WorkforceReferences } from '../application/workforce-references';
import { ArchiveCrewUseCase } from '../application/use-cases/archive-crew.use-case';
import { ArchivePersonUseCase } from '../application/use-cases/archive-person.use-case';
import { CreateCrewAssignmentUseCase, type CreateCrewAssignmentInput } from '../application/use-cases/create-crew-assignment.use-case';
import { CreateCrewUseCase, type CreateCrewInput } from '../application/use-cases/create-crew.use-case';
import { CreatePersonUseCase, type CreatePersonInput } from '../application/use-cases/create-person.use-case';
import { DeleteCrewAssignmentUseCase } from '../application/use-cases/delete-crew-assignment.use-case';
import { ListCrewAssignmentsUseCase } from '../application/use-cases/list-crew-assignments.use-case';
import { ListCrewsUseCase } from '../application/use-cases/list-crews.use-case';
import { ListPeopleUseCase } from '../application/use-cases/list-people.use-case';
import { GetProjectSupervisorsUseCase, PutProjectSupervisorsUseCase } from '../application/use-cases/project-supervisors.use-case';
import {
    GetProjectTaskLagsUseCase, ListWorkspaceTaskLagsUseCase, PutProjectTaskLagsUseCase,
} from '../application/use-cases/project-task-lags.use-case';
import { UpdateCrewAssignmentUseCase } from '../application/use-cases/update-crew-assignment.use-case';
import { UpdateCrewUseCase } from '../application/use-cases/update-crew.use-case';
import { UpdatePersonUseCase } from '../application/use-cases/update-person.use-case';
import type { CrewAssignment } from '../domain/entities/crew-assignment.entity';
import type { Crew } from '../domain/entities/crew.entity';
import type { Person } from '../domain/entities/person.entity';
import {
    InMemoryCrewAssignmentRepository, InMemoryCrewRepository, InMemoryPersonRepository, InMemoryProjectSupervisorRepository,
    InMemoryProjectTaskLagRepository, InMemoryWorkforceLock,
} from '../infrastructure/adapters/in-memory-workforce.repositories';

export class FakeWorkspaceAccess extends WorkspaceAccess {
    private readonly roles = new Map<string, Role>();

    set(userId: UserId, workspaceId: WorkspaceId, role: Role | undefined): void {
        const key = `${userId}|${workspaceId}`;
        if (role === undefined) this.roles.delete(key);
        else this.roles.set(key, role);
    }

    roleOf(userId: UserId, workspaceId: WorkspaceId): Promise<Role | undefined> {
        return Promise.resolve(this.roles.get(`${userId}|${workspaceId}`));
    }
}

export class FakeProjects extends ProjectStatusLookup {
    readonly rows = new Map<ProjectId, ProjectStatus>();

    find(projectId: ProjectId): Promise<ProjectStatus | undefined> {
        const p = this.rows.get(projectId);
        return Promise.resolve(p === undefined ? undefined : { ...p });
    }
}

export class FakeRateCards extends RateCardLookup {
    readonly rows = new Map<RateCardId, RateCardRates & { workspaceId: WorkspaceId }>();

    findMany(workspaceId: WorkspaceId, ids: readonly RateCardId[]): Promise<Map<RateCardId, RateCardRates>> {
        const out = new Map<RateCardId, RateCardRates>();
        for (const id of ids) {
            const c = this.rows.get(id);
            if (c?.workspaceId === workspaceId) out.set(id, { id, skilledRate: c.skilledRate, labourerRate: c.labourerRate, archived: c.archived });
        }
        return Promise.resolve(out);
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
/** The ERP working roles (docs/erp/01 §5.1), also members of workspace A. */
export const PM = asUserId('10000000-0000-4000-8000-000000000006');
export const PURCHASING = asUserId('10000000-0000-4000-8000-000000000007');
export const ACCOUNTING = asUserId('10000000-0000-4000-8000-000000000008');
export const FOREMAN = asUserId('10000000-0000-4000-8000-000000000009');
export const ROLE_USERS: Record<Role, UserId> = {
    owner: OWNER, admin: ADMIN, estimator: ESTIMATOR, viewer: VIEWER,
    pm: PM, purchasing: PURCHASING, accounting: ACCOUNTING, foreman: FOREMAN,
};

/** Projects: P_A in workspace A, P_ARCHIVED archived in A, P_B in workspace B. */
export const P_A = asProjectId('30000000-0000-4000-8000-00000000000a');
export const P_A2 = asProjectId('30000000-0000-4000-8000-0000000000a2');
export const P_ARCHIVED = asProjectId('30000000-0000-4000-8000-0000000000ae');
export const P_B = asProjectId('30000000-0000-4000-8000-00000000000b');
/** Rate cards: CARD_A (800/500) and CARD_B (1000/600) in A, CARD_OLD archived in A, CARD_OTHER in B. */
export const CARD_A = asRateCardId('40000000-0000-4000-8000-00000000000a');
export const CARD_B = asRateCardId('40000000-0000-4000-8000-00000000000b');
export const CARD_OLD = asRateCardId('40000000-0000-4000-8000-0000000000de');
export const CARD_OTHER = asRateCardId('40000000-0000-4000-8000-0000000000ff');

/** The kit's clock: 2026-03-01 08:00 UTC = 15:00 in Bangkok, so "today" is 2026-03-01. */
export const NOW = new Date('2026-03-01T08:00:00.000Z');
export const TODAY = '2026-03-01';

export function workforceKit() {
    const clock = new FixedClock(NOW);
    const ids = new SequentialIdGenerator();
    const workspaces = new FakeWorkspaceAccess();
    const projects = new FakeProjects();
    const rateCards = new FakeRateCards();
    const uow = new InMemoryUnitOfWork();
    const lock = new InMemoryWorkforceLock();
    const people = new InMemoryPersonRepository();
    const crews = new InMemoryCrewRepository();
    const assignments = new InMemoryCrewAssignmentRepository();
    const supervisors = new InMemoryProjectSupervisorRepository();
    const taskLags = new InMemoryProjectTaskLagRepository();
    const flags = new FakeModuleFlags();
    const access = new WorkforceAccess(workspaces, projects, flags);
    const refs = new WorkforceReferences(people, crews, rateCards);
    const pricing = new CrewPricing(rateCards);

    workspaces.set(OWNER, WS_A, 'owner');
    workspaces.set(ADMIN, WS_A, 'admin');
    workspaces.set(ESTIMATOR, WS_A, 'estimator');
    workspaces.set(VIEWER, WS_A, 'viewer');
    workspaces.set(PM, WS_A, 'pm');
    workspaces.set(PURCHASING, WS_A, 'purchasing');
    workspaces.set(ACCOUNTING, WS_A, 'accounting');
    workspaces.set(FOREMAN, WS_A, 'foreman');
    workspaces.set(OWNER_B, WS_B, 'owner');
    projects.rows.set(P_A, { workspaceId: WS_A, archived: false });
    projects.rows.set(P_A2, { workspaceId: WS_A, archived: false });
    projects.rows.set(P_ARCHIVED, { workspaceId: WS_A, archived: true });
    projects.rows.set(P_B, { workspaceId: WS_B, archived: false });
    rateCards.rows.set(CARD_A, { id: CARD_A, workspaceId: WS_A, skilledRate: 800, labourerRate: 500, archived: false });
    rateCards.rows.set(CARD_B, { id: CARD_B, workspaceId: WS_A, skilledRate: 1000, labourerRate: 600, archived: false });
    rateCards.rows.set(CARD_OLD, { id: CARD_OLD, workspaceId: WS_A, skilledRate: 700, labourerRate: 400, archived: true });
    rateCards.rows.set(CARD_OTHER, { id: CARD_OTHER, workspaceId: WS_B, skilledRate: 900, labourerRate: 550, archived: false });

    const useCases = {
        listPeople: new ListPeopleUseCase(access, people),
        createPerson: new CreatePersonUseCase(access, people, lock, uow, clock, ids),
        updatePerson: new UpdatePersonUseCase(access, people, lock, uow, clock),
        archivePerson: new ArchivePersonUseCase(access, people, crews, assignments, supervisors, lock, uow, clock),
        listCrews: new ListCrewsUseCase(access, crews, pricing),
        createCrew: new CreateCrewUseCase(access, crews, refs, pricing, lock, uow, clock, ids),
        updateCrew: new UpdateCrewUseCase(access, crews, refs, pricing, lock, uow, clock),
        archiveCrew: new ArchiveCrewUseCase(access, crews, assignments, lock, uow, clock),
        listAssignments: new ListCrewAssignmentsUseCase(access, assignments),
        createAssignment: new CreateCrewAssignmentUseCase(access, assignments, refs, lock, uow, clock, ids),
        updateAssignment: new UpdateCrewAssignmentUseCase(access, assignments, refs, lock, uow, clock),
        deleteAssignment: new DeleteCrewAssignmentUseCase(access, assignments, lock, uow),
        getSupervisors: new GetProjectSupervisorsUseCase(access, supervisors),
        putSupervisors: new PutProjectSupervisorsUseCase(access, supervisors, refs, lock, uow),
        getTaskLags: new GetProjectTaskLagsUseCase(access, taskLags),
        putTaskLags: new PutProjectTaskLagsUseCase(access, taskLags, lock, uow, clock),
        listTaskLags: new ListWorkspaceTaskLagsUseCase(access, taskLags),
    };

    let seq = 0;

    /** A person created through the use case (fails the test when creation fails). */
    async function seedPerson(options: Partial<Omit<CreatePersonInput, 'userId'>> & { by?: UserId } = {}): Promise<Person> {
        seq += 1;
        const { by, ...rest } = options;
        const r = await useCases.createPerson.execute({
            userId: by ?? OWNER, workspaceId: WS_A, name: `ช่าง ${seq}`, role: 'skilled', employment: 'daily', ...rest,
        });
        if (!r.ok) throw new Error(`seedPerson failed: ${r.error.code} ${r.error.message}`);
        return r.value.person;
    }

    async function seedCrew(options: Partial<Omit<CreateCrewInput, 'userId'>> & { by?: UserId } = {}): Promise<Crew> {
        seq += 1;
        const { by, ...rest } = options;
        const r = await useCases.createCrew.execute({
            userId: by ?? OWNER, workspaceId: WS_A, name: `ทีม ${seq}`, trade: 'structure', skilledCount: 2, labourerCount: 3, ...rest,
        });
        if (!r.ok) throw new Error(`seedCrew failed: ${r.error.code} ${r.error.message}`);
        return r.value.crew;
    }

    async function seedAssignment(
        crewId: CrewId, options: Partial<Omit<CreateCrewAssignmentInput, 'userId' | 'crewId'>> & { by?: UserId } = {},
    ): Promise<CrewAssignment> {
        const { by, ...rest } = options;
        const r = await useCases.createAssignment.execute({
            userId: by ?? OWNER, workspaceId: WS_A, projectId: P_A, taskId: '1.5', crewId, start: TODAY, end: '2026-03-10', ...rest,
        });
        if (!r.ok) throw new Error(`seedAssignment failed: ${r.error.code} ${r.error.message}`);
        return r.value;
    }

    return {
        clock, ids, workspaces, projects, flags, rateCards, uow, lock, people, crews, assignments, supervisors, taskLags, access, refs,
        pricing,
        ...useCases, seedPerson, seedCrew, seedAssignment,
    };
}

export type WorkforceKit = ReturnType<typeof workforceKit>;
