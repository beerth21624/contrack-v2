// ─── Site diary (รายงานประจำวัน, docs/erp/02-domain-model.md §8.1, WP-42) ───
// One report per project per Bangkok day: `draft → submitted`, `submitted → draft` (reopen). The whole report is written
// with one PUT (weather, summary, manpower, work items, photos, issues). Submitting sets the cost codes' reported
// progress (latest report date wins) and, while the `labour` module is off, posts the estimated labour cost of the
// crews to the cost ledger (`site_diary`); reopening reverses it. Progress is a fraction (0.4 = 40%).
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { fileDtoSchema } from '../files';
import { businessDateSchema, quantitySchema, rateSchema } from './common';

export const SITE_REPORT_STATUSES = ['draft', 'submitted'] as const;
export const siteReportStatusSchema = z.enum(SITE_REPORT_STATUSES);
export type SiteReportStatus = z.infer<typeof siteReportStatusSchema>;

export const SITE_WEATHERS = ['sunny', 'cloudy', 'rain', 'storm'] as const;
export const siteWeatherSchema = z.enum(SITE_WEATHERS);
export type SiteWeather = z.infer<typeof siteWeatherSchema>;

export const SITE_ISSUE_KINDS = ['delay', 'safety', 'quality', 'material', 'weather', 'customer', 'other'] as const;
export const siteIssueKindSchema = z.enum(SITE_ISSUE_KINDS);
export type SiteIssueKind = z.infer<typeof siteIssueKindSchema>;

export const SITE_ISSUE_SEVERITIES = ['low', 'medium', 'high'] as const;
export const siteIssueSeveritySchema = z.enum(SITE_ISSUE_SEVERITIES);
export type SiteIssueSeverity = z.infer<typeof siteIssueSeveritySchema>;

export const SITE_ISSUE_STATUSES = ['open', 'resolved'] as const;
export const siteIssueStatusSchema = z.enum(SITE_ISSUE_STATUSES);
export type SiteIssueStatus = z.infer<typeof siteIssueStatusSchema>;

/** Hours of a normal working day (labour cost from the diary = daily cost × hours / 8). */
export const SITE_DAY_HOURS = 8;

// ── DTOs ──

export const siteManpowerDtoSchema = z.object({
    id: uuidSchema,
    crewId: uuidSchema.nullable(),
    supplierId: uuidSchema.nullable(),
    crewName: z.string(),
    trade: z.string(),
    skilledCount: z.number().int(),
    labourerCount: z.number().int(),
    hours: z.number(),
    costCodeId: uuidSchema.nullable(),
    note: z.string(),
});
export type SiteManpowerDto = z.infer<typeof siteManpowerDtoSchema>;

export const siteWorkItemDtoSchema = z.object({
    id: uuidSchema,
    costCodeId: uuidSchema,
    /** Of the cost code ('' when it is gone). */
    code: z.string(),
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    qtyDone: z.number().nullable(),
    /** Cumulative progress before this day: the latest submitted report of an earlier date (0 when none). */
    progressBefore: z.number(),
    /** Cumulative progress at the end of this day. */
    progressAfter: z.number(),
    note: z.string(),
});
export type SiteWorkItemDto = z.infer<typeof siteWorkItemDtoSchema>;

export const sitePhotoDtoSchema = z.object({
    id: uuidSchema,
    fileId: uuidSchema,
    file: fileDtoSchema.nullable(),
    takenAt: isoDateTimeSchema.nullable(),
    caption: z.string(),
    costCodeId: uuidSchema.nullable(),
});
export type SitePhotoDto = z.infer<typeof sitePhotoDtoSchema>;

export const siteIssueDtoSchema = z.object({
    id: uuidSchema,
    reportId: uuidSchema,
    projectId: uuidSchema,
    reportDate: businessDateSchema,
    kind: siteIssueKindSchema,
    severity: siteIssueSeveritySchema,
    description: z.string(),
    status: siteIssueStatusSchema,
    resolvedAt: isoDateTimeSchema.nullable(),
    resolvedBy: uuidSchema.nullable(),
    createdAt: isoDateTimeSchema,
});
export type SiteIssueDto = z.infer<typeof siteIssueDtoSchema>;

export const siteReportSummaryDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    reportDate: businessDateSchema,
    status: siteReportStatusSchema,
    weatherMorning: siteWeatherSchema.nullable(),
    weatherAfternoon: siteWeatherSchema.nullable(),
    rainHours: z.number(),
    summary: z.string(),
    /** Σ skilled + labourers of the manpower rows. */
    headcount: z.number().int(),
    workItemCount: z.number().int(),
    photoCount: z.number().int(),
    openIssueCount: z.number().int(),
    submittedAt: isoDateTimeSchema.nullable(),
    submittedBy: uuidSchema.nullable(),
    createdBy: uuidSchema,
    updatedAt: isoDateTimeSchema,
});
export type SiteReportSummaryDto = z.infer<typeof siteReportSummaryDtoSchema>;

export const siteReportListDtoSchema = z.object({ items: z.array(siteReportSummaryDtoSchema) });
export type SiteReportListDto = z.infer<typeof siteReportListDtoSchema>;

/**
 * GET /projects/:projectId/site-diary/:date. `id` null = nothing saved for that day yet (a blank draft; the first PUT
 * creates it).
 */
