import type { CostCode } from '../../../../shared/application/ports';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { BaselineRepository, type BaselineRecord, CostCodeRepository } from '../../application/ports/baseline.repository';

const copyBaseline = (b: BaselineRecord): BaselineRecord => ({
    ...b,
    lockedAt: new Date(b.lockedAt.getTime()),
    unlockedAt: b.unlockedAt === null ? null : new Date(b.unlockedAt.getTime()),
});

/** Memory adapter; mimics the partial unique index (one active baseline per project). */
export class InMemoryBaselineRepository extends BaselineRepository {
    private readonly rows = new Map<string, BaselineRecord>();

    active(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BaselineRecord | undefined> {
        const found = [...this.rows.values()].find(b => b.workspaceId === workspaceId && b.projectId === projectId && b.status === 'active');
        return Promise.resolve(found === undefined ? undefined : copyBaseline(found));
    }

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BaselineRecord[]> {
        return Promise.resolve([...this.rows.values()]
            .filter(b => b.workspaceId === workspaceId && b.projectId === projectId)
            .sort((a, b) => b.lockedAt.getTime() - a.lockedAt.getTime() || b.id.localeCompare(a.id))
            .map(copyBaseline));
    }

    insert(baseline: BaselineRecord): Promise<void> {
        const clash = [...this.rows.values()].some(b => b.id === baseline.id
            || (baseline.status === 'active' && b.projectId === baseline.projectId && b.status === 'active'));
        if (clash) return Promise.reject(new Error(`duplicate baseline ${baseline.id} (project ${baseline.projectId})`));
        this.rows.set(baseline.id, copyBaseline(baseline));
        return Promise.resolve();
    }

    markUnlocked(workspaceId: WorkspaceId, id: string, input: { by: UserId; at: Date; reason: string }): Promise<void> {
        const b = this.rows.get(id);
        if (b?.workspaceId === workspaceId) {
            this.rows.set(id, { ...b, status: 'unlocked', unlockedBy: input.by, unlockedAt: new Date(input.at.getTime()), unlockReason: input.reason });
        }
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const b of [...this.rows.values()]) {
            if (b.workspaceId === workspaceId && b.projectId === projectId) this.rows.delete(b.id);
        }
        return Promise.resolve();
    }
}

const copyCode = (c: CostCode): CostCode => ({ ...c, createdAt: new Date(c.createdAt.getTime()), updatedAt: new Date(c.updatedAt.getTime()) });

/** Memory adapter; mimics unique `(project_id, code)`. */
export class InMemoryCostCodeRepository extends CostCodeRepository {
    private readonly rows = new Map<string, CostCode>();

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<CostCode[]> {
        return Promise.resolve([...this.rows.values()].filter(c => c.workspaceId === workspaceId && c.projectId === projectId).map(copyCode));
    }

    listByProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<CostCode[]> {
        const wanted = new Set<string>(projectIds);
        return Promise.resolve([...this.rows.values()].filter(c => c.workspaceId === workspaceId && wanted.has(c.projectId)).map(copyCode));
    }

    findMany(workspaceId: WorkspaceId, projectId: ProjectId, ids: readonly string[]): Promise<CostCode[]> {
        const wanted = new Set(ids);
        return Promise.resolve([...this.rows.values()]
            .filter(c => wanted.has(c.id) && c.workspaceId === workspaceId && c.projectId === projectId)
            .map(copyCode));
    }

    insertMany(codes: readonly CostCode[]): Promise<void> {
        for (const c of codes) {
            const clash = [...this.rows.values()].some(r => r.id === c.id || (r.projectId === c.projectId && r.code === c.code));
            if (clash) return Promise.reject(new Error(`duplicate cost code ${c.code} (project ${c.projectId})`));
            this.rows.set(c.id, copyCode(c));
        }
        return Promise.resolve();
    }

    updateMany(codes: readonly CostCode[]): Promise<void> {
        for (const c of codes) {
            const stored = this.rows.get(c.id);
            if (stored?.workspaceId === c.workspaceId) this.rows.set(c.id, { ...copyCode(c), createdAt: stored.createdAt });
        }
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const c of [...this.rows.values()]) {
            if (c.workspaceId === workspaceId && c.projectId === projectId) this.rows.delete(c.id);
        }
        return Promise.resolve();
    }
}
