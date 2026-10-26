import type { ProjectId, WorkspaceId } from '../../../../shared/domain';
import type { ProjectDoc } from '../../domain/entities/project-doc.entity';

/** `written`: the document now has `doc.version`. `conflict`: the stored version was not `baseVersion`; nothing changed. */
export type DocWriteOutcome = 'written' | 'conflict';

export abstract class ProjectDocRepository {
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<ProjectDoc[]>;
    abstract find(workspaceId: WorkspaceId, projectId: ProjectId, docKey: string): Promise<ProjectDoc | undefined>;
    /**
     * Atomic compare-and-set. baseVersion 0: insert only if the document does not exist (`ON CONFLICT DO NOTHING`).
     * Otherwise: `UPDATE … WHERE version = baseVersion`. `doc.version` must be baseVersion + 1.
     */
    abstract write(doc: ProjectDoc, baseVersion: number): Promise<DocWriteOutcome>;
    /** First documents of a new project (all at version 1). */
    abstract insertMany(docs: readonly ProjectDoc[]): Promise<void>;
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