export const siteReportDtoSchema = siteReportSummaryDtoSchema.extend({
    id: uuidSchema.nullable(),
    createdBy: uuidSchema.nullable(),
    updatedAt: isoDateTimeSchema.nullable(),
    manpower: z.array(siteManpowerDtoSchema),
    workItems: z.array(siteWorkItemDtoSchema),
    photos: z.array(sitePhotoDtoSchema),
    issues: z.array(siteIssueDtoSchema),
    /** PUT / submit allowed (draft, role holds `site.report`, project not archived). */
    canEdit: z.boolean(),
    /** Reopen allowed (submitted, role holds `site.report`, project not archived). */
    canReopen: z.boolean(),
});
export type SiteReportDto = z.infer<typeof siteReportDtoSchema>;

/** GET /projects/:projectId/site-diary/progress — the S-curve: actual from the submitted reports, planned from the BOQ plan. */
export const siteProgressDtoSchema = z.object({
    /** Budget-weighted cumulative progress after each report date (oldest first). */
    actual: z.array(z.object({ date: businessDateSchema, pct: z.number() })),
    /** Planned cumulative progress per week bucket of the project's schedule; null when it cannot be computed. */
    planned: z.array(z.object({ weekStart: businessDateSchema, pct: z.number() })).nullable(),
});
export type SiteProgressDto = z.infer<typeof siteProgressDtoSchema>;

export const siteIssueListDtoSchema = z.object({ items: z.array(siteIssueDtoSchema) });
export type SiteIssueListDto = z.infer<typeof siteIssueListDtoSchema>;

// ── requests ──

/** GET /projects/:projectId/site-diary?from=&to= (both optional, inclusive; newest first). */
export const siteReportListQuerySchema = z.object({
    from: businessDateSchema.optional(),
    to: businessDateSchema.optional(),
});
export type SiteReportListQuery = z.infer<typeof siteReportListQuerySchema>;

/** GET /projects/:projectId/site-issues?status= */
export const siteIssueListQuerySchema = z.object({ status: siteIssueStatusSchema.optional() });
export type SiteIssueListQuery = z.infer<typeof siteIssueListQuerySchema>;

const noteField = z.string().trim().max(2000);
const countField = z.number().int().min(0).max(10_000);
const hoursField = z.number().finite().min(0).max(24);

export const siteManpowerInputSchema = z.object({
    /** A workforce crew (its name fills `crewName` when that is empty). */
    crewId: uuidSchema.nullable().optional(),
    /** A supplier / subcontractor of the vendor master. */
    supplierId: uuidSchema.nullable().optional(),
    crewName: z.string().trim().max(200).optional(),
    trade: z.string().trim().max(60).optional(),
    skilledCount: countField.optional(),
    labourerCount: countField.optional(),
    hours: hoursField.optional(),
    costCodeId: uuidSchema.nullable().optional(),
    note: noteField.optional(),
});
export type SiteManpowerInput = z.infer<typeof siteManpowerInputSchema>;

export const siteWorkItemInputSchema = z.object({
    costCodeId: uuidSchema,
    qtyDone: quantitySchema.refine(v => v >= 0, { message: 'Must be 0 or more' }).nullable().optional(),
    /** Cumulative progress at the end of the day (0–1). */
    progressAfter: rateSchema,
    note: noteField.optional(),
});
export type SiteWorkItemInput = z.infer<typeof siteWorkItemInputSchema>;

/** Photo: purpose `site_photo`; `takenAt` from the phone (the files table has no capture time). */
export const sitePhotoInputSchema = z.object({
    fileId: uuidSchema,
    takenAt: isoDateTimeSchema.nullable().optional(),
    caption: z.string().trim().max(500).optional(),
    costCodeId: uuidSchema.nullable().optional(),
});
export type SitePhotoInput = z.infer<typeof sitePhotoInputSchema>;

/** `id` of an issue of this report keeps it (and its status); without one a new open issue is made. */
export const siteIssueInputSchema = z.object({
    id: uuidSchema.optional(),
    kind: siteIssueKindSchema,
    severity: siteIssueSeveritySchema.optional(),
    description: z.string().trim().min(1).max(2000),
});
export type SiteIssueInput = z.infer<typeof siteIssueInputSchema>;

/**
 * PUT /projects/:projectId/site-diary/:date — creates the day's draft or replaces it (draft only). Fields left out keep
 * their value; a list sent replaces that list. One work item per cost code.
 */
export const putSiteReportRequestSchema = z.object({
    weatherMorning: siteWeatherSchema.nullable().optional(),
    weatherAfternoon: siteWeatherSchema.nullable().optional(),
    rainHours: hoursField.optional(),
    summary: z.string().trim().max(5000).optional(),
    manpower: z.array(siteManpowerInputSchema).max(100).optional(),
    workItems: z.array(siteWorkItemInputSchema).max(500).optional(),
    photos: z.array(sitePhotoInputSchema).max(60).optional(),
    issues: z.array(siteIssueInputSchema).max(50).optional(),
});
export type PutSiteReportRequest = z.infer<typeof putSiteReportRequestSchema>;

/** PATCH /site-issues/:issueId — resolve / reopen an issue (any report status), or fix its text. */
export const patchSiteIssueRequestSchema = z.object({
    status: siteIssueStatusSchema.optional(),
    severity: siteIssueSeveritySchema.optional(),
    description: z.string().trim().min(1).max(2000).optional(),
});
export type PatchSiteIssueRequest = z.infer<typeof patchSiteIssueRequestSchema>;
