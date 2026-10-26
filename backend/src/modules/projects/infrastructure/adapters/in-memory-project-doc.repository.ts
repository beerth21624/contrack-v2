import type { ProjectId, WorkspaceId } from '../../../../shared/domain';
import { ProjectDocRepository, type DocWriteOutcome } from '../../application/ports/project-doc.repository';
import { ProjectDoc } from '../../domain/entities/project-doc.entity';

/** Stored like jsonb: a deep copy, so callers can never change a stored document by reference. */
const copy = (d: ProjectDoc): ProjectDoc => {
    const props = d.toProps();
    return ProjectDoc.rehydrate({ ...props, data: props.data === null ? null : structuredClone(props.data) });
};
const rowKey = (projectId: ProjectId, docKey: string): string => `${projectId}\u0000${docKey}`;

export class InMemoryProjectDocRepository extends ProjectDocRepository {
    private readonly rows = new Map<string, ProjectDoc>();

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<ProjectDoc[]> {
        const list = [...this.rows.values()]
            .filter(d => d.workspaceId === workspaceId && d.projectId === projectId)
            .sort((a, b) => (a.docKey < b.docKey ? -1 : a.docKey > b.docKey ? 1 : 0))
            .map(copy);
        return Promise.resolve(list);
    }

    find(workspaceId: WorkspaceId, projectId: ProjectId, docKey: string): Promise<ProjectDoc | undefined> {
        const d = this.rows.get(rowKey(projectId, docKey));
        return Promise.resolve(d?.workspaceId === workspaceId ? copy(d) : undefined);
    }

    /** Check and set happen synchronously (one event-loop turn), so the compare-and-set is atomic. */
    write(doc: ProjectDoc, baseVersion: number): Promise<DocWriteOutcome> {
        if (doc.version !== baseVersion + 1) {
            return Promise.reject(new Error(`doc version ${doc.version} must be baseVersion + 1 (${baseVersion + 1})`));
        }
        const key = rowKey(doc.projectId, doc.docKey);
        const current = this.rows.get(key);
        if (current !== undefined && current.workspaceId !== doc.workspaceId) return Promise.resolve('conflict');
        const currentVersion = current?.version ?? 0;
        if (currentVersion !== baseVersion) return Promise.resolve('conflict');
        this.rows.set(key, copy(doc));
        return Promise.resolve('written');
    }

    insertMany(docs: readonly ProjectDoc[]): Promise<void> {
        for (const d of docs) {
            if (d.version !== 1) return Promise.reject(new Error('a new document starts at version 1'));
            if (this.rows.has(rowKey(d.projectId, d.docKey))) {
                return Promise.reject(new Error(`document ${d.docKey} of project ${d.projectId} already exists`));
            }
        }
        for (const d of docs) this.rows.set(rowKey(d.projectId, d.docKey), copy(d));
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const [key, d] of this.rows) {
            if (d.workspaceId === workspaceId && d.projectId === projectId) this.rows.delete(key);
        }
        return Promise.resolve();
    }
}
