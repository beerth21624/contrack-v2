// ─── Site diary use cases (docs/erp/04-implementation-plan.md WP-42, docs/erp/02-domain-model.md §8.1) ───
// Read `site.read`; write the day's report, submit, reopen and change issues `site.report`. Report dates are Bangkok
// business dates and never after today (422 `future_date`).
import { Injectable, Logger } from '@nestjs/common';
import type {
    PatchSiteIssueRequest, PutSiteReportRequest, SiteIssueDto, SiteIssueListDto, SiteIssueListQuery, SiteProgressDto, SiteReportDto,
    SiteReportListDto, SiteReportListQuery,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { roundQty } from '@contrack/domain/money';
import { computeProject } from '@contrack/domain/project';
import { actualProgressSeries } from '@contrack/domain/site-diary/progress';
import { type ProjectGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    AuditLog, Clock, CostCodeLookup, CrewDailyCost, type CrewDailyCostInfo, FileService, IdGenerator, ProjectReader, SupplierLookup, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type ProjectId, type UserId, isUuid } from '../../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../../shared/domain/result';
import { requireNotFuture, requireStatus, requireTransition } from '../../domain/site-diary-state';
import {
    SiteDiaryRepository, type SiteIssueRecord, type SiteManpowerRecord, type SitePhotoRecord, type SiteReportRecord, type SiteWorkItemRecord,
} from '../ports/site-diary.repository';
import { MODULE, SiteDiaryEffects, SiteDiaryViews, issueDto, reportNotFound, summaryDto, transact } from '../site-diary.service';

const READ = ['site.read' as const];
const REPORT = ['site.report' as const];

const lower = (id: string | null | undefined): string | null => (id === undefined || id === null ? null : id.toLowerCase());

/** Authorizes on the project, then refuses a date after today (Bangkok). */
async function projectDay(
    access: ModuleAccess, clock: Clock, userId: UserId, projectId: ProjectId, reportDate: string, write: boolean,
): Promise<Result<ProjectGrant, DomainError>> {
    const grant = await access.toProject(userId, projectId, MODULE, { permissions: write ? REPORT : READ, write });
    if (!grant.ok) return grant;
    const future = requireNotFuture(reportDate, bangkokToday(clock.now()));
    return future.ok ? grant : future;
}

// ── reads ──

/** GET /projects/:projectId/site-diary?from=&to= — `site.read`, newest first. */
@Injectable()
export class ListSiteReportsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: SiteDiaryRepository) {}

    async execute(userId: UserId, projectId: ProjectId, query: SiteReportListQuery): Promise<Result<SiteReportListDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: READ, write: false });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const list = await this.repo.listByProject(ws, projectId, { from: query.from, to: query.to });
        const counts = await this.repo.counts(ws, list.map(r => r.id));
        return ok({ items: list.map(r => summaryDto(r, counts.get(r.id))) });
    }
}

/** GET /projects/:projectId/site-diary/:date — `site.read`; a blank draft (id null) when nothing is saved yet. */
@Injectable()
export class GetSiteReportUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: SiteDiaryRepository,
        private readonly views: SiteDiaryViews,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, projectId: ProjectId, reportDate: string): Promise<Result<SiteReportDto, DomainError>> {
        const grant = await projectDay(this.access, this.clock, userId, projectId, reportDate, false);
        if (!grant.ok) return grant;
        const r = await this.repo.findByDate(grant.value.workspaceId, projectId, reportDate);
        return ok(await this.views.detail(grant.value, projectId, reportDate, r));
    }
}

/** GET /projects/:projectId/site-diary/progress — `site.read`: actual (budget-weighted) and planned S-curves. */
@Injectable()
export class GetSiteProgressUseCase {
    private readonly logger = new Logger(GetSiteProgressUseCase.name);

    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: SiteDiaryRepository,
        private readonly costCodes: CostCodeLookup,
        private readonly projects: ProjectReader,
    ) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<SiteProgressDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: READ, write: false });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const weights = (await this.costCodes.listByProject(ws, projectId))
            .filter(c => c.status !== 'omitted')
            .map(c => ({ costCodeId: c.id, budget: c.budgetTotal }));
        const actual = actualProgressSeries(await this.repo.submittedWorkItems(ws, projectId), weights);
        return ok({ actual, planned: await this.planned(projectId) });
    }

    /** computeProject(project).planning.schedule: planCumulative paired with the week buckets; null when it cannot be computed. */
    private async planned(projectId: ProjectId): Promise<SiteProgressDto['planned']> {
        try {
            const read = await this.projects.read(projectId);
            if (read === undefined) return null;
            const schedule = computeProject(read.project).planning.schedule;
            if (schedule.buckets.length === 0) return null;
            return schedule.buckets.map((b, i) => {
                const pct = schedule.planCumulative[i] ?? 0;
                return { weekStart: b.start, pct: Number.isFinite(pct) ? Math.round(pct * 1e6) / 1e6 : 0 };
            });
        } catch (e) {
            this.logger.warn(`planned progress not computed for ${projectId}: ${e instanceof Error ? e.message : String(e)}`);
            return null;
        }
    }
}

