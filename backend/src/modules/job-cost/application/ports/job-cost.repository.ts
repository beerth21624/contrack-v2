import type { JobCostAlertKind, JobCostAlertLevel, JobCostForecastMethod } from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

export interface ForecastRecord {
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    costCodeId: string;
    method: JobCostForecastMethod;
    eac: number;
    note: string;
    updatedBy: UserId;
    updatedAt: Date;
}

export interface AlertRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    costCodeId: string | null;
    scopeKey: string;
    kind: JobCostAlertKind;
    level: JobCostAlertLevel;
    value: number;
    threshold: number;
    firstSeenAt: Date;
    lastSeenAt: Date;
    resolvedAt: Date | null;
    notifiedAt: Date | null;
}

/** `jc_cash_settings` (WP-47). */
export interface CashSettingsRecord {
    workspaceId: WorkspaceId;
    openingBalance: number;
    asOf: string;
    minBalance: number;
    updatedBy: UserId;
    updatedAt: Date;
}

/** `jc_forecasts`, `jc_alerts`, `jc_cash_settings`. Every query filters by workspace. */
export abstract class JobCostRepository {
    /** Serializes the job-cost writers of a project (subcontract sync, alerts) until the transaction ends (memory: no-op). */
    abstract lockProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
    abstract forecasts(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<ForecastRecord[]>;
    /** Insert or replace by (project, cost code). */
    abstract saveForecast(record: ForecastRecord): Promise<void>;
    abstract deleteForecast(workspaceId: WorkspaceId, projectId: ProjectId, costCodeId: string): Promise<void>;
    /** Alerts not resolved yet. */
    abstract openAlerts(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<AlertRecord[]>;
    /** Open first, then the most recently seen; at most `limit`. */
    abstract listAlerts(
        workspaceId: WorkspaceId, filter: { projectId?: ProjectId; includeResolved: boolean; limit: number },
    ): Promise<AlertRecord[]>;
    abstract insertAlerts(rows: readonly AlertRecord[]): Promise<void>;
    abstract updateAlerts(rows: readonly AlertRecord[]): Promise<void>;
    abstract cashSettings(workspaceId: WorkspaceId): Promise<CashSettingsRecord | undefined>;
    /** Insert or replace by workspace. */
    abstract saveCashSettings(record: CashSettingsRecord): Promise<void>;
    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
