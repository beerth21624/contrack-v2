import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import { BoqVersionRepository, type BoqVersionRecord, type BoqVersionRows } from '../../application/ports/boq-version.repository';

const copy = (r: BoqVersionRecord): BoqVersionRecord => ({ ...r, createdAt: new Date(r.createdAt.getTime()) });

/** Memory adapter (tests / trying without a database); mimics the unique keys of `boq_versions`. */
export class InMemoryBoqVersionRepository extends BoqVersionRepository {
    private readonly versions = new Map<string, BoqVersionRecord>();
    private readonly content = new Map<string, BoqVersionRows>();

    lockProject(): Promise<void> {
        // One event-loop turn per write: nothing to lock.
        return Promise.resolve();
    }

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BoqVersionRecord[]> {
        return Promise.resolve([...this.versions.values()]
            .filter(v => v.workspaceId === workspaceId && v.projectId === projectId)
            .sort((a, b) => a.versionNo - b.versionNo)
            .map(copy));
    }

    findById(versionId: string): Promise<BoqVersionRecord | undefined> {
        const v = this.versions.get(versionId);
        return Promise.resolve(v === undefined ? undefined : copy(v));
    }

    rows(workspaceId: WorkspaceId, versionId: string): Promise<BoqVersionRows> {
        const v = this.versions.get(versionId);
        const rows = this.content.get(versionId);
        if (v?.workspaceId !== workspaceId || rows === undefined) return Promise.resolve({ sections: [], lines: [] });
        return Promise.resolve(structuredClone(rows));
    }

    insert(version: BoqVersionRecord, rows: BoqVersionRows): Promise<void> {
        const clash = [...this.versions.values()].some(v => v.id === version.id || v.revisionId === version.revisionId
            || (v.projectId === version.projectId && v.versionNo === version.versionNo));
        if (clash) return Promise.reject(new Error(`duplicate boq version ${version.id} (revision ${version.revisionId}, no ${version.versionNo})`));
        this.versions.set(version.id, copy(version));
        this.content.set(version.id, structuredClone(rows));
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const v of [...this.versions.values()]) {
            if (v.workspaceId === workspaceId && v.projectId === projectId) {
                this.versions.delete(v.id);
                this.content.delete(v.id);
            }
        }
        return Promise.resolve();
    }
}