/** GET /projects/:projectId/site-issues?status= — `site.read`, issues across days (newest report first). */
@Injectable()
export class ListSiteIssuesUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: SiteDiaryRepository) {}

    async execute(userId: UserId, projectId: ProjectId, query: SiteIssueListQuery): Promise<Result<SiteIssueListDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: READ, write: false });
        if (!grant.ok) return grant;
        const list = await this.repo.issuesByProject(grant.value.workspaceId, projectId, query.status);
        return ok({ items: list.map(i => issueDto(i, i.reportDate)) });
    }
}

// ── writes ──

/**
 * PUT /projects/:projectId/site-diary/:date — `site.report`: creates the day's draft or replaces its content (draft
 * only; a submitted report → 409 `invalid_transition`, reopen it first). Cost codes must be of the project, crews of
 * the workspace's workforce, suppliers of the vendor master (else 404); photos must be uploaded by the caller.
 */
@Injectable()
export class PutSiteReportUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: SiteDiaryRepository,
        private readonly views: SiteDiaryViews,
        private readonly costCodes: CostCodeLookup,
        private readonly crews: CrewDailyCost,
        private readonly suppliers: SupplierLookup,
        private readonly files: FileService,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; reportDate: string; body: PutSiteReportRequest }): Promise<Result<SiteReportDto, DomainError>> {
        const { userId, projectId, reportDate, body } = input;
        const grant = await projectDay(this.access, this.clock, userId, projectId, reportDate, true);
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;

        // ── check the references before writing ──
        const workCodes = (body.workItems ?? []).map(w => w.costCodeId.toLowerCase());
        if (new Set(workCodes).size !== workCodes.length) {
            return err(DomainError.unprocessable('One work item per cost code', { reason: 'duplicate_cost_code' }));
        }
        const codeIds = [...new Set([
            ...workCodes,
            ...(body.manpower ?? []).flatMap(m => (m.costCodeId == null ? [] : [m.costCodeId.toLowerCase()])),
            ...(body.photos ?? []).flatMap(p => (p.costCodeId == null ? [] : [p.costCodeId.toLowerCase()])),
        ])];
        if (codeIds.length > 0) {
            const found = new Set((await this.costCodes.findMany(ws, projectId, codeIds)).map(c => c.id));
            if (codeIds.some(id => !found.has(id))) return err(DomainError.notFound('CostCode'));
        }
        const crewIds = [...new Set((body.manpower ?? []).flatMap(m => (m.crewId == null ? [] : [m.crewId.toLowerCase()])))];
        const crews = crewIds.length === 0 ? new Map<string, CrewDailyCostInfo>() : await this.crews.dailyCostOf(ws, crewIds);
        if (crewIds.some(id => !crews.has(id))) return err(DomainError.notFound('Crew'));
        const supplierIds = [...new Set((body.manpower ?? []).flatMap(m => (m.supplierId == null ? [] : [m.supplierId.toLowerCase()])))];
        if (supplierIds.length > 0) {
            const found = new Set((await this.suppliers.findMany(ws, supplierIds)).map(s => s.id));
            if (supplierIds.some(id => !found.has(id))) return err(DomainError.notFound('Supplier'));
        }

        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const now = this.clock.now();
            const existing = await this.repo.findByDate(ws, projectId, reportDate);
            let r: SiteReportRecord | undefined = existing === undefined ? undefined : await this.repo.lock(ws, existing.id);
            if (r === undefined) {
                r = {
                    id: this.ids.newId(), workspaceId: ws, projectId, reportDate, status: 'draft', weatherMorning: null, weatherAfternoon: null,
                    rainHours: 0, summary: '', createdBy: userId, submittedBy: null, submittedAt: null, createdAt: now, updatedAt: now,
                };
                await this.repo.insert(r);
                await this.audit.record({
                    workspaceId: ws, projectId, actor: userId, entityType: 'site_report', entityId: r.id, action: 'create', data: { reportDate },
                });
            }
            const draft = requireStatus(r.status, ['draft']);
            if (!draft.ok) return draft;
            const report: SiteReportRecord = r;

            // Photos: only files not already on the report must be the caller's uploads.
            if (body.photos !== undefined) {
                const known = new Set((await this.repo.photosOf(ws, report.id)).map(p => p.fileId));
                const fresh = [...new Set(body.photos.map(p => p.fileId.toLowerCase()))].filter(id => !known.has(id));
                if (fresh.length > 0) {
                    const mine = await this.files.assertUploadedBy(fresh, userId);
                    if (!mine.ok) return mine;
                }
            }

            // Issues: an `id` must be one of this report's issues.
            if (body.issues !== undefined) {
                const current = new Map((await this.repo.issuesOf(ws, report.id)).map(i => [i.id, i]));
                const kept = new Set<string>();
                const inserts: SiteIssueRecord[] = [];
                const updates: SiteIssueRecord[] = [];
                for (const i of body.issues) {
                    const id = lower(i.id);
                    if (id !== null) {
                        const cur = current.get(id);
                        if (cur === undefined || kept.has(id)) return err(DomainError.notFound('SiteIssue'));
                        kept.add(id);
                        updates.push({ ...cur, kind: i.kind, severity: i.severity ?? cur.severity, description: i.description, updatedAt: now });
                    } else {
                        inserts.push({
                            id: this.ids.newId(), reportId: report.id, workspaceId: ws, projectId, kind: i.kind, severity: i.severity ?? 'medium',
                            description: i.description, status: 'open', resolvedAt: null, resolvedBy: null, createdBy: userId, createdAt: now,
                            updatedAt: now,
                        });
                    }
                }
                await this.repo.deleteIssues(ws, [...current.keys()].filter(id => !kept.has(id)));
                for (const u of updates) await this.repo.saveIssue(u);
                for (const n of inserts) await this.repo.insertIssue(n);
            }

            if (body.manpower !== undefined) {
                const rows: SiteManpowerRecord[] = body.manpower.map((m, k) => {
                    const crewId = lower(m.crewId);
                    const crew = crewId === null ? undefined : crews.get(crewId);
                    const name = m.crewName ?? '';
                    const trade = m.trade ?? '';
                    return {
                        id: this.ids.newId(), reportId: report.id, workspaceId: ws, crewId, supplierId: lower(m.supplierId),
                        crewName: name !== '' ? name : (crew?.name ?? ''), trade: trade !== '' ? trade : (crew?.trade ?? ''),
                        skilledCount: m.skilledCount ?? 0, labourerCount: m.labourerCount ?? 0, hours: Math.round((m.hours ?? 8) * 10) / 10,
                        costCodeId: lower(m.costCodeId), note: m.note ?? '', sort: k + 1,
                    };
                });
                await this.repo.replaceManpower(ws, report.id, rows);
            }
            if (body.workItems !== undefined) {
                const rows: SiteWorkItemRecord[] = body.workItems.map((w, k) => ({
                    id: this.ids.newId(), reportId: report.id, workspaceId: ws, costCodeId: w.costCodeId.toLowerCase(),
                    qtyDone: w.qtyDone == null ? null : roundQty(w.qtyDone), progressAfter: Math.round(w.progressAfter * 1e6) / 1e6,
                    note: w.note ?? '', sort: k + 1,
                }));
                await this.repo.replaceWorkItems(ws, report.id, rows);
            }
            if (body.photos !== undefined) {
                const rows: SitePhotoRecord[] = body.photos.map((p, k) => ({
                    id: this.ids.newId(), reportId: report.id, workspaceId: ws, fileId: p.fileId.toLowerCase(),
                    takenAt: p.takenAt == null ? null : new Date(p.takenAt), caption: p.caption ?? '', costCodeId: lower(p.costCodeId), sort: k + 1,
                }));
                await this.repo.replacePhotos(ws, report.id, rows);
            }

            await this.repo.save({
                ...report,
                weatherMorning: body.weatherMorning === undefined ? report.weatherMorning : body.weatherMorning,
                weatherAfternoon: body.weatherAfternoon === undefined ? report.weatherAfternoon : body.weatherAfternoon,
                rainHours: body.rainHours === undefined ? report.rainHours : Math.round(body.rainHours * 10) / 10,
                summary: body.summary ?? report.summary,
                updatedAt: now,
            });
            return okVoid();
        });
        if (!saved.ok) return saved;
        const r = await this.repo.findByDate(ws, projectId, reportDate);
        return ok(await this.views.detail(grant.value, projectId, reportDate, r));
    }
}

