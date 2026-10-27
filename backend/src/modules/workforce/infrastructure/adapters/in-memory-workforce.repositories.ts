// ─── In-memory adapters of the workforce ports (unit tests, e2e, PERSISTENCE=memory) ───
// Each mirrors its Drizzle twin, including the unique index and the ordering.
import type {
    CrewAssignmentId, CrewId, PersonId, ProjectId, UserId, WorkspaceId,
} from '../../../../shared/domain';
import { type CrewAssignmentFilter, CrewAssignmentRepository } from '../../application/ports/crew-assignment.repository';
import { CrewRepository } from '../../application/ports/crew.repository';
import { PersonRepository } from '../../application/ports/person.repository';
import { ProjectSupervisorRepository } from '../../application/ports/project-supervisor.repository';
import { type ProjectTaskLagRows, ProjectTaskLagRepository } from '../../application/ports/project-task-lag.repository';
import { WorkforceLock } from '../../application/ports/workforce-lock.port';
import { CrewAssignment } from '../../domain/entities/crew-assignment.entity';
import { Crew } from '../../domain/entities/crew.entity';
import { Person } from '../../domain/entities/person.entity';
import { type TaskLag, sortTaskLags } from '../../domain/value-objects/task-lag.value-object';
import type { WorkforceName } from '../../domain/value-objects/workforce-name.value-object';

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const toLag = (l: TaskLag): TaskLag => ({ taskId: l.taskId, days: l.days, note: l.note });
const oldestFirst = (a: { createdAt: Date; id: string }, b: { createdAt: Date; id: string }): number =>
    a.createdAt.getTime() - b.createdAt.getTime() || byId(a, b);

/**
 * A FIFO lock per workspace. In-memory work never does I/O, so a whole UnitOfWork runs within the microtasks that
 * follow acquiring the lock; releasing it on the next macrotask (setImmediate) releases it after the holder's work,
 * like an advisory lock released at COMMIT.
 */
export class InMemoryWorkforceLock extends WorkforceLock {
    private readonly locks = new Map<WorkspaceId, Promise<void>>();

    async lock(workspaceId: WorkspaceId): Promise<void> {
        const previous = this.locks.get(workspaceId) ?? Promise.resolve();
        const held = previous.then(() => new Promise<void>(resolve => setImmediate(resolve)));
        this.locks.set(workspaceId, held);
        void held.then(() => {
            if (this.locks.get(workspaceId) === held) this.locks.delete(workspaceId);
        });
        await previous;
    }
}

export class InMemoryPersonRepository extends PersonRepository {
    private readonly rows = new Map<PersonId, Person>();

    insert(person: Person): Promise<void> {
        if (this.rows.has(person.id)) return Promise.reject(new Error(`person ${person.id} already exists`));
        this.rows.set(person.id, Person.rehydrate(person.toProps()));
        return Promise.resolve();
    }

    find(workspaceId: WorkspaceId, id: PersonId): Promise<Person | undefined> {
        const p = this.rows.get(id);
        return Promise.resolve(p?.workspaceId === workspaceId ? Person.rehydrate(p.toProps()) : undefined);
    }

    findMany(workspaceId: WorkspaceId, ids: readonly PersonId[]): Promise<Person[]> {
        const wanted = new Set(ids);
        return Promise.resolve([...this.rows.values()]
            .filter(p => p.workspaceId === workspaceId && wanted.has(p.id))
            .map(p => Person.rehydrate(p.toProps())));
    }

    listActive(workspaceId: WorkspaceId): Promise<Person[]> {
        return Promise.resolve(this.active(workspaceId).sort(oldestFirst).map(p => Person.rehydrate(p.toProps())));
    }

    countActive(workspaceId: WorkspaceId): Promise<number> {
        return Promise.resolve(this.active(workspaceId).length);
    }

    update(person: Person): Promise<void> {
        if (this.rows.get(person.id)?.workspaceId === person.workspaceId) this.rows.set(person.id, Person.rehydrate(person.toProps()));
        return Promise.resolve();
    }

    private active(workspaceId: WorkspaceId): Person[] {
        return [...this.rows.values()].filter(p => p.workspaceId === workspaceId && !p.isArchived);
    }
}

export class InMemoryCrewRepository extends CrewRepository {
    private readonly rows = new Map<CrewId, Crew>();

