// ─── Job cost engine (WP-46): the cost state of a project, its alerts, the report DTO, hub roll-ups ───
import { Injectable, Logger } from '@nestjs/common';
import type {
    JobCostAlertDto, JobCostAlertKind, JobCostFigures, JobCostLineDto, JobCostReportDto, MainContractStatus, Role,
} from '@contrack/contract';
import type { CostStatus } from '@contrack/domain/job-cost/cost-status';
import { projectProfit } from '@contrack/domain/job-cost/profit';
import { round2, sumMoney } from '@contrack/domain/money';
import {
    BaselineControl, BillingTotals, Clock, type CostCode, CostCodeLookup, CostLedger, type CostLedgerTotals, IdGenerator, MainContracts,
    type MainContractInfo, ModuleFlags, Notifier, ProjectCatalog, type ProjectBillingTotals, UnitOfWork, WorkspaceDirectory,
} from '../../../shared/application/ports';
import type { ProjectRollup } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import type { ProjectId, WorkspaceId } from '../../../shared/domain/ids';
import { can } from '../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../shared/domain/result';
import {
    COST_ALERT_KINDS, type ForecastFigures, type MarginFigures, type ProjectCost, type WantedAlert, alertKey, projectCost, wantedAlerts,
} from '../domain/job-cost-rules';
import { type AlertRecord, type ForecastRecord, JobCostRepository } from './ports/job-cost.repository';
import { SubcontractCostSync } from './subcontract-cost-sync';

export const MODULE = 'job-cost';

/** Main contract statuses whose value counts as the project's revenue. */
const REVENUE_STATUSES: readonly MainContractStatus[] = ['signed', 'completed', 'closed'];

/** Thrown inside a transaction so an `err` rolls it back (the UnitOfWork commits on a normal return). */
class Rollback extends Error {
    constructor(readonly error: DomainError) {
        super(error.message);
    }
}

/** Runs `work` in one transaction; an `err` result rolls everything back and is returned. Joins an open transaction. */
export async function transact<T>(uow: UnitOfWork, work: () => Promise<Result<T, DomainError>>): Promise<Result<T, DomainError>> {
    try {
        return await uow.run(async () => {
            const r = await work();
            if (!r.ok) throw new Rollback(r.error);
            return r;
        });
    } catch (e) {
        if (e instanceof Rollback) return err(e.error);
        throw e;
    }
}

/** Everything the report shows, read at one moment. */
export interface CostState {
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    baselineLocked: boolean;
    useReported: boolean;
    cost: ProjectCost;
    contract: MainContractInfo | undefined;
    revenue: number | null;
    billing: ProjectBillingTotals | null;
    openAlerts: AlertRecord[];
}

/** A newly raised alert to tell people about (after the transaction committed). */
interface AlertNotice {
    kind: JobCostAlertKind;
    code: string | null;
    amount: number;
}

const forecastMap = (rows: readonly ForecastRecord[]): Map<string, ForecastFigures> =>
    new Map(rows.map(r => [r.costCodeId, { method: r.method, eac: r.eac, note: r.note, updatedAt: r.updatedAt }]));

const ledgerMap = (rows: readonly (CostLedgerTotals & { costCodeId: string | null })[]): Map<string | null, CostLedgerTotals> =>
    new Map(rows.map(r => [r.costCodeId, r]));

export const figures = (s: CostStatus): JobCostFigures => ({
    budget: s.budget, committedOpen: s.committedOpen, actual: s.actual, earned: s.earned, etc: s.etc, eac: s.eac, variance: s.variance, level: s.level,
});

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

export function alertDto(a: AlertRecord, projectName: string, code: CostCode | undefined): JobCostAlertDto {
    return {
        id: a.id, projectId: a.projectId, projectName, costCodeId: a.costCodeId, code: code?.code ?? null, descTh: code?.descTh ?? null,
        descEn: code?.descEn ?? null, kind: a.kind, level: a.level, value: a.value, threshold: a.threshold,
        firstSeenAt: a.firstSeenAt.toISOString(), lastSeenAt: a.lastSeenAt.toISOString(), resolvedAt: iso(a.resolvedAt), notifiedAt: iso(a.notifiedAt),
    };
}