/**
 * POST /projects/:projectId/site-diary/:date/submit — `site.report`: draft → submitted; the cost codes' reported
 * progress follows the latest submitted report, and while `labour` is off the crews' labour cost is posted.
 */
@Injectable()
export class SubmitSiteReportUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: SiteDiaryRepository,
        private readonly views: SiteDiaryViews,
        private readonly effects: SiteDiaryEffects,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; reportDate: string }): Promise<Result<SiteReportDto, DomainError>> {
        const { userId, projectId, reportDate } = input;
        const grant = await projectDay(this.access, this.clock, userId, projectId, reportDate, true);
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const found = await this.repo.findByDate(ws, projectId, reportDate);
        if (found === undefined) return err(reportNotFound());

        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.repo.lock(ws, found.id);
            if (r === undefined) return err(reportNotFound());
            const allowed = requireTransition(r.status, 'submitted');
            if (!allowed.ok) return allowed;
            const now = this.clock.now();
            const manpower = await this.repo.manpowerOf(ws, r.id);
            const posted = await this.effects.postLabour(r, manpower, userId);
            if (!posted.ok) return posted;
            await this.repo.save({ ...r, status: 'submitted', submittedBy: userId, submittedAt: now, updatedAt: now });
            const items = await this.repo.workItemsOf(ws, r.id);
            await this.effects.applyProgress(ws, projectId, items.map(i => i.costCodeId));
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'site_report', entityId: r.id, action: 'submit',
                data: {
                    status: [r.status, 'submitted'], reportDate, workItems: items.length,
                    labourCost: Math.round(posted.value.reduce((s, e) => s + e.amount, 0) * 100) / 100,
                },
            });
            return okVoid();
        });
        if (!done.ok) return done;
        return ok(await this.views.detail(grant.value, projectId, reportDate, await this.repo.find(found.id)));
    }
}

