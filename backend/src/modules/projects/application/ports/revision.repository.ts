import type { ProjectId, RevisionId, WorkspaceId } from '../../../../shared/domain';
import type { Revision } from '../../domain/entities/revision.entity';

/** `label_taken`: the project already has a revision with this label; nothing was stored. */
export type RevisionInsertOutcome = 'inserted' | 'label_taken';

export abstract class RevisionRepository {
    abstract insert(revision: Revision): Promise<RevisionInsertOutcome>;
    /** Newest first. */
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Revision[]>;
    abstract find(workspaceId: WorkspaceId, projectId: ProjectId, revisionId: RevisionId): Promise<Revision | undefined>;
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
