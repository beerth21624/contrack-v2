import type { ProjectId, WorkspaceId } from '../../../../shared/domain';
import type { Project } from '../../domain/entities/project.entity';

export interface ListProjectsFilter {
    /** true = only archived projects, false = only active ones. */
    archived: boolean;
}

/** Projects of a workspace. Every method but findById is scoped by the workspace. */
export abstract class ProjectRepository {
    abstract insert(project: Project): Promise<void>;
    abstract findInWorkspace(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Project | undefined>;
    /** Only to find out which workspace a project belongs to (authorization comes right after). */
    abstract findById(projectId: ProjectId): Promise<Project | undefined>;
    /** Ordered by updatedAt, newest first. */
    abstract listByWorkspace(workspaceId: WorkspaceId, filter: ListProjectsFilter): Promise<Project[]>;
    abstract update(project: Project): Promise<void>;
    abstract delete(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
    /**
     * Locks the project row until the current UnitOfWork ends (`SELECT … FOR UPDATE`) and returns its latest state.
     * Serialises the writers of one project, so the summary is always computed from the latest documents.
     */
    abstract lockForUpdate(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Project | undefined>;
}
