import type { SiteIssueStatus } from '@contrack/contract';
import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import {
    SiteDiaryRepository, type SiteIssueRecord, type SiteManpowerRecord, type SitePhotoRecord, type SiteReportCounts, type SiteReportRecord,
    type SiteWorkItemRecord, type SubmittedWorkItem,
} from '../../application/ports/site-diary.repository';

const clone = <T>(v: T): T => structuredClone(v);
const bySort = <T extends { sort: number }>(a: T, b: T): number => a.sort - b.sort;

/** Memory adapter (tests / trying without a database); mimics unique `(project_id, report_date)` and `(report_id, cost_code_id)`. */
export class InMemorySiteDiaryRepository extends SiteDiaryRepository {
    private readonly reports = new Map<string, SiteReportRecord>();
    private readonly manpower = new Map<string, SiteManpowerRecord[]>();
    private readonly workItems = new Map<string, SiteWorkItemRecord[]>();
    private readonly photos = new Map<string, SitePhotoRecord[]>();
    private readonly issues = new Map<string, SiteIssueRecord>();

    find(reportId: string): Promise<SiteReportRecord | undefined> {
        const r = this.reports.get(reportId);
        return Promise.resolve(r === undefined ? undefined : clone(r));
    }

    findByDate(workspaceId: WorkspaceId, projectId: ProjectId, reportDate: string): Promise<SiteReportRecord | undefined> {
        const r = [...this.reports.values()].find(x => x.workspaceId === workspaceId && x.projectId === projectId && x.reportDate === reportDate);
        return Promise.resolve(r === undefined ? undefined : clone(r));
    }