/** Codes of a notification title: the first three, then "+n". */
function codesTitle(codes: readonly string[]): string {
    const shown = codes.slice(0, 3).join(', ');
    return codes.length > 3 ? `${shown} +${codes.length - 3}` : shown;
}

@Injectable()
export class JobCostEngine {
    private readonly logger = new Logger(JobCostEngine.name);

    constructor(
        private readonly repo: JobCostRepository,
        private readonly costCodes: CostCodeLookup,
        private readonly ledger: CostLedger,
        private readonly baselines: BaselineControl,
        private readonly contracts: MainContracts,
        private readonly billing: BillingTotals,
        private readonly flags: ModuleFlags,
        private readonly sync: SubcontractCostSync,
        private readonly catalog: ProjectCatalog,
        private readonly directory: WorkspaceDirectory,
        private readonly notifier: Notifier,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    /**
     * In one transaction (project lock): subcontracts → ledger, the cost state, alerts upserted / resolved. New alerts
     * are notified (`cost.overrun`) after the commit.
     */
    async refresh(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Result<CostState, DomainError>> {
        const done = await transact(this.uow, async (): Promise<Result<{ state: CostState; notices: AlertNotice[] }, DomainError>> => {
            await this.repo.lockProject(workspaceId, projectId);
            const codes = await this.costCodes.listByProject(workspaceId, projectId);
            await this.sync.syncProject(workspaceId, projectId, codes);
            const state = await this.read(workspaceId, projectId, codes);
            const { open, notices } = await this.evaluate(state);
            return ok({ state: { ...state, openAlerts: open }, notices });
        });
        if (!done.ok) return done;
        if (done.value.notices.length > 0) {
            try {
                await this.notify(workspaceId, projectId, done.value.notices);
            } catch (e) {
                this.logger.error(`cost.overrun ${projectId}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        return ok(done.value.state);
    }

    /** The cost state without writing anything (open alerts as stored). */
    async read(workspaceId: WorkspaceId, projectId: ProjectId, codes?: readonly CostCode[]): Promise<CostState> {
        const costCodes = codes ?? await this.costCodes.listByProject(workspaceId, projectId);
        const [totals, forecasts, baseline, useReported, contractsOn, billingOn, openAlerts] = await Promise.all([
            this.ledger.totalsByCostCode(workspaceId, projectId),
            this.repo.forecasts(workspaceId, [projectId]),
            this.baselines.status(workspaceId, projectId),
            this.flags.isEnabled(workspaceId, 'site-diary'),
            this.flags.isEnabled(workspaceId, 'contracts'),
            this.flags.isEnabled(workspaceId, 'billing'),
            this.repo.openAlerts(workspaceId, [projectId]),
        ]);
        const cost = projectCost(costCodes, ledgerMap(totals), forecastMap(forecasts), useReported);
        const contract = contractsOn ? await this.contracts.forProject(workspaceId, projectId) : undefined;
        const revenue = contract !== undefined && REVENUE_STATUSES.includes(contract.status) ? contract.currentValue : null;
        const billing = billingOn ? await this.billing.totalsByProject(workspaceId, projectId) : null;
        return { workspaceId, projectId, baselineLocked: baseline !== undefined, useReported, cost, contract, revenue, billing, openAlerts };
    }

    /** The margin figures behind `margin_drop` (null without revenue or quoted margin). */
    private margin(state: CostState): MarginFigures | null {
        const quoted = state.contract?.quotedMarginPct ?? null;
        if (state.revenue === null || state.revenue <= 0 || quoted === null) return null;
        const p = projectProfit(state.revenue, state.cost.totals.eac, round2(state.cost.forecastCost - state.cost.totals.eac));
        return p.marginPct === null ? null : { revenue: p.revenue, marginPct: p.marginPct, quotedMarginPct: quoted };
    }

    /** Upserts the wanted alerts, resolves the others (cost kinds only); marks and returns the ones to notify. */
    private async evaluate(state: CostState): Promise<{ open: AlertRecord[]; notices: AlertNotice[] }> {
        const now = this.clock.now();
        const wanted = wantedAlerts(state.cost, this.margin(state));
        const managed = state.openAlerts.filter(a => COST_ALERT_KINDS.includes(a.kind));
        const others = state.openAlerts.filter(a => !COST_ALERT_KINDS.includes(a.kind));
        const existing = new Map(managed.map(a => [alertKey(a.scopeKey, a.kind), a]));
        const wantedByKey = new Map<string, WantedAlert>(wanted.map(w => [alertKey(w.scopeKey, w.kind), w]));
        const inserts: AlertRecord[] = [];
        const updates: AlertRecord[] = [];
        for (const [key, w] of wantedByKey) {
            const a = existing.get(key);
            if (a === undefined) {
                inserts.push({
                    id: this.ids.newId(), workspaceId: state.workspaceId, projectId: state.projectId, costCodeId: w.costCodeId, scopeKey: w.scopeKey,
                    kind: w.kind, level: w.level, value: w.value, threshold: w.threshold, firstSeenAt: now, lastSeenAt: now, resolvedAt: null, notifiedAt: now,
                });
            } else {
                updates.push({ ...a, level: w.level, value: w.value, threshold: w.threshold, lastSeenAt: now, notifiedAt: a.notifiedAt ?? now });
            }
        }
        for (const [key, a] of existing) if (!wantedByKey.has(key)) updates.push({ ...a, resolvedAt: now });
        const toNotify = [...inserts, ...updates.filter(u => u.resolvedAt === null && existing.get(alertKey(u.scopeKey, u.kind))?.notifiedAt === null)];
        await this.repo.insertAlerts(inserts);
        await this.repo.updateAlerts(updates);
        const codeOf = new Map(state.cost.lines.map(l => [l.costCode.id, l.costCode.code]));
        const notices = toNotify.map(a => ({
            kind: a.kind,
            code: a.costCodeId === null ? null : (codeOf.get(a.costCodeId) ?? null),
            amount: wantedByKey.get(alertKey(a.scopeKey, a.kind))?.amount ?? 0,
        }));
        const open = [...others, ...inserts, ...updates.filter(u => u.resolvedAt === null)];
        return { open, notices };
    }

    /** One `cost.overrun` per alert kind of the project to the members with `cost.read`. */
    private async notify(workspaceId: WorkspaceId, projectId: ProjectId, notices: readonly AlertNotice[]): Promise<void> {
        const toUserIds = (await this.directory.members(workspaceId)).filter(m => can(m.role, 'cost.read')).map(m => m.userId);
        if (toUserIds.length === 0) return;
        const projectName = (await this.catalog.find(workspaceId, projectId))?.name ?? '';
        const href = `/p/${projectId}/cost`;
        for (const kind of COST_ALERT_KINDS) {
            const mine = notices.filter(n => n.kind === kind);
            if (mine.length === 0) continue;
            const codes = mine.flatMap(n => (n.code === null ? [] : [n.code]));
            await this.notifier.notify({
                template: 'cost.overrun', toUserIds,
                payload: { projectName, title: codesTitle(codes), amount: sumMoney(mine.map(n => n.amount)), href },
            });
        }
    }

    /** The report DTO of a state (`quotedMarginPct` only for roles with `quotations.seeMargins`). */
    reportDto(state: CostState, role: Role, projectName: string): JobCostReportDto {
        const { cost } = state;
        const lines: JobCostLineDto[] = cost.lines.map(({ costCode: c, status: s, forecast: f }) => ({
            ...figures(s),
            costCodeId: c.id, code: c.code, source: c.source, status: c.status, sectionNo: c.sectionNo, descTh: c.descTh, descEn: c.descEn,
            unit: c.unit, progress: s.progress, forecastMethod: f?.method ?? 'auto', forecastEac: f?.method === 'manual' ? f.eac : null,
            forecastNote: f?.note ?? '', forecastUpdatedAt: f === undefined ? null : f.updatedAt.toISOString(),
        }));
        const overhead = round2(cost.forecastCost - cost.totals.eac);
        const profit = state.revenue === null ? null : projectProfit(state.revenue, cost.totals.eac, overhead);
        const codeById = new Map(cost.lines.map(l => [l.costCode.id, l.costCode]));
        return {
            projectId: state.projectId,
            baselineLocked: state.baselineLocked,
            progressSource: state.useReported ? 'reported' : 'certified',
            lines,
            sections: cost.sections.map(s => ({ ...figures(s.status), sectionNo: s.sectionNo, progress: s.status.progress, lineCount: s.lineCount })),
            unassigned: cost.unassigned,
            totals: figures(cost.totals),
            profit: {
                contractId: state.contract?.id ?? null,
                contractStatus: state.contract?.status ?? null,
                revenue: profit?.revenue ?? null,
                cost: cost.forecastCost,
                profit: profit?.profit ?? null,
                marginPct: profit?.marginPct ?? null,
                quotedMarginPct: can(role, 'quotations.seeMargins') ? (state.contract?.quotedMarginPct ?? null) : null,
                billed: state.billing?.billed ?? null,
                received: state.billing?.received ?? null,
            },
            alerts: [...state.openAlerts]
                .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime() || a.id.localeCompare(b.id))
                .map(a => alertDto(a, projectName, a.costCodeId === null ? undefined : codeById.get(a.costCodeId))),
            generatedAt: this.clock.now().toISOString(),
        };
    }

    /**
     * Hub roll-up of many projects (a constant number of reads): committedOpen / actualCost (unassigned included),
     * forecastAtCompletion = Σ EAC + unassigned, projectedProfit = Σ contract amounts of the cost codes − that, and the
     * kinds of the open alerts.
     */
    async rollup(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, Partial<ProjectRollup>>> {
        const out = new Map<ProjectId, Partial<ProjectRollup>>();
        if (projectIds.length === 0 || !(await this.flags.isEnabled(workspaceId, MODULE))) return out;
        const [codes, totals, forecasts, alerts, useReported] = await Promise.all([
            this.costCodes.listByProjects(workspaceId, projectIds),
            this.ledger.totalsByProjectCostCode(workspaceId, projectIds),
            this.repo.forecasts(workspaceId, projectIds),
            this.repo.openAlerts(workspaceId, projectIds),
            this.flags.isEnabled(workspaceId, 'site-diary'),
        ]);
        const group = <T extends { projectId: ProjectId }>(rows: readonly T[]): Map<ProjectId, T[]> => {
            const m = new Map<ProjectId, T[]>();
            for (const r of rows) m.set(r.projectId, [...(m.get(r.projectId) ?? []), r]);
            return m;
        };
        const codesBy = group(codes);
        const totalsBy = group(totals);
        const forecastsBy = group(forecasts);
        const alertsBy = group(alerts);
        for (const projectId of new Set(projectIds)) {
            const myCodes = codesBy.get(projectId) ?? [];
            const myTotals = totalsBy.get(projectId) ?? [];
            const myAlerts = alertsBy.get(projectId) ?? [];
            if (myCodes.length === 0 && myTotals.length === 0 && myAlerts.length === 0) continue;
            const cost = projectCost(myCodes, ledgerMap(myTotals), forecastMap(forecastsBy.get(projectId) ?? []), useReported);
            const revenue = sumMoney(myCodes.map(c => round2(c.contractAmount + c.voContractAmount)));
            out.set(projectId, {
                committedOpen: cost.committedOpen,
                actualCost: cost.actual,
                forecastAtCompletion: cost.forecastCost,
                projectedProfit: revenue > 0 ? round2(revenue - cost.forecastCost) : null,
                alerts: [...new Set(myAlerts.map(a => a.kind))],
            });
        }
        return out;
    }

    /** not_found unless the cost code is one of the project's. */
    async requireCostCode(workspaceId: WorkspaceId, projectId: ProjectId, costCodeId: string): Promise<Result<CostCode, DomainError>> {
        const [code] = await this.costCodes.findMany(workspaceId, projectId, [costCodeId]);
        return code === undefined ? err(DomainError.notFound('Cost code')) : ok(code);
    }
}
