// ─── Cash flow engine (WP-47, docs/erp/02-domain-model.md §9): planned (CashPlanSources) vs actual (fin_events.cash) ───
// per project and for the company, the portal's 13-week outlook and the daily sweep `job-cost.cash`: `negative_cash`
// alerts per project (jc_alerts, scope `project`) and `cash.negative_forecast` at most once a day per workspace when the
// company balance is forecast below its minimum.
import { Injectable, Logger } from '@nestjs/common';
import type {
    CashEstimateWeekDto, CashFlowDto, CashPlanItemDto, CashSettingsDto, JobCostAlertLevel,
} from '@contrack/contract';
import { CASH_FLOW_DEFAULT_WEEKS } from '@contrack/contract';
import { addDays, bangkokToday, compareDates, isBusinessDate } from '@contrack/domain/dates/business-date';
import {
    type CashActual, type CashProjection, cashProjection, openingBalance, weekStartOf, windowStart,
} from '@contrack/domain/job-cost/cash-projection';
import { computeProject } from '@contrack/domain/project';
import {
    type CashOutlookWeekInfo, type CashPlanItem, CashPlanSources, Clock, FinancialEvents, IdGenerator, ModuleFlags, Notifier, ProjectCatalog,
    ProjectReader, SweepMarks, type SweepContext, UnitOfWork, WorkspaceDirectory,
} from '../../../shared/application/ports';
import { type ProjectId, type WorkspaceId, asProjectId } from '../../../shared/domain/ids';
import { can } from '../../../shared/domain/permissions';
import { ok } from '../../../shared/domain/result';
import { MODULE, transact } from './job-cost.service';
import { type AlertRecord, type CashSettingsRecord, JobCostRepository } from './ports/job-cost.repository';

export const CASH_SWEEP = 'job-cost.cash';

/** Most workspaces one sweep visits. */
const WORKSPACE_LIMIT = 10_000;
/** A project's first week below zero within this many weeks (current one included) is critical. */
const CRITICAL_WEEKS = 4;
const NEGATIVE_CASH = 'negative_cash';
const PROJECT_SCOPE = 'project';

export interface CashWindow {
    today: string;
    weeks: number;
    pastWeeks: number;
}

/** First and last day of the window. */
function windowRange(w: CashWindow): { start: string; end: string } {
    const start = windowStart(w.today, w.pastWeeks);
    return { start, end: addDays(start, 7 * (w.pastWeeks + w.weeks) - 1) };
}

const byDate = (a: CashPlanItem, b: CashPlanItem): number => compareDates(a.date, b.date) || b.amount - a.amount;

export function settingsDto(s: CashSettingsRecord | undefined): CashSettingsDto {
    return s === undefined
        ? { openingBalance: 0, asOf: null, minBalance: 0, updatedAt: null }
        : { openingBalance: s.openingBalance, asOf: s.asOf, minBalance: s.minBalance, updatedAt: s.updatedAt.toISOString() };
}

@Injectable()
export class CashFlowEngine {
    private readonly logger = new Logger(CashFlowEngine.name);