    lock(workspaceId: WorkspaceId, reportId: string): Promise<SiteReportRecord | undefined> {
        const r = this.reports.get(reportId);
        return Promise.resolve(r?.workspaceId === workspaceId ? clone(r) : undefined);
    }

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId, range: { from?: string; to?: string }): Promise<SiteReportRecord[]> {
        return Promise.resolve([...this.reports.values()]
            .filter(r => r.workspaceId === workspaceId && r.projectId === projectId
                && (range.from === undefined || r.reportDate >= range.from) && (range.to === undefined || r.reportDate <= range.to))
            .sort((a, b) => (a.reportDate < b.reportDate ? 1 : a.reportDate > b.reportDate ? -1 : 0))
            .map(clone));
    }

    listOnDate(workspaceId: WorkspaceId, projectIds: readonly ProjectId[], reportDate: string): Promise<SiteReportRecord[]> {
        const ids = new Set<string>(projectIds);
        return Promise.resolve([...this.reports.values()]
            .filter(r => r.workspaceId === workspaceId && ids.has(r.projectId) && r.reportDate === reportDate)
            .map(clone));
    }

    insert(r: SiteReportRecord): Promise<void> {
        const clash = [...this.reports.values()].some(o => o.id === r.id || (o.projectId === r.projectId && o.reportDate === r.reportDate));
        if (clash) return Promise.reject(new Error(`duplicate site report ${r.projectId} ${r.reportDate}`));
        this.reports.set(r.id, clone(r));
        return Promise.resolve();
    }

    save(r: SiteReportRecord): Promise<void> {
        if (this.reports.get(r.id)?.workspaceId === r.workspaceId) this.reports.set(r.id, clone(r));
        return Promise.resolve();
    }

    counts(workspaceId: WorkspaceId, reportIds: readonly string[]): Promise<Map<string, SiteReportCounts>> {
        const out = new Map<string, SiteReportCounts>();
        for (const id of reportIds) {
            if (this.reports.get(id)?.workspaceId !== workspaceId) continue;
            out.set(id, {
                headcount: (this.manpower.get(id) ?? []).reduce((s, m) => s + m.skilledCount + m.labourerCount, 0),
                workItems: (this.workItems.get(id) ?? []).length,
                photos: (this.photos.get(id) ?? []).length,
                openIssues: [...this.issues.values()].filter(i => i.reportId === id && i.status === 'open').length,
            });
        }
        return Promise.resolve(out);
    }

    manpowerOf(workspaceId: WorkspaceId, reportId: string): Promise<SiteManpowerRecord[]> {
        return Promise.resolve((this.manpower.get(reportId) ?? []).filter(r => r.workspaceId === workspaceId).sort(bySort).map(clone));
    }

    replaceManpower(workspaceId: WorkspaceId, reportId: string, rows: readonly SiteManpowerRecord[]): Promise<void> {
        if (this.reports.get(reportId)?.workspaceId === workspaceId) this.manpower.set(reportId, rows.map(clone));
        return Promise.resolve();
    }

    workItemsOf(workspaceId: WorkspaceId, reportId: string): Promise<SiteWorkItemRecord[]> {
        return Promise.resolve((this.workItems.get(reportId) ?? []).filter(r => r.workspaceId === workspaceId).sort(bySort).map(clone));
    }

    replaceWorkItems(workspaceId: WorkspaceId, reportId: string, rows: readonly SiteWorkItemRecord[]): Promise<void> {
        if (new Set(rows.map(r => r.costCodeId)).size !== rows.length) {
            return Promise.reject(new Error(`duplicate cost code in site report ${reportId}`));
        }
        if (this.reports.get(reportId)?.workspaceId === workspaceId) this.workItems.set(reportId, rows.map(clone));
        return Promise.resolve();
    }

    photosOf(workspaceId: WorkspaceId, reportId: string): Promise<SitePhotoRecord[]> {
        return Promise.resolve((this.photos.get(reportId) ?? []).filter(r => r.workspaceId === workspaceId).sort(bySort).map(clone));
    }

    replacePhotos(workspaceId: WorkspaceId, reportId: string, rows: readonly SitePhotoRecord[]): Promise<void> {
        if (this.reports.get(reportId)?.workspaceId === workspaceId) this.photos.set(reportId, rows.map(clone));
        return Promise.resolve();
    }

    submittedWorkItems(workspaceId: WorkspaceId, projectId: ProjectId, costCodeIds?: readonly string[]): Promise<SubmittedWorkItem[]> {
        const wanted = costCodeIds === undefined ? undefined : new Set(costCodeIds);
        const out: SubmittedWorkItem[] = [];
        for (const r of this.reports.values()) {
            if (r.workspaceId !== workspaceId || r.projectId !== projectId || r.status !== 'submitted') continue;
            for (const i of this.workItems.get(r.id) ?? []) {
                if (wanted !== undefined && !wanted.has(i.costCodeId)) continue;
                out.push({ projectId: r.projectId, reportId: r.id, reportDate: r.reportDate, costCodeId: i.costCodeId, progressAfter: i.progressAfter });
            }
        }
        return Promise.resolve(out);
    }

    issuesOf(workspaceId: WorkspaceId, reportId: string): Promise<SiteIssueRecord[]> {
        return Promise.resolve([...this.issues.values()]
            .filter(i => i.workspaceId === workspaceId && i.reportId === reportId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(clone));
    }

    issuesByProject(workspaceId: WorkspaceId, projectId: ProjectId, status?: SiteIssueStatus): Promise<(SiteIssueRecord & { reportDate: string })[]> {
        return Promise.resolve([...this.issues.values()]
            .filter(i => i.workspaceId === workspaceId && i.projectId === projectId && (status === undefined || i.status === status))
            .map(i => ({ ...clone(i), reportDate: this.reports.get(i.reportId)?.reportDate ?? '' }))
            .sort((a, b) => (a.reportDate < b.reportDate ? 1 : a.reportDate > b.reportDate ? -1 : a.createdAt.getTime() - b.createdAt.getTime())));
    }

    findIssue(issueId: string): Promise<SiteIssueRecord | undefined> {
        const i = this.issues.get(issueId);
        return Promise.resolve(i === undefined ? undefined : clone(i));
    }

    lockIssue(workspaceId: WorkspaceId, issueId: string): Promise<SiteIssueRecord | undefined> {
        const i = this.issues.get(issueId);
        return Promise.resolve(i?.workspaceId === workspaceId ? clone(i) : undefined);
    }

    insertIssue(i: SiteIssueRecord): Promise<void> {
        if (this.issues.has(i.id)) return Promise.reject(new Error(`duplicate site issue ${i.id}`));
        this.issues.set(i.id, clone(i));
        return Promise.resolve();
    }

    saveIssue(i: SiteIssueRecord): Promise<void> {
        if (this.issues.get(i.id)?.workspaceId === i.workspaceId) this.issues.set(i.id, clone(i));
        return Promise.resolve();
    }

    deleteIssues(workspaceId: WorkspaceId, issueIds: readonly string[]): Promise<void> {
        for (const id of issueIds) if (this.issues.get(id)?.workspaceId === workspaceId) this.issues.delete(id);
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const r of [...this.reports.values()]) {
            if (r.workspaceId !== workspaceId || r.projectId !== projectId) continue;
            this.reports.delete(r.id);
            this.manpower.delete(r.id);
            this.workItems.delete(r.id);
            this.photos.delete(r.id);
        }
        for (const i of [...this.issues.values()]) if (i.workspaceId === workspaceId && i.projectId === projectId) this.issues.delete(i.id);
        return Promise.resolve();
    }
}
