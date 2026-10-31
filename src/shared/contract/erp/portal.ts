// ─── Portal: role-based home page and global search (module `portal`, docs/erp/02-domain-model.md §6) ───
// No tables: GET /workspaces/:workspaceId/portal gathers tasks from the PortalSources the modules register (only the
// active modules' sources whose permission the caller holds are called), risky projects from the hub roll-ups, module
// tiles and quick actions. GET /workspaces/:workspaceId/search?q= gathers hits from the SearchSources.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { entitlementStatusSchema, moduleIdSchema } from '../modules';
import { businessDateSchema } from './common';
import { docTypeSchema } from './numbering';

/** Task kinds (web: `portal.tasks.<kind>` with `params`). Append only; modules 5–9 add theirs. */
export const PORTAL_TASK_KINDS = [
    'approval_pending', 'invoice_overdue', 'milestone_claimable', 'quotation_expiring', 'variation_awaiting_customer',
] as const;
export const portalTaskKindSchema = z.enum(PORTAL_TASK_KINDS);
export type PortalTaskKind = z.infer<typeof portalTaskKindSchema>;

/** At most this many tasks, ordered by due date (tasks without one last). */
export const PORTAL_TASK_LIMIT = 50;
/** Quotations whose `validUntil` falls within this many days from today. */
export const PORTAL_QUOTATION_EXPIRY_DAYS = 7;

export const portalTaskSchema = z.object({
    kind: portalTaskKindSchema,
    /** Values for the message `portal.tasks.<kind>` (document number, project name, …), raw (not formatted). */
    params: z.record(z.string(), z.union([z.string(), z.number()])),
    /** Web path of the screen where the task is done, e.g. `/p/<projectId>/billing`. */
    href: z.string(),
    dueDate: businessDateSchema.nullable(),
    amount: z.number().nullable(),
    projectId: uuidSchema.nullable(),
    projectName: z.string().nullable(),
});
export type PortalTask = z.infer<typeof portalTaskSchema>;

export const RISK_REASONS = ['cost_overrun', 'behind_schedule', 'overdue_receivable', 'negative_cash'] as const;
export const riskReasonSchema = z.enum(RISK_REASONS);
export type RiskReason = z.infer<typeof riskReasonSchema>;

export const riskyProjectSchema = z.object({
    projectId: uuidSchema,
    projectName: z.string(),
    reasons: z.array(riskReasonSchema),
    /** Overdue receivable (billing active), else null. */
    overdueReceivable: z.number().nullable(),
});
export type RiskyProject = z.infer<typeof riskyProjectSchema>;

export const cashOutlookWeekSchema = z.object({
    weekStart: businessDateSchema,
    inflow: z.number(),
    outflow: z.number(),
    balance: z.number(),
});
export type CashOutlookWeek = z.infer<typeof cashOutlookWeekSchema>;

/** One ERP module card: active, entitlement (trial days left from `expiresAt`), trial startable, offered at all. */
export const moduleTileSchema = z.object({
    module: moduleIdSchema,
    available: z.boolean(),
    active: z.boolean(),
    entitlement: z.object({ status: entitlementStatusSchema, expiresAt: isoDateTimeSchema.nullable() }),
    trialAvailable: z.boolean(),
});
export type ModuleTile = z.infer<typeof moduleTileSchema>;

/** Quick action ids (web: `portal.quickActions.<id>`). */
export const QUICK_ACTION_IDS = [
    'new_project', 'create_quotation', 'create_claim', 'record_receipt', 'create_variation', 'add_customer', 'open_approvals',
    'start_trial',
] as const;
export const quickActionIdSchema = z.enum(QUICK_ACTION_IDS);
export type QuickActionId = z.infer<typeof quickActionIdSchema>;

export const quickActionSchema = z.object({
    id: quickActionIdSchema,
    /** The module the action belongs to. */
    module: moduleIdSchema,
    href: z.string(),
});
export type QuickAction = z.infer<typeof quickActionSchema>;

export const portalDtoSchema = z.object({
    tasks: z.array(portalTaskSchema),
    riskyProjects: z.array(riskyProjectSchema),
    /** null until a cash plan source exists (job-cost, WP-47). */
    cashOutlook: z.array(cashOutlookWeekSchema).nullable(),
    tiles: z.array(moduleTileSchema),
    quickActions: z.array(quickActionSchema),
    generatedAt: isoDateTimeSchema,
});
export type PortalDto = z.infer<typeof portalDtoSchema>;

// ── Global search ──

export const SEARCH_HIT_TYPES = ['project', 'customer', 'supplier', 'document'] as const;
export const searchHitTypeSchema = z.enum(SEARCH_HIT_TYPES);
export type SearchHitType = z.infer<typeof searchHitTypeSchema>;

export const SEARCH_QUERY_MAX = 100;
/** Hits per source and in total. */
export const SEARCH_SOURCE_LIMIT = 10;
export const SEARCH_TOTAL_LIMIT = 30;

export const searchQuerySchema = z.object({
    q: z.string().trim().min(1).max(SEARCH_QUERY_MAX),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchHitSchema = z.object({
    type: searchHitTypeSchema,
    id: z.string(),
    title: z.string(),
    subtitle: z.string(),
    href: z.string(),
    /** `document` hits: the numbered document's type (web label `enums.docType` / numbering names). */
    docType: docTypeSchema.nullable(),
});
export type SearchHit = z.infer<typeof searchHitSchema>;
export const searchHitsDtoSchema = z.array(searchHitSchema);
