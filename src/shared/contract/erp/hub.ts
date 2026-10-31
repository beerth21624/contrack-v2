// ─── Project Hub (docs/erp/02-domain-model.md §1.9, §12) ───
// The hub columns live on `projects` but only the hub module reads/writes them; `projectDtoSchema` stays as it was.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { projectDtoSchema } from '../projects';
import { businessDateSchema } from './common';
import { projectCommercialSettingsSchema, projectSettingsOverrideSchema, projectTypeSchema } from './company';

export const PROJECT_STATUSES = [
    'lead', 'estimating', 'quoted', 'won', 'in_progress', 'handover', 'warranty', 'closed', 'lost', 'cancelled',
] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
/** Named `HubProjectStatus` (the backend already has a `ProjectStatus` port type: workspace + archived). */
export type HubProjectStatus = z.infer<typeof projectStatusSchema>;

/** Statuses a user may move a project to (`projects.edit`); `closed → warranty` is for the owner only. */
export const PROJECT_STATUS_TRANSITIONS: Readonly<Record<HubProjectStatus, readonly HubProjectStatus[]>> = {
    lead: ['estimating', 'lost', 'cancelled'],
    estimating: ['quoted', 'lost', 'cancelled'],
    quoted: ['won', 'estimating', 'lost', 'cancelled'],
    won: ['in_progress', 'cancelled'],
    in_progress: ['handover', 'cancelled'],
    handover: ['warranty', 'in_progress'],
    warranty: ['closed'],
    closed: ['warranty'],
    lost: ['estimating'],
    cancelled: ['estimating'],
};

/** The order automatic advances (ProjectLifecycle) move along; `lost` / `cancelled` are off this path. */
export const PROJECT_STATUS_ORDER: readonly HubProjectStatus[] = [
    'lead', 'estimating', 'quoted', 'won', 'in_progress', 'handover', 'warranty', 'closed',
];

export const PROJECT_CODE_MAX = 40;

export const hubProjectFieldsSchema = z.object({
    code: z.string().nullable(),
    status: projectStatusSchema,
    /** null = the company's default project type (or `residential_new`). */
    projectType: projectTypeSchema.nullable(),
    customerId: uuidSchema.nullable(),
    siteAddress: z.string(),
    plannedStart: businessDateSchema.nullable(),
    plannedFinish: businessDateSchema.nullable(),
    actualStart: businessDateSchema.nullable(),
    actualFinish: businessDateSchema.nullable(),
    managerUserId: uuidSchema.nullable(),
    /** The project's own overrides of the commercial terms. */
    settings: projectSettingsOverrideSchema,
    description: z.string(),
});
export type HubProjectFields = z.infer<typeof hubProjectFieldsSchema>;

export const hubMilestoneSchema = z.object({ label: z.string(), dueDate: businessDateSchema.nullable(), amount: z.number() });

/** Cross-module figures of a project (null = the owning module is not active / has nothing yet). */
export const projectRollupSchema = z.object({
    budgetTotal: z.number().nullable(),
    contractValue: z.number().nullable(),
    billedToDate: z.number().nullable(),
    receivedToDate: z.number().nullable(),
    overdueReceivable: z.number().nullable(),
    committedOpen: z.number().nullable(),
    actualCost: z.number().nullable(),
    forecastAtCompletion: z.number().nullable(),
    projectedProfit: z.number().nullable(),
    progressPct: z.number().nullable(),
    openVariations: z.number().nullable(),
    openPurchaseOrders: z.number().nullable(),
    nextMilestone: hubMilestoneSchema.nullable(),
    alerts: z.array(z.string()),
});
export type ProjectRollup = z.infer<typeof projectRollupSchema>;

export const EMPTY_PROJECT_ROLLUP: Readonly<ProjectRollup> = {
    budgetTotal: null, contractValue: null, billedToDate: null, receivedToDate: null, overdueReceivable: null,
    committedOpen: null, actualCost: null, forecastAtCompletion: null, projectedProfit: null, progressPct: null,
    openVariations: null, openPurchaseOrders: null, nextMilestone: null, alerts: [],
};

/** One row of the hub: the release-1 project DTO, its hub fields, the customer's display name and the roll-up. */
export const hubProjectDtoSchema = z.object({
    project: projectDtoSchema,
    hub: hubProjectFieldsSchema,
    customerName: z.string().nullable(),
    rollup: projectRollupSchema,
});
export type HubProjectDto = z.infer<typeof hubProjectDtoSchema>;
export const hubProjectListDtoSchema = z.array(hubProjectDtoSchema);

/** GET /projects/:projectId/hub: the row plus what the overview page needs. */
export const hubProjectDetailDtoSchema = hubProjectDtoSchema.extend({
    /** `hub.projectType` or the company's default. */
    effectiveProjectType: projectTypeSchema,
    /** Type defaults ← company overrides ← project overrides. */
    effectiveSettings: projectCommercialSettingsSchema,
    managerName: z.string().nullable(),
    /** The caller may PATCH / assign a code (`projects.edit` and the project is not archived). */
    canEdit: z.boolean(),
    /** Statuses the caller may move the project to now. */
    nextStatuses: z.array(projectStatusSchema),
});
export type HubProjectDetailDto = z.infer<typeof hubProjectDetailDtoSchema>;

const optionalDate = businessDateSchema.nullable().optional();

/**
 * PATCH /projects/:projectId/hub: any subset. `settings` is merged key by key into the stored overrides;
 * `settingsReset` removes overrides (back to the company / type default). `customerId` must be in the same workspace (404).
 */
export const updateHubProjectRequestSchema = z.object({
    code: z.string().trim().min(1).max(PROJECT_CODE_MAX).nullable().optional(),
    status: projectStatusSchema.optional(),
    projectType: projectTypeSchema.nullable().optional(),
    customerId: uuidSchema.nullable().optional(),
    siteAddress: z.string().trim().max(1000).optional(),
    plannedStart: optionalDate,
    plannedFinish: optionalDate,
    actualStart: optionalDate,
    actualFinish: optionalDate,
    managerUserId: uuidSchema.nullable().optional(),
    settings: projectSettingsOverrideSchema.optional(),
    settingsReset: z.array(projectCommercialSettingsSchema.keyof()).max(20).optional(),
    description: z.string().trim().max(4000).optional(),
}).strict();
export type UpdateHubProjectRequest = z.infer<typeof updateHubProjectRequestSchema>;

const csvStatuses = z.preprocess(
    v => (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(s => s !== '') : v),
    z.array(projectStatusSchema).max(PROJECT_STATUSES.length),
);

/** GET /workspaces/:workspaceId/hub/projects?status=won,in_progress&q=&customerId=&type=&archived= */
export const hubProjectListQuerySchema = z.object({
    status: csvStatuses.optional(),
    q: z.string().trim().max(100).optional(),
    customerId: uuidSchema.optional(),
    type: projectTypeSchema.optional(),
    archived: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
});
export type HubProjectListQuery = z.infer<typeof hubProjectListQuerySchema>;

/** GET /workspaces/:workspaceId/hub/summary: active (not archived) projects. Money totals are null while no module supplies them. */
export const hubSummaryDtoSchema = z.object({
    total: z.number().int(),
    byStatus: z.record(projectStatusSchema, z.number().int()),
    contractValue: z.number().nullable(),
    /** Σ (billed − received). */
    outstandingReceivable: z.number().nullable(),
    overdueReceivable: z.number().nullable(),
    generatedAt: isoDateTimeSchema,
});
export type HubSummaryDto = z.infer<typeof hubSummaryDtoSchema>;
