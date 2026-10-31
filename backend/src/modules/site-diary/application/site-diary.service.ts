// ─── Shared parts of the site diary use cases: transactions, DTOs, the effects of submit / reopen ───
import { Injectable } from '@nestjs/common';
import {
    SITE_DAY_HOURS, type SiteIssueDto, type SiteReportDto, type SiteReportSummaryDto,
} from '@contrack/contract';
import { round2 } from '@contrack/domain/money';
import { latestProgress } from '@contrack/domain/site-diary/progress';
import type { ProjectGrant } from '../../../shared/application/module-access';
import {
    type CostLedgerEntry, type CostLedgerEntryInput, CostCodeLookup, CostLedger, CrewDailyCost, FileService, ModuleFlags, UnitOfWork,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../shared/domain/ids';
import { can } from '../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../shared/domain/result';
import {
    SiteDiaryRepository, type SiteIssueRecord, type SiteManpowerRecord, type SiteReportCounts, type SiteReportRecord,
} from './ports/site-diary.repository';

export const MODULE = 'site-diary';
/** Cost ledger `source_type` of the labour estimated from a report. */
export const LEDGER_SOURCE = 'site_diary';

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

export const reportNotFound = (): DomainError => DomainError.notFound('SiteReport');

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

export function issueDto(i: SiteIssueRecord, reportDate: string): SiteIssueDto {
    return {
        id: i.id, reportId: i.reportId, projectId: i.projectId, reportDate, kind: i.kind, severity: i.severity, description: i.description,
        status: i.status, resolvedAt: iso(i.resolvedAt), resolvedBy: i.resolvedBy, createdAt: i.createdAt.toISOString(),
    };
}

export function summaryDto(r: SiteReportRecord, c: SiteReportCounts | undefined): SiteReportSummaryDto {
    return {
        id: r.id, projectId: r.projectId, reportDate: r.reportDate, status: r.status, weatherMorning: r.weatherMorning,
        weatherAfternoon: r.weatherAfternoon, rainHours: r.rainHours, summary: r.summary, headcount: c?.headcount ?? 0,
        workItemCount: c?.workItems ?? 0, photoCount: c?.photos ?? 0, openIssueCount: c?.openIssues ?? 0,
        submittedAt: iso(r.submittedAt), submittedBy: r.submittedBy, createdBy: r.createdBy, updatedAt: r.updatedAt.toISOString(),
    };
}

@Injectable()
export class SiteDiaryViews {
    constructor(
        private readonly repo: SiteDiaryRepository,
        private readonly costCodes: CostCodeLookup,
        private readonly files: FileService,
    ) {}

    /** The day's report (or a blank draft when nothing is saved for that day). */
    async detail(grant: ProjectGrant, projectId: ProjectId, reportDate: string, r: SiteReportRecord | undefined): Promise<SiteReportDto> {
        const ws = grant.workspaceId;
        const reports = can(grant.role, 'site.report') && !grant.archived;
        if (r === undefined) {
            return {
                id: null, projectId, reportDate, status: 'draft', weatherMorning: null, weatherAfternoon: null, rainHours: 0, summary: '',
                headcount: 0, workItemCount: 0, photoCount: 0, openIssueCount: 0, submittedAt: null, submittedBy: null, createdBy: null,
                updatedAt: null, manpower: [], workItems: [], photos: [], issues: [], canEdit: reports, canReopen: false,
            };
        }
        const [manpower, items, photos, issues] = await Promise.all([
            this.repo.manpowerOf(ws, r.id), this.repo.workItemsOf(ws, r.id), this.repo.photosOf(ws, r.id), this.repo.issuesOf(ws, r.id),
        ]);
        const codeIds = items.map(i => i.costCodeId);
        const codes = new Map((await this.costCodes.findMany(ws, projectId, codeIds)).map(c => [c.id, c]));
        const before = latestProgress((await this.repo.submittedWorkItems(ws, projectId, codeIds)).filter(i => i.reportDate < reportDate));
        const files = new Map((photos.length === 0 ? [] : await this.files.describe(photos.map(p => p.fileId))).map(f => [f.id, f]));
        return {
            ...summaryDto(r, {
                headcount: manpower.reduce((s, m) => s + m.skilledCount + m.labourerCount, 0), workItems: items.length, photos: photos.length,
                openIssues: issues.filter(i => i.status === 'open').length,
            }),
            manpower: manpower.map(m => ({
                id: m.id, crewId: m.crewId, supplierId: m.supplierId, crewName: m.crewName, trade: m.trade, skilledCount: m.skilledCount,
                labourerCount: m.labourerCount, hours: m.hours, costCodeId: m.costCodeId, note: m.note,
            })),
            workItems: items.map(i => {
                const c = codes.get(i.costCodeId);
                return {
                    id: i.id, costCodeId: i.costCodeId, code: c?.code ?? '', descTh: c?.descTh ?? '', descEn: c?.descEn ?? '', unit: c?.unit ?? '',
                    qtyDone: i.qtyDone, progressBefore: before.get(i.costCodeId)?.progress ?? 0, progressAfter: i.progressAfter, note: i.note,
                };
            }),
            photos: photos.map(p => ({
                id: p.id, fileId: p.fileId, file: files.get(p.fileId) ?? null, takenAt: iso(p.takenAt), caption: p.caption, costCodeId: p.costCodeId,
            })),
            issues: issues.map(i => issueDto(i, r.reportDate)),
            canEdit: reports && r.status === 'draft',
            canReopen: reports && r.status === 'submitted',
        };
    }
}

/** What submit / reopen change outside the report: cost codes' reported progress and the labour cost in the ledger. */
@Injectable()
export class SiteDiaryEffects {
    constructor(
        private readonly repo: SiteDiaryRepository,
        private readonly costCodes: CostCodeLookup,
        private readonly ledger: CostLedger,
        private readonly crews: CrewDailyCost,
        private readonly flags: ModuleFlags,
    ) {}

    /**
     * Sets `reported_progress` of the cost codes to the `progress_after` of the submitted report with the latest date
     * (0 when no submitted report names the code any more). Inside the caller's transaction, after the report is saved.
     */
    async applyProgress(workspaceId: WorkspaceId, projectId: ProjectId, costCodeIds: readonly string[]): Promise<void> {
        const ids = [...new Set(costCodeIds)];
        if (ids.length === 0) return;
        const latest = latestProgress(await this.repo.submittedWorkItems(workspaceId, projectId, ids));
        await this.costCodes.setReportedProgress(workspaceId, projectId, ids.map(id => ({ costCodeId: id, progress: latest.get(id)?.progress ?? 0 })));
    }

    /**
     * While `labour` is off: one `actual` labour row per manpower row with a crew and a cost code whose crew has a
     * known ฿/day — round2(dailyCost × hours / 8), dated the report date. Nothing while `labour` is on (timesheets
     * post the cost there).
     */
    async postLabour(r: SiteReportRecord, manpower: readonly SiteManpowerRecord[], by: UserId): Promise<Result<CostLedgerEntry[], DomainError>> {
        if (await this.flags.isEnabled(r.workspaceId, 'labour')) return ok([]);
        const rows = manpower.filter(m => m.crewId !== null && m.costCodeId !== null);
        if (rows.length === 0) return ok([]);
        const costs = await this.crews.dailyCostOf(r.workspaceId, rows.map(m => m.crewId ?? ''));
        const entries: CostLedgerEntryInput[] = [];
        for (const m of rows) {
            const daily = costs.get(m.crewId ?? '')?.dailyCost ?? null;
            if (daily === null || !(daily > 0) || !(m.hours > 0)) continue;
            const amount = round2((daily * m.hours) / SITE_DAY_HOURS);
            if (amount <= 0) continue;
            entries.push({
                projectId: r.projectId, costCodeId: m.costCodeId, entryDate: r.reportDate, kind: 'actual', category: 'labour', amount,
                sourceType: LEDGER_SOURCE, sourceId: r.id, sourceLineId: m.id, note: m.crewName, by,
            });
        }
        if (entries.length === 0) return ok([]);
        return this.ledger.post(r.workspaceId, entries);
    }

    /** Reverses every labour row the report posted (none when it posted nothing). */
    async reverseLabour(r: SiteReportRecord, by: UserId, date: string): Promise<Result<CostLedgerEntry[], DomainError>> {
        return this.ledger.reverseSource(r.workspaceId, LEDGER_SOURCE, r.id, { by, date, note: 'site report reopened' });
    }
}
