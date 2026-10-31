// ─── The editable copy of a day's report (local state of the form) and its conversion to / from the API ───
import type {
    PutSiteReportRequest, SiteIssueKind, SiteIssueSeverity, SiteIssueStatus, SiteReportDto, SiteWeather,
} from '@/shared/contract';

let counter = 0;
export const nextKey = (): string => `k${String(++counter)}`;

export interface ManpowerRow {
    key: string;
    crewId: string | null;
    supplierId: string | null;
    crewName: string;
    trade: string;
    skilledCount: number;
    labourerCount: number;
    hours: number;
    costCodeId: string | null;
    note: string;
}

export interface WorkRow {
    key: string;
    costCodeId: string;
    code: string;
    descTh: string;
    descEn: string;
    unit: string;
    qtyDone: number | null;
    /** Cumulative progress before the day (fraction). */
    progressBefore: number;
    /** Cumulative progress at the end of the day (fraction). */
    progressAfter: number;
    note: string;
}

export interface PhotoRow {
    key: string;
    fileId: string;
    url: string;
    name: string;
    takenAt: string | null;
    caption: string;
    costCodeId: string | null;
}

export interface IssueRow {
    key: string;
    id: string | undefined;
    kind: SiteIssueKind;
    severity: SiteIssueSeverity;
    description: string;
    status: SiteIssueStatus;
}

export interface DiaryForm {
    weatherMorning: SiteWeather | null;
    weatherAfternoon: SiteWeather | null;
    rainHours: number;
    summary: string;
    manpower: ManpowerRow[];
    workItems: WorkRow[];
    photos: PhotoRow[];
    issues: IssueRow[];
}

export function formFromReport(r: SiteReportDto): DiaryForm {
    return {
        weatherMorning: r.weatherMorning,
        weatherAfternoon: r.weatherAfternoon,
        rainHours: r.rainHours,
        summary: r.summary,
        manpower: r.manpower.map(m => ({
            key: m.id, crewId: m.crewId, supplierId: m.supplierId, crewName: m.crewName, trade: m.trade,
            skilledCount: m.skilledCount, labourerCount: m.labourerCount, hours: m.hours, costCodeId: m.costCodeId, note: m.note,
        })),
        workItems: r.workItems.map(w => ({
            key: w.id, costCodeId: w.costCodeId, code: w.code, descTh: w.descTh, descEn: w.descEn, unit: w.unit, qtyDone: w.qtyDone,
            progressBefore: w.progressBefore, progressAfter: w.progressAfter, note: w.note,
        })),
        photos: r.photos.map(p => ({
            key: p.id, fileId: p.fileId, url: p.file?.url ?? '', name: p.file?.name ?? '', takenAt: p.takenAt, caption: p.caption, costCodeId: p.costCodeId,
        })),
        issues: r.issues.map(i => ({ key: i.id, id: i.id, kind: i.kind, severity: i.severity, description: i.description, status: i.status })),
    };
}

export function requestFromForm(f: DiaryForm): PutSiteReportRequest {
    return {
        weatherMorning: f.weatherMorning,
        weatherAfternoon: f.weatherAfternoon,
        rainHours: f.rainHours,
        summary: f.summary,
        manpower: f.manpower.map(m => ({
            crewId: m.crewId, supplierId: m.supplierId, crewName: m.crewName.trim(), trade: m.trade.trim(), skilledCount: m.skilledCount,
            labourerCount: m.labourerCount, hours: m.hours, costCodeId: m.costCodeId, note: m.note.trim(),
        })),
        workItems: f.workItems.map(w => ({
            costCodeId: w.costCodeId, qtyDone: w.qtyDone, progressAfter: w.progressAfter, note: w.note.trim(),
        })),
        photos: f.photos.map(p => ({
            fileId: p.fileId, takenAt: p.takenAt, caption: p.caption.trim(), costCodeId: p.costCodeId,
        })),
        // An issue with an id keeps its status; the blank-text ones are dropped.
        issues: f.issues.filter(i => i.description.trim() !== '').map(i => ({
            ...(i.id !== undefined ? { id: i.id } : {}), kind: i.kind, severity: i.severity, description: i.description.trim(),
        })),
    };
}

/** Today in Bangkok as YYYY-MM-DD. */
export function bangkokToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** `YYYY-MM-DD` ± days (calendar arithmetic in UTC). */
export function addDays(date: string, days: number): string {
    const [y, m, d] = date.split('-').map(Number);
    const t = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
    return t.toISOString().slice(0, 10);
}

export const isBusinessDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export const diaryHref = (projectId: string, date?: string): string =>
    `/p/${encodeURIComponent(projectId)}/site-diary${date === undefined ? '' : `/${encodeURIComponent(date)}`}`;
