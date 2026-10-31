import type { SiteIssueKind, SiteIssueSeverity, SiteIssueStatus, SiteReportStatus, SiteWeather } from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** One `sd_reports` row. */
export interface SiteReportRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    reportDate: string;
    status: SiteReportStatus;
    weatherMorning: SiteWeather | null;
    weatherAfternoon: SiteWeather | null;
    rainHours: number;
    summary: string;
    createdBy: UserId;
    submittedBy: UserId | null;
    submittedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/** One `sd_manpower` row. */
export interface SiteManpowerRecord {
    id: string;
    reportId: string;
    workspaceId: WorkspaceId;
    crewId: string | null;
    supplierId: string | null;
    crewName: string;
    trade: string;
    skilledCount: number;
    labourerCount: number;
    hours: number;
    costCodeId: string | null;
    note: string;
    sort: number;
}

/** One `sd_work_items` row. */
export interface SiteWorkItemRecord {
    id: string;
    reportId: string;
    workspaceId: WorkspaceId;
    costCodeId: string;
    qtyDone: number | null;
    progressAfter: number;
    note: string;
    sort: number;
}

/** One `sd_photos` row. */
export interface SitePhotoRecord {
    id: string;
    reportId: string;
    workspaceId: WorkspaceId;
    fileId: string;
    takenAt: Date | null;
    caption: string;
    costCodeId: string | null;
    sort: number;
}

/** One `sd_issues` row. */
export interface SiteIssueRecord {
    id: string;
    reportId: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    kind: SiteIssueKind;
    severity: SiteIssueSeverity;
    description: string;
    status: SiteIssueStatus;
    resolvedAt: Date | null;
    resolvedBy: UserId | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** A work item of a submitted report with its date (progress, S-curve). */
export interface SubmittedWorkItem {
    projectId: ProjectId;
    reportId: string;
    reportDate: string;
    costCodeId: string;
    progressAfter: number;
}

/** Per-report counts for the list. */
export interface SiteReportCounts {
    headcount: number;
    workItems: number;
    photos: number;
    openIssues: number;
}

/** Tables `sd_*`. Every method filters by workspace except the by-id lookups (callers then check access). */
export abstract class SiteDiaryRepository {
    abstract find(reportId: string): Promise<SiteReportRecord | undefined>;
    abstract findByDate(workspaceId: WorkspaceId, projectId: ProjectId, reportDate: string): Promise<SiteReportRecord | undefined>;
    /** `select … for update` of the row. */
    abstract lock(workspaceId: WorkspaceId, reportId: string): Promise<SiteReportRecord | undefined>;
    /** Reports of a project with `from ≤ report_date ≤ to` (bounds optional), newest first. */
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId, range: { from?: string; to?: string }): Promise<SiteReportRecord[]>;
    /** Reports of many projects on one date (portal). */
    abstract listOnDate(workspaceId: WorkspaceId, projectIds: readonly ProjectId[], reportDate: string): Promise<SiteReportRecord[]>;
    /** A second (project, report_date) throws. */
    abstract insert(r: SiteReportRecord): Promise<void>;
    abstract save(r: SiteReportRecord): Promise<void>;
    abstract counts(workspaceId: WorkspaceId, reportIds: readonly string[]): Promise<Map<string, SiteReportCounts>>;

    /** `sort` order. */
    abstract manpowerOf(workspaceId: WorkspaceId, reportId: string): Promise<SiteManpowerRecord[]>;
    abstract replaceManpower(workspaceId: WorkspaceId, reportId: string, rows: readonly SiteManpowerRecord[]): Promise<void>;
    abstract workItemsOf(workspaceId: WorkspaceId, reportId: string): Promise<SiteWorkItemRecord[]>;
    abstract replaceWorkItems(workspaceId: WorkspaceId, reportId: string, rows: readonly SiteWorkItemRecord[]): Promise<void>;
    abstract photosOf(workspaceId: WorkspaceId, reportId: string): Promise<SitePhotoRecord[]>;
    abstract replacePhotos(workspaceId: WorkspaceId, reportId: string, rows: readonly SitePhotoRecord[]): Promise<void>;

    /** Work items of the submitted reports of a project (optionally only those of `costCodeIds`), any order. */
    abstract submittedWorkItems(workspaceId: WorkspaceId, projectId: ProjectId, costCodeIds?: readonly string[]): Promise<SubmittedWorkItem[]>;

    /** Issues of one report, `created_at` order. */
    abstract issuesOf(workspaceId: WorkspaceId, reportId: string): Promise<SiteIssueRecord[]>;
    /** Issues of a project across days (optionally one status), newest report first. */
    abstract issuesByProject(workspaceId: WorkspaceId, projectId: ProjectId, status?: SiteIssueStatus): Promise<(SiteIssueRecord & { reportDate: string })[]>;
    abstract findIssue(issueId: string): Promise<SiteIssueRecord | undefined>;
    abstract lockIssue(workspaceId: WorkspaceId, issueId: string): Promise<SiteIssueRecord | undefined>;
    abstract insertIssue(i: SiteIssueRecord): Promise<void>;
    abstract saveIssue(i: SiteIssueRecord): Promise<void>;
    abstract deleteIssues(workspaceId: WorkspaceId, issueIds: readonly string[]): Promise<void>;

    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
