import type { ProjectId, RevisionId, WorkspaceId } from '../../../../shared/domain';
import { RevisionRepository, type RevisionInsertOutcome } from '../../application/ports/revision.repository';
import { Revision } from '../../domain/entities/revision.entity';

const copy = (r: Revision): Revision => {
    const props = r.toProps();
    return Revision.rehydrate({ ...props, snapshot: structuredClone(props.snapshot) });
};

export class InMemoryRevisionRepository extends RevisionRepository {
    /** Insertion order is kept (newest last), to break ties of equal createdAt. */
    private readonly rows: Revision[] = [];

    insert(revision: Revision): Promise<RevisionInsertOutcome> {
        if (this.rows.some(r => r.projectId === revision.projectId && r.label === revision.label)) {
            return Promise.resolve('label_taken');
        }
        if (this.rows.some(r => r.id === revision.id)) return Promise.reject(new Error(`revision ${revision.id} already exists`));
        this.rows.push(copy(revision));
        return Promise.resolve('inserted');
    }

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Revision[]> {
        const list = this.rows
            .map((r, i) => ({ r, i }))
            .filter(({ r }) => r.workspaceId === workspaceId && r.projectId === projectId)
            .sort((a, b) => b.r.createdAt.getTime() - a.r.createdAt.getTime() || b.i - a.i)
            .map(({ r }) => copy(r));
        return Promise.resolve(list);
    }

    find(workspaceId: WorkspaceId, projectId: ProjectId, revisionId: RevisionId): Promise<Revision | undefined> {
        const r = this.rows.find(x => x.id === revisionId && x.workspaceId === workspaceId && x.projectId === projectId);
        return Promise.resolve(r === undefined ? undefined : copy(r));
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (let i = this.rows.length - 1; i >= 0; i -= 1) {
            const r = this.rows[i];
            if (r?.workspaceId === workspaceId && r.projectId === projectId) this.rows.splice(i, 1);
        }
        return Promise.resolve();
    }
}