/**
 * POST /projects/:projectId/site-diary/:date/reopen — `site.report`: submitted → draft; the labour cost it posted is
 * reversed and the cost codes' reported progress falls back to the other submitted reports.
 */
@Injectable()
export class ReopenSiteReportUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: SiteDiaryRepository,
        private readonly views: SiteDiaryViews,
        private readonly effects: SiteDiaryEffects,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; reportDate: string }): Promise<Result<SiteReportDto, DomainError>> {
        const { userId, projectId, reportDate } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: REPORT, write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const found = await this.repo.findByDate(ws, projectId, reportDate);
        if (found === undefined) return err(reportNotFound());

        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.repo.lock(ws, found.id);
            if (r === undefined) return err(reportNotFound());
            const allowed = requireTransition(r.status, 'draft');
            if (!allowed.ok) return allowed;
            const now = this.clock.now();
            const reversed = await this.effects.reverseLabour(r, userId, bangkokToday(now));
            if (!reversed.ok) return reversed;
            await this.repo.save({ ...r, status: 'draft', submittedBy: null, submittedAt: null, updatedAt: now });
            const items = await this.repo.workItemsOf(ws, r.id);
            await this.effects.applyProgress(ws, projectId, items.map(i => i.costCodeId));
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'site_report', entityId: r.id, action: 'reopen',
                data: { status: [r.status, 'draft'], reportDate, reversedEntries: reversed.value.length },
            });
            return okVoid();
        });
        if (!done.ok) return done;
        return ok(await this.views.detail(grant.value, projectId, reportDate, await this.repo.find(found.id)));
    }
}

/** PATCH /site-issues/:issueId — `site.report`: resolve / reopen an issue or fix its text (any report status). */
@Injectable()
export class PatchSiteIssueUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: SiteDiaryRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; issueId: string; body: PatchSiteIssueRequest }): Promise<Result<SiteIssueDto, DomainError>> {
        const { userId, body } = input;
        if (!isUuid(input.issueId)) return err(DomainError.notFound('SiteIssue'));
        const issue = await this.repo.findIssue(input.issueId.toLowerCase());
        if (issue === undefined) return err(DomainError.notFound('SiteIssue'));
        const grant = await this.access.toProject(userId, issue.projectId, MODULE, { permissions: REPORT, write: true });
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('SiteIssue')) : grant;
        const ws = grant.value.workspaceId;
        if (ws !== issue.workspaceId) return err(DomainError.notFound('SiteIssue'));

        const saved = await transact(this.uow, async (): Promise<Result<SiteIssueRecord, DomainError>> => {
            const cur = await this.repo.lockIssue(ws, issue.id);
            if (cur === undefined) return err(DomainError.notFound('SiteIssue'));
            const now = this.clock.now();
            const status = body.status ?? cur.status;
            const next: SiteIssueRecord = {
                ...cur, status, severity: body.severity ?? cur.severity, description: body.description ?? cur.description, updatedAt: now,
                ...(status === cur.status ? {} : status === 'resolved' ? { resolvedAt: now, resolvedBy: userId } : { resolvedAt: null, resolvedBy: null }),
            };
            await this.repo.saveIssue(next);
            if (status !== cur.status) {
                await this.audit.record({
                    workspaceId: ws, projectId: cur.projectId, actor: userId, entityType: 'site_issue', entityId: cur.id, action: 'status_change',
                    data: { status: [cur.status, status] },
                });
            }
            return ok(next);
        });
        if (!saved.ok) return saved;
        const report = await this.repo.find(saved.value.reportId);
        return ok(issueDto(saved.value, report?.reportDate ?? ''));
    }
}