    constructor(
        private readonly sources: CashPlanSources,
        private readonly flags: ModuleFlags,
        private readonly events: FinancialEvents,
        private readonly repo: JobCostRepository,
        private readonly catalog: ProjectCatalog,
        private readonly projects: ProjectReader,
        private readonly directory: WorkspaceDirectory,
        private readonly notifier: Notifier,
        private readonly marks: SweepMarks,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    /** Items of every active module's source (a failing source is logged and left out). */
    async planned(workspaceId: WorkspaceId, projectIds: readonly ProjectId[] | 'all', today: string, to: string): Promise<CashPlanItem[]> {
        const out: CashPlanItem[] = [];
        for (const { module, source } of this.sources.sources()) {
            if (!(await this.flags.isEnabled(workspaceId, module))) continue;
            try {
                out.push(...(await source(workspaceId, projectIds, today, to)).filter(i => i.amount > 0 && i.date <= to));
            } catch (e) {
                this.logger.error(`cash plan ${module} ${workspaceId}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        return out.sort(byDate);
    }

    /** Actual cash events as projection input. */
    private static actual(events: readonly { eventDate: string; cash: number }[]): CashActual[] {
        return events.filter(e => e.cash !== 0).map(e => ({ date: e.eventDate, cash: e.cash }));
    }

    private static items(items: readonly CashPlanItem[], names: ReadonlyMap<string, string>): CashPlanItemDto[] {
        return items.map(i => ({ ...i, projectName: names.get(i.projectId) ?? '' }));
    }

    /** The company's projection: every live project's plan, every cash event of the workspace, opening from settings. */
    async company(workspaceId: WorkspaceId, w: CashWindow): Promise<{ dto: CashFlowDto; projection: CashProjection }> {
        const { start, end } = windowRange(w);
        const live = await this.catalog.list(workspaceId, { archived: false });
        const names = new Map(live.map(p => [p.id, p.name]));
        const settings = await this.repo.cashSettings(workspaceId);
        const planned = (await this.planned(workspaceId, 'all', w.today, end)).filter(i => names.has(i.projectId));
        const from = settings === undefined ? undefined : (compareDates(settings.asOf, start) < 0 ? settings.asOf : start);
        const actual = CashFlowEngine.actual(await this.events.list(workspaceId, { from, to: end }));
        const opening = openingBalance(settings?.openingBalance ?? 0, settings?.asOf ?? null, actual, start);
        const minBalance = settings?.minBalance ?? 0;
        const projection = cashProjection({ opening, planned, actual, today: w.today, weeks: w.weeks, pastWeeks: w.pastWeeks, minBalance });
        return {
            projection,
            dto: {
                scope: 'company', projectId: null, today: w.today, opening: projection.opening, minBalance, weeks: projection.weeks,
                firstBelowMin: projection.firstBelowMin, lowestBalance: projection.lowestBalance, items: CashFlowEngine.items(planned, names),
                estimate: null, settings: settingsDto(settings), generatedAt: this.clock.now().toISOString(),
            },
        };
    }

    /** One project: its plan and cash events, opening = Σ its cash before the window, minimum 0, the estimate's line. */
    async project(workspaceId: WorkspaceId, projectId: ProjectId, projectName: string, w: CashWindow): Promise<CashFlowDto> {
        const { end } = windowRange(w);
        const planned = await this.planned(workspaceId, [projectId], w.today, end);
        const actual = CashFlowEngine.actual(await this.events.list(workspaceId, { projectId, to: end }));
        const projection = this.projectProjection(planned, actual, w);
        return {
            scope: 'project', projectId, today: w.today, opening: projection.opening, minBalance: 0, weeks: projection.weeks,
            firstBelowMin: projection.firstBelowMin, lowestBalance: projection.lowestBalance,
            items: CashFlowEngine.items(planned, new Map([[projectId, projectName]])),
            estimate: await this.estimate(projectId), settings: null, generatedAt: this.clock.now().toISOString(),
        };
    }

    private projectProjection(planned: readonly CashPlanItem[], actual: readonly CashActual[], w: CashWindow): CashProjection {
        const opening = openingBalance(0, null, actual, windowStart(w.today, w.pastWeeks));
        return cashProjection({ opening, planned, actual, today: w.today, weeks: w.weeks, pastWeeks: w.pastWeeks, minBalance: 0 });
    }

    /** computeProject(project).planning.cashflow per bucket (quarter months of the estimate); null when it cannot be computed. */
    private async estimate(projectId: ProjectId): Promise<CashEstimateWeekDto[] | null> {
        try {
            const read = await this.projects.read(projectId);
            if (read === undefined) return null;
            const cf = computeProject(read.project).planning.cashflow;
            if (cf.buckets.length === 0) return null;
            const num = (v: number | undefined): number => (v !== undefined && Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
            return cf.buckets
                .map((b, i) => ({ weekStart: b.start.slice(0, 10), inflow: num(cf.incomeWeekly[i]), outflow: num(cf.outflowWeekly[i]), cumulative: num(cf.cumulative[i]) }))
                .filter(r => isBusinessDate(r.weekStart));
        } catch (e) {
            this.logger.warn(`cash estimate not computed for ${projectId}: ${e instanceof Error ? e.message : String(e)}`);
            return null;
        }
    }

    /** The portal's outlook: the company's next 13 weeks (actual + planned in / out, balance). */
    async outlook(workspaceId: WorkspaceId, now: Date): Promise<CashOutlookWeekInfo[]> {
        const { projection } = await this.company(workspaceId, { today: bangkokToday(now), weeks: CASH_FLOW_DEFAULT_WEEKS, pastWeeks: 0 });
        return projection.weeks.map(w => ({
            weekStart: w.weekStart,
            inflow: Math.round((w.actualIn + w.plannedIn) * 100) / 100,
            outflow: Math.round((w.actualOut + w.plannedOut) * 100) / 100,
            balance: w.balance,
        }));
    }

    /** `job-cost.cash`: every workspace with job-cost active. */
    async sweep(ctx: SweepContext): Promise<void> {
        if (!this.flags.platformEnabled(MODULE)) return;
        for (const ws of await this.directory.search('', WORKSPACE_LIMIT)) {
            try {
                if (!(await this.flags.isEnabled(ws.id, MODULE))) continue;
                await this.sweepWorkspace(ws.id, ws.name, ctx.today);
            } catch (e) {
                this.logger.error(`${CASH_SWEEP} ${ws.id}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }

    /**
     * Project alerts (`negative_cash` opened / updated / resolved) and, when the company balance falls below its minimum
     * within 13 weeks, `cash.negative_forecast` to the members with `cost.read` (once a day: sweep_marks).
     */
    async sweepWorkspace(workspaceId: WorkspaceId, companyName: string, today: string): Promise<void> {
        const w: CashWindow = { today, weeks: CASH_FLOW_DEFAULT_WEEKS, pastWeeks: 0 };
        const { end } = windowRange(w);
        const live = await this.catalog.list(workspaceId, { archived: false });
        const planned = await this.planned(workspaceId, 'all', today, end);
        const events = await this.events.list(workspaceId, { to: end });
        const wanted = new Map<ProjectId, { level: JobCostAlertLevel; value: number }>();
        const critical = addDays(weekStartOf(today), 7 * CRITICAL_WEEKS);
        for (const p of live) {
            const projectId = asProjectId(p.id);
            const actual = CashFlowEngine.actual(events.filter(e => e.projectId === projectId));
            const projection = this.projectProjection(planned.filter(i => i.projectId === projectId), actual, w);
            if (projection.firstBelowMin === null) continue;
            wanted.set(projectId, {
                level: compareDates(projection.firstBelowMin, critical) < 0 ? 'critical' : 'warning',
                value: projection.lowestBalance ?? 0,
            });
        }
        await this.saveAlerts(workspaceId, live.map(p => asProjectId(p.id)), wanted);

        const { projection } = await this.company(workspaceId, w);
        if (projection.firstBelowMin === null) return;
        if (!(await this.marks.markOnce(CASH_SWEEP, workspaceId, today))) return;
        const toUserIds = (await this.directory.members(workspaceId)).filter(m => can(m.role, 'cost.read')).map(m => m.userId);
        if (toUserIds.length === 0) return;
        await this.notifier.notify({
            template: 'cash.negative_forecast', toUserIds,
            payload: { projectName: companyName, date: projection.firstBelowMin, amount: projection.lowestBalance ?? 0, href: '/finance/cashflow' },
        });
    }

    /** Upserts the wanted `negative_cash` alerts of the projects, resolves the others (project locks, one transaction each). */
    private async saveAlerts(
        workspaceId: WorkspaceId, projectIds: readonly ProjectId[], wanted: ReadonlyMap<ProjectId, { level: JobCostAlertLevel; value: number }>,
    ): Promise<void> {
        const open = (await this.repo.openAlerts(workspaceId, projectIds)).filter(a => a.kind === NEGATIVE_CASH);
        const touched = new Set<ProjectId>([...wanted.keys(), ...open.map(a => a.projectId)]);
        for (const projectId of touched) {
            await transact(this.uow, async () => {
                await this.repo.lockProject(workspaceId, projectId);
                const now = this.clock.now();
                const existing = (await this.repo.openAlerts(workspaceId, [projectId])).find(a => a.kind === NEGATIVE_CASH);
                const want = wanted.get(projectId);
                if (want === undefined) {
                    if (existing !== undefined) await this.repo.updateAlerts([{ ...existing, resolvedAt: now }]);
                } else if (existing === undefined) {
                    const row: AlertRecord = {
                        id: this.ids.newId(), workspaceId, projectId, costCodeId: null, scopeKey: PROJECT_SCOPE, kind: NEGATIVE_CASH,
                        level: want.level, value: want.value, threshold: 0, firstSeenAt: now, lastSeenAt: now, resolvedAt: null, notifiedAt: now,
                    };
                    await this.repo.insertAlerts([row]);
                } else {
                    await this.repo.updateAlerts([{ ...existing, level: want.level, value: want.value, threshold: 0, lastSeenAt: now }]);
                }
                return ok(undefined);
            });
        }
    }
}
