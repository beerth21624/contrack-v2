import type { SiteIssueStatus } from '@contrack/contract';
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { sdIssues, sdManpower, sdPhotos, sdReports, sdWorkItems } from '../../../../shared/infrastructure/database/schema-site';
import {
    SiteDiaryRepository, type SiteIssueRecord, type SiteManpowerRecord, type SitePhotoRecord, type SiteReportCounts, type SiteReportRecord,
    type SiteWorkItemRecord, type SubmittedWorkItem,
} from '../../application/ports/site-diary.repository';

type ReportRow = typeof sdReports.$inferSelect;
type IssueRow = typeof sdIssues.$inferSelect;

const toReport = (r: ReportRow): SiteReportRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    createdBy: asUserId(r.createdBy),
    submittedBy: r.submittedBy === null ? null : asUserId(r.submittedBy),
});

const toIssue = (r: IssueRow): SiteIssueRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    resolvedBy: r.resolvedBy === null ? null : asUserId(r.resolvedBy),
    createdBy: asUserId(r.createdBy),
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleSiteDiaryRepository extends SiteDiaryRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(reportId: string): Promise<SiteReportRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(sdReports).where(eq(sdReports.id, reportId)).limit(1);
        return row === undefined ? undefined : toReport(row);
    }

    async findByDate(workspaceId: WorkspaceId, projectId: ProjectId, reportDate: string): Promise<SiteReportRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(sdReports)
            .where(and(eq(sdReports.workspaceId, workspaceId), eq(sdReports.projectId, projectId), eq(sdReports.reportDate, reportDate)))
            .limit(1);
        return row === undefined ? undefined : toReport(row);
    }

    async lock(workspaceId: WorkspaceId, reportId: string): Promise<SiteReportRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(sdReports)
            .where(and(eq(sdReports.workspaceId, workspaceId), eq(sdReports.id, reportId))).limit(1).for('update');
        return row === undefined ? undefined : toReport(row);
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId, range: { from?: string; to?: string }): Promise<SiteReportRecord[]> {
        const rows = await this.ctx.executor.select().from(sdReports)
            .where(and(
                eq(sdReports.workspaceId, workspaceId), eq(sdReports.projectId, projectId),
                range.from === undefined ? undefined : gte(sdReports.reportDate, range.from),
                range.to === undefined ? undefined : lte(sdReports.reportDate, range.to),
            ))
            .orderBy(desc(sdReports.reportDate));
        return rows.map(toReport);
    }

    async listOnDate(workspaceId: WorkspaceId, projectIds: readonly ProjectId[], reportDate: string): Promise<SiteReportRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(sdReports)
            .where(and(eq(sdReports.workspaceId, workspaceId), inArray(sdReports.projectId, [...projectIds]), eq(sdReports.reportDate, reportDate)));
        return rows.map(toReport);
    }

    async insert(r: SiteReportRecord): Promise<void> {
        await this.ctx.executor.insert(sdReports).values({ ...r });
    }

    async save(r: SiteReportRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = r;
        await this.ctx.executor.update(sdReports).set(rest).where(and(eq(sdReports.workspaceId, workspaceId), eq(sdReports.id, id)));
    }

    async counts(workspaceId: WorkspaceId, reportIds: readonly string[]): Promise<Map<string, SiteReportCounts>> {
        const out = new Map<string, SiteReportCounts>();
        if (reportIds.length === 0) return out;
        const ids = [...reportIds];
        for (const id of ids) out.set(id, { headcount: 0, workItems: 0, photos: 0, openIssues: 0 });
        const heads = await this.ctx.executor
            .select({ id: sdManpower.reportId, n: sql<number>`coalesce(sum(${sdManpower.skilledCount} + ${sdManpower.labourerCount}), 0)::int` })
            .from(sdManpower).where(and(eq(sdManpower.workspaceId, workspaceId), inArray(sdManpower.reportId, ids))).groupBy(sdManpower.reportId);
        for (const r of heads) {
            const c = out.get(r.id);
            if (c !== undefined) c.headcount = r.n;
        }
        const items = await this.ctx.executor.select({ id: sdWorkItems.reportId, n: count() }).from(sdWorkItems)
            .where(and(eq(sdWorkItems.workspaceId, workspaceId), inArray(sdWorkItems.reportId, ids))).groupBy(sdWorkItems.reportId);
        for (const r of items) {
            const c = out.get(r.id);
            if (c !== undefined) c.workItems = r.n;
        }
        const photos = await this.ctx.executor.select({ id: sdPhotos.reportId, n: count() }).from(sdPhotos)
            .where(and(eq(sdPhotos.workspaceId, workspaceId), inArray(sdPhotos.reportId, ids))).groupBy(sdPhotos.reportId);
        for (const r of photos) {
            const c = out.get(r.id);
            if (c !== undefined) c.photos = r.n;
        }
        const issues = await this.ctx.executor.select({ id: sdIssues.reportId, n: count() }).from(sdIssues)
            .where(and(eq(sdIssues.workspaceId, workspaceId), inArray(sdIssues.reportId, ids), eq(sdIssues.status, 'open')))
            .groupBy(sdIssues.reportId);
        for (const r of issues) {
            const c = out.get(r.id);
            if (c !== undefined) c.openIssues = r.n;
        }
        return out;
    }

    async manpowerOf(workspaceId: WorkspaceId, reportId: string): Promise<SiteManpowerRecord[]> {
        const rows = await this.ctx.executor.select().from(sdManpower)
            .where(and(eq(sdManpower.workspaceId, workspaceId), eq(sdManpower.reportId, reportId))).orderBy(asc(sdManpower.sort));
        return rows.map(r => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) }));
    }

    async replaceManpower(workspaceId: WorkspaceId, reportId: string, rows: readonly SiteManpowerRecord[]): Promise<void> {
        await this.ctx.executor.delete(sdManpower).where(and(eq(sdManpower.workspaceId, workspaceId), eq(sdManpower.reportId, reportId)));
        if (rows.length > 0) await this.ctx.executor.insert(sdManpower).values(rows.map(r => ({ ...r })));
    }

    async workItemsOf(workspaceId: WorkspaceId, reportId: string): Promise<SiteWorkItemRecord[]> {
        const rows = await this.ctx.executor.select().from(sdWorkItems)
            .where(and(eq(sdWorkItems.workspaceId, workspaceId), eq(sdWorkItems.reportId, reportId))).orderBy(asc(sdWorkItems.sort));
        return rows.map(r => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) }));
    }

    async replaceWorkItems(workspaceId: WorkspaceId, reportId: string, rows: readonly SiteWorkItemRecord[]): Promise<void> {
        await this.ctx.executor.delete(sdWorkItems).where(and(eq(sdWorkItems.workspaceId, workspaceId), eq(sdWorkItems.reportId, reportId)));
        if (rows.length > 0) await this.ctx.executor.insert(sdWorkItems).values(rows.map(r => ({ ...r })));
    }

    async photosOf(workspaceId: WorkspaceId, reportId: string): Promise<SitePhotoRecord[]> {
        const rows = await this.ctx.executor.select().from(sdPhotos)
            .where(and(eq(sdPhotos.workspaceId, workspaceId), eq(sdPhotos.reportId, reportId))).orderBy(asc(sdPhotos.sort));
        return rows.map(r => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) }));
    }

    async replacePhotos(workspaceId: WorkspaceId, reportId: string, rows: readonly SitePhotoRecord[]): Promise<void> {
        await this.ctx.executor.delete(sdPhotos).where(and(eq(sdPhotos.workspaceId, workspaceId), eq(sdPhotos.reportId, reportId)));
        if (rows.length > 0) await this.ctx.executor.insert(sdPhotos).values(rows.map(r => ({ ...r })));
    }

    async submittedWorkItems(workspaceId: WorkspaceId, projectId: ProjectId, costCodeIds?: readonly string[]): Promise<SubmittedWorkItem[]> {
        if (costCodeIds?.length === 0) return [];
        const rows = await this.ctx.executor
            .select({
                projectId: sdReports.projectId, reportId: sdReports.id, reportDate: sdReports.reportDate,
                costCodeId: sdWorkItems.costCodeId, progressAfter: sdWorkItems.progressAfter,
            })
            .from(sdWorkItems)
            .innerJoin(sdReports, eq(sdReports.id, sdWorkItems.reportId))
            .where(and(
                eq(sdReports.workspaceId, workspaceId), eq(sdReports.projectId, projectId), eq(sdReports.status, 'submitted'),
                costCodeIds === undefined ? undefined : inArray(sdWorkItems.costCodeId, [...costCodeIds]),
            ));
        return rows.map(r => ({ ...r, projectId: asProjectId(r.projectId) }));
    }

    async issuesOf(workspaceId: WorkspaceId, reportId: string): Promise<SiteIssueRecord[]> {
        const rows = await this.ctx.executor.select().from(sdIssues)
            .where(and(eq(sdIssues.workspaceId, workspaceId), eq(sdIssues.reportId, reportId))).orderBy(asc(sdIssues.createdAt), asc(sdIssues.id));
        return rows.map(toIssue);
    }

    async issuesByProject(
        workspaceId: WorkspaceId, projectId: ProjectId, status?: SiteIssueStatus,
    ): Promise<(SiteIssueRecord & { reportDate: string })[]> {
        const rows = await this.ctx.executor.select({ issue: sdIssues, reportDate: sdReports.reportDate }).from(sdIssues)
            .innerJoin(sdReports, eq(sdReports.id, sdIssues.reportId))
            .where(and(
                eq(sdIssues.workspaceId, workspaceId), eq(sdIssues.projectId, projectId),
                status === undefined ? undefined : eq(sdIssues.status, status),
            ))
            .orderBy(desc(sdReports.reportDate), asc(sdIssues.createdAt), asc(sdIssues.id));
        return rows.map(r => ({ ...toIssue(r.issue), reportDate: r.reportDate }));
    }

    async findIssue(issueId: string): Promise<SiteIssueRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(sdIssues).where(eq(sdIssues.id, issueId)).limit(1);
        return row === undefined ? undefined : toIssue(row);
    }

    async lockIssue(workspaceId: WorkspaceId, issueId: string): Promise<SiteIssueRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(sdIssues)
            .where(and(eq(sdIssues.workspaceId, workspaceId), eq(sdIssues.id, issueId))).limit(1).for('update');
        return row === undefined ? undefined : toIssue(row);
    }

    async insertIssue(i: SiteIssueRecord): Promise<void> {
        await this.ctx.executor.insert(sdIssues).values({ ...i });
    }

    async saveIssue(i: SiteIssueRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = i;
        await this.ctx.executor.update(sdIssues).set(rest).where(and(eq(sdIssues.workspaceId, workspaceId), eq(sdIssues.id, id)));
    }

    async deleteIssues(workspaceId: WorkspaceId, issueIds: readonly string[]): Promise<void> {
        if (issueIds.length === 0) return;
        await this.ctx.executor.delete(sdIssues).where(and(eq(sdIssues.workspaceId, workspaceId), inArray(sdIssues.id, [...issueIds])));
    }

    deleteByProject(): Promise<void> {
        return Promise.resolve();
    }
}
