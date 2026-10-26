import type { ProjectId, WorkspaceId } from '../../../../shared/domain';
import type { ActivityEntry, NewActivity } from '../../domain/entities/activity-entry.entity';

export interface ActivityPage {
    /** Only entries with an id lower than this (the last id of the previous page). */
    before?: bigint;
    limit: number;
}

export abstract class ActivityRepository {
    /** Stores the entry and returns it with its id (ids only grow). */
    abstract append(entry: NewActivity): Promise<ActivityEntry>;
    /** Newest first (id descending). */
    abstract list(workspaceId: WorkspaceId, projectId: ProjectId, page: ActivityPage): Promise<ActivityEntry[]>;
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
