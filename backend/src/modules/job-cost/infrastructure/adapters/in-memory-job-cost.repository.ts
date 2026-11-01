import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import {
    type AlertRecord, type CashSettingsRecord, type ForecastRecord, JobCostRepository,
} from '../../application/ports/job-cost.repository';

const copyForecast = (r: ForecastRecord): ForecastRecord => ({ ...r, updatedAt: new Date(r.updatedAt.getTime()) });
const copyAlert = (r: AlertRecord): AlertRecord => structuredClone(r);
const forecastKey = (projectId: string, costCodeId: string): string => `${projectId}|${costCodeId}`;

/** Recently seen first, open ones before resolved ones. */
export const alertOrder = (a: AlertRecord, b: AlertRecord): number =>
    Number(a.resolvedAt !== null) - Number(b.resolvedAt !== null) || b.lastSeenAt.getTime() - a.lastSeenAt.getTime() || a.id.localeCompare(b.id);

/** Memory adapter; mimics the partial unique index of open alerts. */
export class InMemoryJobCostRepository extends JobCostRepository {
    private readonly forecastRows = new Map<string, ForecastRecord>();
    private readonly alertRows = new Map<string, AlertRecord>();
    private readonly cashRows = new Map<string, CashSettingsRecord>();

    lockProject(): Promise<void> {
        return Promise.resolve();
    }

    forecasts(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<ForecastRecord[]> {
        const wanted = new Set<string>(projectIds);
        return Promise.resolve([...this.forecastRows.values()]
            .filter(r => r.workspaceId === workspaceId && wanted.has(r.projectId)).map(copyForecast));
    }

    saveForecast(record: ForecastRecord): Promise<void> {
        this.forecastRows.set(forecastKey(record.projectId, record.costCodeId), copyForecast(record));
        return Promise.resolve();
    }

    deleteForecast(workspaceId: WorkspaceId, projectId: ProjectId, costCodeId: string): Promise<void> {
        const key = forecastKey(projectId, costCodeId);
        if (this.forecastRows.get(key)?.workspaceId === workspaceId) this.forecastRows.delete(key);
        return Promise.resolve();
    }

    openAlerts(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<AlertRecord[]> {
        const wanted = new Set<string>(projectIds);
        return Promise.resolve([...this.alertRows.values()]
            .filter(r => r.workspaceId === workspaceId && wanted.has(r.projectId) && r.resolvedAt === null).map(copyAlert));
    }

    listAlerts(workspaceId: WorkspaceId, filter: { projectId?: ProjectId; includeResolved: boolean; limit: number }): Promise<AlertRecord[]> {
        return Promise.resolve([...this.alertRows.values()]
            .filter(r => r.workspaceId === workspaceId && (filter.projectId === undefined || r.projectId === filter.projectId)
                && (filter.includeResolved || r.resolvedAt === null))
            .sort(alertOrder)
            .slice(0, filter.limit)
            .map(copyAlert));
    }

    insertAlerts(rows: readonly AlertRecord[]): Promise<void> {
        for (const r of rows) {
            const clash = [...this.alertRows.values()].some(a => a.resolvedAt === null && r.resolvedAt === null
                && a.projectId === r.projectId && a.scopeKey === r.scopeKey && a.kind === r.kind);
            if (clash || this.alertRows.has(r.id)) return Promise.reject(new Error(`duplicate open alert ${r.scopeKey} ${r.kind}`));
            this.alertRows.set(r.id, copyAlert(r));
        }
        return Promise.resolve();
    }

    updateAlerts(rows: readonly AlertRecord[]): Promise<void> {
        for (const r of rows) if (this.alertRows.get(r.id)?.workspaceId === r.workspaceId) this.alertRows.set(r.id, copyAlert(r));
        return Promise.resolve();
    }

    cashSettings(workspaceId: WorkspaceId): Promise<CashSettingsRecord | undefined> {
        const row = this.cashRows.get(workspaceId);
        return Promise.resolve(row === undefined ? undefined : { ...row, updatedAt: new Date(row.updatedAt.getTime()) });
    }

    saveCashSettings(record: CashSettingsRecord): Promise<void> {
        this.cashRows.set(record.workspaceId, { ...record, updatedAt: new Date(record.updatedAt.getTime()) });
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const [k, r] of [...this.forecastRows]) if (r.workspaceId === workspaceId && r.projectId === projectId) this.forecastRows.delete(k);
        for (const [k, r] of [...this.alertRows]) if (r.workspaceId === workspaceId && r.projectId === projectId) this.alertRows.delete(k);
        return Promise.resolve();
    }
}
