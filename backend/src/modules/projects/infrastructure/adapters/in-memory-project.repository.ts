import type { ProjectId, WorkspaceId } from '../../../../shared/domain';
import { ProjectRepository, type ListProjectsFilter } from '../../application/ports/project.repository';
import { Project } from '../../domain/entities/project.entity';

const copy = (p: Project): Project => Project.rehydrate(p.toProps());

export class InMemoryProjectRepository extends ProjectRepository {
    private readonly rows = new Map<ProjectId, Project>();
    /** Per project: resolves when the current holder's lock is released. */
    private readonly locks = new Map<ProjectId, Promise<void>>();

    insert(project: Project): Promise<void> {
        if (this.rows.has(project.id)) return Promise.reject(new Error(`project ${project.id} already exists`));
        this.rows.set(project.id, copy(project));
        return Promise.resolve();
    }

    findInWorkspace(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Project | undefined> {
        const p = this.rows.get(projectId);
        return Promise.resolve(p?.workspaceId === workspaceId ? copy(p) : undefined);
    }

    findById(projectId: ProjectId): Promise<Project | undefined> {
        const p = this.rows.get(projectId);
        return Promise.resolve(p === undefined ? undefined : copy(p));
    }

    listByWorkspace(workspaceId: WorkspaceId, filter: ListProjectsFilter): Promise<Project[]> {
        const list = [...this.rows.values()]
            .filter(p => p.workspaceId === workspaceId && p.isArchived === filter.archived)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
                || b.createdAt.getTime() - a.createdAt.getTime()
                || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
            .map(copy);
        return Promise.resolve(list);
    }

    update(project: Project): Promise<void> {
        const current = this.rows.get(project.id);
        if (current?.workspaceId === project.workspaceId) this.rows.set(project.id, copy(project));
        return Promise.resolve();
    }

    delete(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        if (this.rows.get(projectId)?.workspaceId === workspaceId) this.rows.delete(projectId);
        return Promise.resolve();
    }

    /**
     * A FIFO lock per project. In-memory work never does I/O, so a whole UnitOfWork runs within the microtasks that
     * follow acquiring the lock; releasing it on the next macrotask (setImmediate) therefore releases it after the
     * holder's work, like a row lock released at COMMIT.
     */
    async lockForUpdate(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Project | undefined> {
        const previous = this.locks.get(projectId) ?? Promise.resolve();
        const held = previous.then(() => new Promise<void>(resolve => setImmediate(resolve)));
        this.locks.set(projectId, held);
        void held.then(() => {
            if (this.locks.get(projectId) === held) this.locks.delete(projectId);
        });
        await previous;
        return this.findInWorkspace(workspaceId, projectId);
    }
}
