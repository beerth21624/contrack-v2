import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { jcAlerts, jcCashSettings, jcForecasts } from '../../../../shared/infrastructure/database/schema-job-cost';
import {
    type AlertRecord, type CashSettingsRecord, type ForecastRecord, JobCostRepository,
} from '../../application/ports/job-cost.repository';

const toForecast = (r: typeof jcForecasts.$inferSelect): ForecastRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), projectId: asProjectId(r.projectId), updatedBy: asUserId(r.updatedBy),
});

const toAlert = (r: typeof jcAlerts.$inferSelect): AlertRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), projectId: asProjectId(r.projectId),
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleJobCostRepository extends JobCostRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async lockProject(_workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await this.ctx.executor.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`job-cost:${projectId}`}, 0))`);
    }

    async forecasts(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<ForecastRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(jcForecasts)
            .where(and(eq(jcForecasts.workspaceId, workspaceId), inArray(jcForecasts.projectId, [...projectIds])));
        return rows.map(toForecast);
    }

    async saveForecast(record: ForecastRecord): Promise<void> {
        await this.ctx.executor.insert(jcForecasts).values({ ...record })
            .onConflictDoUpdate({
                target: [jcForecasts.projectId, jcForecasts.costCodeId],
                set: { method: record.method, eac: record.eac, note: record.note, updatedBy: record.updatedBy, updatedAt: record.updatedAt },
            });
    }

    async deleteForecast(workspaceId: WorkspaceId, projectId: ProjectId, costCodeId: string): Promise<void> {
        await this.ctx.executor.delete(jcForecasts).where(and(
            eq(jcForecasts.workspaceId, workspaceId), eq(jcForecasts.projectId, projectId), eq(jcForecasts.costCodeId, costCodeId),
        ));
    }

    async openAlerts(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<AlertRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(jcAlerts)
            .where(and(eq(jcAlerts.workspaceId, workspaceId), inArray(jcAlerts.projectId, [...projectIds]), isNull(jcAlerts.resolvedAt)));
        return rows.map(toAlert);
    }

    async listAlerts(
        workspaceId: WorkspaceId, filter: { projectId?: ProjectId; includeResolved: boolean; limit: number },
    ): Promise<AlertRecord[]> {
        const rows = await this.ctx.executor.select().from(jcAlerts)
            .where(and(
                eq(jcAlerts.workspaceId, workspaceId),
                filter.projectId === undefined ? undefined : eq(jcAlerts.projectId, filter.projectId),
                filter.includeResolved ? undefined : isNull(jcAlerts.resolvedAt),
            ))
            .orderBy(sql`(${jcAlerts.resolvedAt} is not null)`, desc(jcAlerts.lastSeenAt), asc(jcAlerts.id))
            .limit(filter.limit);
        return rows.map(toAlert);
    }

    async insertAlerts(rows: readonly AlertRecord[]): Promise<void> {
        if (rows.length === 0) return;
        await this.ctx.executor.insert(jcAlerts).values(rows.map(r => ({ ...r })));
    }

    async updateAlerts(rows: readonly AlertRecord[]): Promise<void> {
        for (const r of rows) {
            await this.ctx.executor.update(jcAlerts)
                .set({ level: r.level, value: r.value, threshold: r.threshold, lastSeenAt: r.lastSeenAt, resolvedAt: r.resolvedAt, notifiedAt: r.notifiedAt })
                .where(and(eq(jcAlerts.workspaceId, r.workspaceId), eq(jcAlerts.id, r.id)));
        }
    }

    async cashSettings(workspaceId: WorkspaceId): Promise<CashSettingsRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(jcCashSettings).where(eq(jcCashSettings.workspaceId, workspaceId)).limit(1);
        return row === undefined ? undefined : { ...row, workspaceId: asWorkspaceId(row.workspaceId), updatedBy: asUserId(row.updatedBy) };
    }

    async saveCashSettings(record: CashSettingsRecord): Promise<void> {
        await this.ctx.executor.insert(jcCashSettings).values({ ...record })
            .onConflictDoUpdate({
                target: jcCashSettings.workspaceId,
                set: {
                    openingBalance: record.openingBalance, asOf: record.asOf, minBalance: record.minBalance,
                    updatedBy: record.updatedBy, updatedAt: record.updatedAt,
                },
            });
    }

    async deleteByProject(): Promise<void> {
        // PostgreSQL drops the job-cost rows with the project (tenant FK on delete cascade).
    }
}