    insert(crew: Crew): Promise<void> {
        if (this.rows.has(crew.id)) return Promise.reject(new Error(`crew ${crew.id} already exists`));
        // Mirrors the crews_name_key unique index.
        if (!crew.isArchived && this.active(crew.workspaceId).some(c => c.name.sameKey(crew.name))) {
            return Promise.reject(new Error(`crew name "${crew.name.value}" is taken`));
        }
        this.rows.set(crew.id, Crew.rehydrate(crew.toProps()));
        return Promise.resolve();
    }

    find(workspaceId: WorkspaceId, id: CrewId): Promise<Crew | undefined> {
        const c = this.rows.get(id);
        return Promise.resolve(c?.workspaceId === workspaceId ? Crew.rehydrate(c.toProps()) : undefined);
    }

    listActive(workspaceId: WorkspaceId): Promise<Crew[]> {
        return Promise.resolve(this.active(workspaceId).sort(oldestFirst).map(c => Crew.rehydrate(c.toProps())));
    }

    countActive(workspaceId: WorkspaceId): Promise<number> {
        return Promise.resolve(this.active(workspaceId).length);
    }

    findActiveByName(workspaceId: WorkspaceId, name: WorkforceName): Promise<Crew | undefined> {
        const c = this.active(workspaceId).find(x => x.name.sameKey(name));
        return Promise.resolve(c === undefined ? undefined : Crew.rehydrate(c.toProps()));
    }

    listInvolving(workspaceId: WorkspaceId, personId: PersonId): Promise<Crew[]> {
        return Promise.resolve([...this.rows.values()]
            .filter(c => c.workspaceId === workspaceId && c.involves(personId))
            .sort(oldestFirst)
            .map(c => Crew.rehydrate(c.toProps())));
    }

    update(crew: Crew): Promise<void> {
        if (this.rows.get(crew.id)?.workspaceId !== crew.workspaceId) return Promise.resolve();
        if (!crew.isArchived && this.active(crew.workspaceId).some(c => c.id !== crew.id && c.name.sameKey(crew.name))) {
            return Promise.reject(new Error(`crew name "${crew.name.value}" is taken`));
        }
        this.rows.set(crew.id, Crew.rehydrate(crew.toProps()));
        return Promise.resolve();
    }

    private active(workspaceId: WorkspaceId): Crew[] {
        return [...this.rows.values()].filter(c => c.workspaceId === workspaceId && !c.isArchived);
    }
}

export class InMemoryCrewAssignmentRepository extends CrewAssignmentRepository {
    private readonly rows = new Map<CrewAssignmentId, CrewAssignment>();

    insert(assignment: CrewAssignment): Promise<void> {
        if (this.rows.has(assignment.id)) return Promise.reject(new Error(`crew assignment ${assignment.id} already exists`));
        this.rows.set(assignment.id, CrewAssignment.rehydrate(assignment.toProps()));
        return Promise.resolve();
    }

    find(workspaceId: WorkspaceId, id: CrewAssignmentId): Promise<CrewAssignment | undefined> {
        const a = this.rows.get(id);
        return Promise.resolve(a?.workspaceId === workspaceId ? CrewAssignment.rehydrate(a.toProps()) : undefined);
    }

    list(workspaceId: WorkspaceId, filter: CrewAssignmentFilter): Promise<CrewAssignment[]> {
        const list = [...this.rows.values()]
            .filter(a => a.workspaceId === workspaceId
                && (filter.projectId === undefined || a.projectId === filter.projectId)
                && (filter.crewId === undefined || a.crewId === filter.crewId)
                && (filter.from === undefined || a.end >= filter.from)
                && (filter.to === undefined || a.start <= filter.to))
            .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)
                || (a.end < b.end ? -1 : a.end > b.end ? 1 : 0)
                || oldestFirst(a, b))
            .map(a => CrewAssignment.rehydrate(a.toProps()));
        return Promise.resolve(list);
    }

    countEndingOnOrAfter(workspaceId: WorkspaceId, crewIds: readonly CrewId[], day: string): Promise<number> {
        const crews = new Set(crewIds);
        return Promise.resolve([...this.rows.values()]
            .filter(a => a.workspaceId === workspaceId && crews.has(a.crewId) && a.end >= day).length);
    }

    update(assignment: CrewAssignment): Promise<void> {
        if (this.rows.get(assignment.id)?.workspaceId === assignment.workspaceId) {
            this.rows.set(assignment.id, CrewAssignment.rehydrate(assignment.toProps()));
        }
        return Promise.resolve();
    }

    delete(workspaceId: WorkspaceId, id: CrewAssignmentId): Promise<void> {
        if (this.rows.get(id)?.workspaceId === workspaceId) this.rows.delete(id);
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const [id, a] of this.rows) {
            if (a.workspaceId === workspaceId && a.projectId === projectId) this.rows.delete(id);
        }
        return Promise.resolve();
    }
}

