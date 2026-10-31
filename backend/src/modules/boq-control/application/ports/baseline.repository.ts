import type { BaselineReason, BaselineStatus } from '@contrack/contract';
import type { CostCode } from '../../../../shared/application/ports';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** One `project_baselines` row. */
export interface BaselineRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    versionId: string;
    status: BaselineStatus;
    reason: BaselineReason;
    contractId: string | null;
    lockedBy: UserId;
    lockedAt: Date;
    unlockedBy: UserId | null;
    unlockedAt: Date | null;
    unlockReason: string;
}

export abstract class BaselineRepository {
    /** The active baseline of the project (at most one: partial unique index). */
    abstract active(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BaselineRecord | undefined>;
    /** Every baseline of the project, newest first. */
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BaselineRecord[]>;
    abstract insert(baseline: BaselineRecord): Promise<void>;
    abstract markUnlocked(workspaceId: WorkspaceId, id: string, input: { by: UserId; at: Date; reason: string }): Promise<void>;
    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}

export abstract class CostCodeRepository {
    /** Every cost code of the project, in no particular order. */
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<CostCode[]>;
    /** Every cost code of many projects of the workspace, in no particular order. */
    abstract listByProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<CostCode[]>;
    abstract findMany(workspaceId: WorkspaceId, projectId: ProjectId, ids: readonly string[]): Promise<CostCode[]>;
    abstract insertMany(codes: readonly CostCode[]): Promise<void>;
    /** Replaces the stored rows (by id, within their workspace) with these values. */
    abstract updateMany(codes: readonly CostCode[]): Promise<void>;
    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
