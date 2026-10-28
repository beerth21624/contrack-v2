import type { PersonId, ProjectId, WorkspaceId } from '../../../../shared/domain';

/** The site supervisors of each project of a workspace (people, in the order given). */
export abstract class ProjectSupervisorRepository {
    abstract list(workspaceId: WorkspaceId, projectId: ProjectId): Promise<PersonId[]>;
    /** Makes the project's supervisors exactly `personIds` (in that order). */
    abstract replace(workspaceId: WorkspaceId, projectId: ProjectId, personIds: readonly PersonId[]): Promise<void>;
    /** Takes an archived person off every project of the workspace. */
    abstract removePerson(workspaceId: WorkspaceId, personId: PersonId): Promise<void>;
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