export class InMemoryProjectSupervisorRepository extends ProjectSupervisorRepository {
    /** `${workspaceId}|${projectId}` → people in order. */
    private readonly rows = new Map<string, PersonId[]>();

    list(workspaceId: WorkspaceId, projectId: ProjectId): Promise<PersonId[]> {
        return Promise.resolve([...(this.rows.get(`${workspaceId}|${projectId}`) ?? [])]);
    }

    replace(workspaceId: WorkspaceId, projectId: ProjectId, personIds: readonly PersonId[]): Promise<void> {
        const key = `${workspaceId}|${projectId}`;
        if (personIds.length === 0) this.rows.delete(key);
        else this.rows.set(key, [...new Set(personIds)]);
        return Promise.resolve();
    }

    removePerson(workspaceId: WorkspaceId, personId: PersonId): Promise<void> {
        for (const [key, ids] of this.rows) {
            if (key.startsWith(`${workspaceId}|`)) this.rows.set(key, ids.filter(id => id !== personId));
        }
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        this.rows.delete(`${workspaceId}|${projectId}`);
        return Promise.resolve();
    }
}

interface StoredTaskLag extends TaskLag {
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    updatedBy: UserId;
    updatedAt: Date;
}

export class InMemoryProjectTaskLagRepository extends ProjectTaskLagRepository {
    /** `${projectId}|${taskId}` → row (the primary key). */
    private readonly rows = new Map<string, StoredTaskLag>();

    list(workspaceId: WorkspaceId, projectId: ProjectId): Promise<TaskLag[]> {
        return Promise.resolve(sortTaskLags(this.of(workspaceId, projectId).map(toLag)));
    }

    listByWorkspace(workspaceId: WorkspaceId): Promise<ProjectTaskLagRows[]> {
        const byProject = new Map<ProjectId, TaskLag[]>();
        for (const r of this.rows.values()) {
            if (r.workspaceId !== workspaceId) continue;
            byProject.set(r.projectId, [...(byProject.get(r.projectId) ?? []), toLag(r)]);
        }
        return Promise.resolve([...byProject]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([projectId, lags]) => ({ projectId, lags: sortTaskLags(lags) })));
    }

    replace(workspaceId: WorkspaceId, projectId: ProjectId, lags: readonly TaskLag[], updatedBy: UserId, at: Date): Promise<void> {
        const keep = new Set(lags.map(l => l.taskId));
        for (const r of this.of(workspaceId, projectId)) {
            if (!keep.has(r.taskId)) this.rows.delete(`${projectId}|${r.taskId}`);
        }
        for (const l of lags) {
            const key = `${projectId}|${l.taskId}`;
            const now = this.rows.get(key);
            if (now?.workspaceId === workspaceId && now.days === l.days && now.note === l.note) continue;
            this.rows.set(key, { ...toLag(l), workspaceId, projectId, updatedBy, updatedAt: new Date(at.getTime()) });
        }
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const r of this.of(workspaceId, projectId)) this.rows.delete(`${projectId}|${r.taskId}`);
        return Promise.resolve();
    }

    /** Who changed a row last, and when (tests). */
    stampOf(projectId: ProjectId, taskId: string): { updatedBy: UserId; updatedAt: Date } | undefined {
        const r = this.rows.get(`${projectId}|${taskId}`);
        return r === undefined ? undefined : { updatedBy: r.updatedBy, updatedAt: new Date(r.updatedAt.getTime()) };
    }

    private of(workspaceId: WorkspaceId, projectId: ProjectId): StoredTaskLag[] {
        return [...this.rows.values()].filter(r => r.workspaceId === workspaceId && r.projectId === projectId);
    }
}

