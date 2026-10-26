import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain';
import type { LevelAssignment } from '../../domain/entities/level-assignment.entity';

/** One assignment per (project, level). */
export abstract class AssignmentRepository {
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<LevelAssignment[]>;
    abstract find(workspaceId: WorkspaceId, projectId: ProjectId, levelId: string): Promise<LevelAssignment | undefined>;
    /** Inserts or replaces the assignment of the level. */
    abstract save(assignment: LevelAssignment): Promise<void>;
    abstract remove(workspaceId: WorkspaceId, projectId: ProjectId, levelId: string): Promise<void>;
    /** Removes every assignment of the user in the workspace and returns the removed ones. */
    abstract removeByUser(workspaceId: WorkspaceId, userId: UserId): Promise<LevelAssignment[]>;
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
