// ─── Job cost use cases (WP-46): cost report, ledger rows, manual forecasts, alerts ───
import { Injectable } from '@nestjs/common';
import type {
    CostLedgerDto, CostLedgerEntryDto, CostLedgerQuery, JobCostAlertDto, JobCostAlertListQuery, JobCostReportDto, PutJobCostForecastRequest,
} from '@contrack/contract';
import { round2 } from '@contrack/domain/money';
import { ModuleAccess } from '../../../../shared/application/module-access';
import {
    AuditLog, Clock, type CostLedgerEntry, type CostLedgerTotals, CostCodeLookup, CostLedger, ProjectCatalog, UnitOfWork,
} from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, asProjectId } from '../../../../shared/domain/ids';
import { type Result, ok } from '../../../../shared/domain/result';
import { JobCostEngine, MODULE, alertDto, transact } from '../job-cost.service';
import { JobCostRepository } from '../ports/job-cost.repository';

/** Most alerts one list returns. */
const ALERT_LIST_LIMIT = 500;

const entryDto = (e: CostLedgerEntry): CostLedgerEntryDto => ({
    id: e.id, projectId: e.projectId, costCodeId: e.costCodeId, entryDate: e.entryDate, kind: e.kind, category: e.category, amount: e.amount,
    qty: e.qty, sourceType: e.sourceType, sourceId: e.sourceId, sourceLineId: e.sourceLineId, commitmentRef: e.commitmentRef,
    reversesId: e.reversesId, note: e.note, createdBy: e.createdBy, createdAt: e.createdAt.toISOString(),
});

const EMPTY: CostLedgerTotals = { committed: 0, released: 0, committedOpen: 0, actual: 0 };

function addTo(t: CostLedgerTotals, e: CostLedgerEntry): CostLedgerTotals {
    const committed = e.kind === 'commit' ? round2(t.committed + e.amount) : t.committed;
    const released = e.kind === 'commit_release' ? round2(t.released + e.amount) : t.released;
    const actual = e.kind === 'actual' ? round2(t.actual + e.amount) : t.actual;
    return { committed, released, committedOpen: round2(committed + released), actual };
}

/** GET /projects/:projectId/job-cost — `cost.read`. Syncs subcontracts and refreshes the alerts first. */
@Injectable()
export class GetJobCostReportUseCase {
    constructor(private readonly access: ModuleAccess, private readonly engine: JobCostEngine, private readonly catalog: ProjectCatalog) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<JobCostReportDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['cost.read'], write: false });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const state = await this.engine.refresh(ws, projectId);
        if (!state.ok) return state;
        const name = (await this.catalog.find(ws, projectId))?.name ?? '';
        return ok(this.engine.reportDto(state.value, grant.value.role, name));
    }
}

/** GET /projects/:projectId/job-cost/ledger?costCodeId= — `cost.read`: the ledger rows behind the report. */
@Injectable()
export class GetJobCostLedgerUseCase {
    constructor(private readonly access: ModuleAccess, private readonly ledger: CostLedger) {}

    async execute(userId: UserId, projectId: ProjectId, query: CostLedgerQuery): Promise<Result<CostLedgerDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['cost.read'], write: false });
        if (!grant.ok) return grant;
        const entries = await this.ledger.listByProject(grant.value.workspaceId, projectId, query.costCodeId?.toLowerCase());
        const by = new Map<string | null, CostLedgerTotals>();
        for (const e of entries) by.set(e.costCodeId, addTo(by.get(e.costCodeId) ?? EMPTY, e));
        return ok({
            entries: entries.map(entryDto),
            byCostCode: [...by].map(([costCodeId, t]) => ({ costCodeId, ...t })),
            totals: entries.reduce(addTo, EMPTY),
        });
    }
}

/** PUT /projects/:projectId/job-cost/forecasts/:costCodeId — `cost.manage`. Answers the refreshed report. */
@Injectable()
export class PutJobCostForecastUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly engine: JobCostEngine,
        private readonly repo: JobCostRepository,
        private readonly audit: AuditLog,
        private readonly catalog: ProjectCatalog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(
        userId: UserId, projectId: ProjectId, rawCostCodeId: string, body: PutJobCostForecastRequest,
    ): Promise<Result<JobCostReportDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['cost.manage'], write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const costCodeId = rawCostCodeId.toLowerCase();
        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const code = await this.engine.requireCostCode(ws, projectId, costCodeId);
            if (!code.ok) return code;
            await this.repo.lockProject(ws, projectId);
            const before = (await this.repo.forecasts(ws, [projectId])).find(f => f.costCodeId === costCodeId);
            const note = (body.note ?? '').trim();
            if (body.method === 'auto') {
                await this.repo.deleteForecast(ws, projectId, costCodeId);
            } else {
                await this.repo.saveForecast({
                    workspaceId: ws, projectId, costCodeId, method: 'manual', eac: round2(body.eac), note, updatedBy: userId, updatedAt: this.clock.now(),
                });
            }
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'cost_forecast', entityId: costCodeId, action: 'update',
                data: {
                    code: code.value.code,
                    method: [before?.method ?? 'auto', body.method],
                    eac: [before?.method === 'manual' ? before.eac : null, body.method === 'manual' ? round2(body.eac) : null],
                },
            });
            return ok(undefined);
        });
        if (!saved.ok) return saved;
        const state = await this.engine.refresh(ws, projectId);
        if (!state.ok) return state;
        const name = (await this.catalog.find(ws, projectId))?.name ?? '';
        return ok(this.engine.reportDto(state.value, grant.value.role, name));
    }
}

/** GET /workspaces/:workspaceId/job-cost/alerts?projectId=&includeResolved= — `cost.read`; live projects only. */
@Injectable()
export class ListJobCostAlertsUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: JobCostRepository,
        private readonly catalog: ProjectCatalog,
        private readonly costCodes: CostCodeLookup,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: JobCostAlertListQuery): Promise<Result<JobCostAlertDto[], DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, 'cost.read');
        if (!grant.ok) return grant;
        const names = new Map((await this.catalog.list(workspaceId, { archived: false })).map(p => [p.id, p.name]));
        const alerts = (await this.repo.listAlerts(workspaceId, {
            projectId: query.projectId === undefined ? undefined : asProjectId(query.projectId.toLowerCase()),
            includeResolved: query.includeResolved,
            limit: ALERT_LIST_LIMIT,
        })).filter(a => names.has(a.projectId));
        const withCode = [...new Set(alerts.filter(a => a.costCodeId !== null).map(a => a.projectId))];
        const codes = new Map((await this.costCodes.listByProjects(workspaceId, withCode)).map(c => [c.id, c]));
        return ok(alerts.map(a => alertDto(a, names.get(a.projectId) ?? '', a.costCodeId === null ? undefined : codes.get(a.costCodeId))));
    }
}
