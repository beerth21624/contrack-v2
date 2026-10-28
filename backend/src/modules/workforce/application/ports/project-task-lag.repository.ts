import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain';
import type { TaskLag } from '../../domain/value-objects/task-lag.value-object';

export interface ProjectTaskLagRows {
    projectId: ProjectId;
    /** In task order ("1.9" before "1.10"). */
    lags: TaskLag[];
}

/** The waiting-window overrides (ช่วงรอ) of each project of a workspace: at most one per (project, task). */
export abstract class ProjectTaskLagRepository {
    /** The project's overrides, in task order. */
    abstract list(workspaceId: WorkspaceId, projectId: ProjectId): Promise<TaskLag[]>;
    /** Every project of the workspace that has at least one override (by project id), each in task order. */
    abstract listByWorkspace(workspaceId: WorkspaceId): Promise<ProjectTaskLagRows[]>;
    /**
     * Makes the project's overrides exactly `lags` (one per task): tasks left out are deleted; a changed or new row is
     * stamped `updatedBy` / `at`; an unchanged row keeps its stamp.
     */
    abstract replace(workspaceId: WorkspaceId, projectId: ProjectId, lags: readonly TaskLag[], updatedBy: UserId, at: Date): Promise<void>;
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
