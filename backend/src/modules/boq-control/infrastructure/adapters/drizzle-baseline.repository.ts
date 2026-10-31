import { and, desc, eq, inArray } from 'drizzle-orm';
import type { CostCode } from '../../../../shared/application/ports';
import { type ProjectId, type UserId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { projectBaselines, projectCostCodes } from '../../../../shared/infrastructure/database/schema-boq-control';
import { BaselineRepository, type BaselineRecord, CostCodeRepository } from '../../application/ports/baseline.repository';

const toBaseline = (r: typeof projectBaselines.$inferSelect): BaselineRecord => ({
    id: r.id,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    versionId: r.versionId,
    status: r.status,
    reason: r.reason,
    contractId: r.contractId,
    lockedBy: asUserId(r.lockedBy),
    lockedAt: r.lockedAt,
    unlockedBy: r.unlockedBy === null ? null : asUserId(r.unlockedBy),
    unlockedAt: r.unlockedAt,
    unlockReason: r.unlockReason,
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleBaselineRepository extends BaselineRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async active(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BaselineRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(projectBaselines)
            .where(and(
                eq(projectBaselines.workspaceId, workspaceId), eq(projectBaselines.projectId, projectId), eq(projectBaselines.status, 'active'),
            ))
            .limit(1);
        return row === undefined ? undefined : toBaseline(row);
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BaselineRecord[]> {
        const rows = await this.ctx.executor.select().from(projectBaselines)
            .where(and(eq(projectBaselines.workspaceId, workspaceId), eq(projectBaselines.projectId, projectId)))
            .orderBy(desc(projectBaselines.lockedAt), desc(projectBaselines.id));
        return rows.map(toBaseline);
    }

    async insert(baseline: BaselineRecord): Promise<void> {
        await this.ctx.executor.insert(projectBaselines).values({ ...baseline });
    }

    async markUnlocked(workspaceId: WorkspaceId, id: string, input: { by: UserId; at: Date; reason: string }): Promise<void> {
        await this.ctx.executor.update(projectBaselines)
            .set({ status: 'unlocked', unlockedBy: input.by, unlockedAt: input.at, unlockReason: input.reason })
            .where(and(eq(projectBaselines.workspaceId, workspaceId), eq(projectBaselines.id, id)));
    }

    async deleteByProject(): Promise<void> {
        // PostgreSQL drops the baselines with the project (tenant FK on delete cascade).
    }
}

const toCostCode = (r: typeof projectCostCodes.$inferSelect): CostCode => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
});

/** Rows per insert statement (28 columns × 500 stays far below PostgreSQL's 65535 parameters). */
const CHUNK = 500;

export class DrizzleCostCodeRepository extends CostCodeRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<CostCode[]> {
        const rows = await this.ctx.executor.select().from(projectCostCodes)
            .where(and(eq(projectCostCodes.workspaceId, workspaceId), eq(projectCostCodes.projectId, projectId)));
        return rows.map(toCostCode);
    }

    async findMany(workspaceId: WorkspaceId, projectId: ProjectId, ids: readonly string[]): Promise<CostCode[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(projectCostCodes)
            .where(and(
                eq(projectCostCodes.workspaceId, workspaceId), eq(projectCostCodes.projectId, projectId), inArray(projectCostCodes.id, [...ids]),
            ));
        return rows.map(toCostCode);
    }

    async insertMany(codes: readonly CostCode[]): Promise<void> {
        for (let i = 0; i < codes.length; i += CHUNK) {
            await this.ctx.executor.insert(projectCostCodes).values(codes.slice(i, i + CHUNK).map(c => ({ ...c })));
        }
    }

    async updateMany(codes: readonly CostCode[]): Promise<void> {
        for (const { id, workspaceId, projectId: _p, createdAt: _c, ...values } of codes) {
            await this.ctx.executor.update(projectCostCodes).set(values)
                .where(and(eq(projectCostCodes.workspaceId, workspaceId), eq(projectCostCodes.id, id)));
        }
    }

    async deleteByProject(): Promise<void> {
        // PostgreSQL drops the cost codes with the project (tenant FK on delete cascade).
    }
}
