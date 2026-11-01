// ─── Job cost (ต้นทุนโครงการ, docs/erp/02-domain-model.md §9, WP-46; cash flow WP-47) ───
// Per cost code (BOQ line of the baseline): budget vs committed (open) vs actual vs forecast at completion (EAC), grouped
// by BOQ section with an "unassigned" row for overhead (ledger rows without a cost code); projected profit of the
// project from the main contract; alerts (cost over budget, commitments over budget, margin drop) kept in `jc_alerts`.
// Every figure is baht without VAT. Reading needs `cost.read`, forecasts `cost.manage`.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { amountSchema, businessDateSchema, signedAmountSchema } from './common';
import { costCodeSourceSchema, costCodeStatusSchema } from './boq-control';
import { mainContractStatusSchema } from './main-contracts';

/** `auto` = actual + max(budget × (1 − progress), committedOpen); `manual` = max(entered EAC, actual + committedOpen). */
export const JOB_COST_FORECAST_METHODS = ['auto', 'manual'] as const;
export const jobCostForecastMethodSchema = z.enum(JOB_COST_FORECAST_METHODS);
export type JobCostForecastMethod = z.infer<typeof jobCostForecastMethodSchema>;

/** ok: EAC ≤ budget · warning: ≤ budget × 1.1 · critical: above (budget 0 with EAC > 0 → critical). */
export const JOB_COST_LEVELS = ['ok', 'warning', 'critical'] as const;
export const jobCostLevelSchema = z.enum(JOB_COST_LEVELS);
export type JobCostLevel = z.infer<typeof jobCostLevelSchema>;

/** EAC above budget × this factor is critical. */
export const JOB_COST_CRITICAL_FACTOR = 1.1;
/** margin_drop when the projected margin is more than this below the quoted margin. */
export const JOB_COST_MARGIN_DROP_TOLERANCE = 0.05;

export const JOB_COST_ALERT_KINDS = ['cost_overrun', 'commitment_over_budget', 'negative_cash', 'margin_drop'] as const;
export const jobCostAlertKindSchema = z.enum(JOB_COST_ALERT_KINDS);
export type JobCostAlertKind = z.infer<typeof jobCostAlertKindSchema>;

export const JOB_COST_ALERT_LEVELS = ['warning', 'critical'] as const;
export const jobCostAlertLevelSchema = z.enum(JOB_COST_ALERT_LEVELS);
export type JobCostAlertLevel = z.infer<typeof jobCostAlertLevelSchema>;

/** Where `progress` comes from: site reports when `site-diary` is active, else certified claims. */
export const JOB_COST_PROGRESS_SOURCES = ['reported', 'certified'] as const;
export const jobCostProgressSourceSchema = z.enum(JOB_COST_PROGRESS_SOURCES);
export type JobCostProgressSource = z.infer<typeof jobCostProgressSourceSchema>;

/** Figures shared by a cost code, a section and the project. */
export const jobCostFiguresSchema = z.object({
    budget: z.number(),
    committedOpen: z.number(),
    actual: z.number(),
    /** = round2(budget × progress) (Σ for a section / the project). */
    earned: z.number(),
    /** Estimate to complete = eac − actual. */
    etc: z.number(),
    eac: z.number(),
    /** = budget − eac (negative = over budget). */
    variance: z.number(),
    level: jobCostLevelSchema,
});
export type JobCostFigures = z.infer<typeof jobCostFiguresSchema>;

export const jobCostLineDtoSchema = jobCostFiguresSchema.extend({
    costCodeId: uuidSchema,
    code: z.string(),
    source: costCodeSourceSchema,
    status: costCodeStatusSchema,
    sectionNo: z.number().int(),
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    /** Fraction 0–1 (see `progressSource` of the report). */
    progress: z.number(),
    forecastMethod: jobCostForecastMethodSchema,
    /** The entered EAC of a manual forecast, else null. */
    forecastEac: z.number().nullable(),
    forecastNote: z.string(),
    forecastUpdatedAt: isoDateTimeSchema.nullable(),
});
export type JobCostLineDto = z.infer<typeof jobCostLineDtoSchema>;

export const jobCostSectionDtoSchema = jobCostFiguresSchema.extend({
    sectionNo: z.number().int(),
    /** Budget-weighted progress of the section (fraction). */
    progress: z.number(),
    lineCount: z.number().int(),
});
export type JobCostSectionDto = z.infer<typeof jobCostSectionDtoSchema>;

/** Ledger rows without a cost code (overhead, "ไม่ระบุ"); counted in the project cost at actual + committedOpen. */
export const jobCostUnassignedDtoSchema = z.object({
    committedOpen: z.number(),
    actual: z.number(),
});
export type JobCostUnassignedDto = z.infer<typeof jobCostUnassignedDtoSchema>;

/**
 * Projected profit: revenue = current value of the signed main contract (null without one), cost = Σ EAC of the cost
 * codes + unassigned (actual + committedOpen).
 */
export const jobCostProfitDtoSchema = z.object({
    contractId: uuidSchema.nullable(),
    contractStatus: mainContractStatusSchema.nullable(),
    revenue: z.number().nullable(),
    cost: z.number(),
    profit: z.number().nullable(),
    /** profit / revenue (fraction), null without revenue. */
    marginPct: z.number().nullable(),
    /** Margin of the accepted quotation; null without one or for roles without `quotations.seeMargins`. */
    quotedMarginPct: z.number().nullable(),
    /** From billing when active (else null). */
    billed: z.number().nullable(),
    received: z.number().nullable(),
});
export type JobCostProfitDto = z.infer<typeof jobCostProfitDtoSchema>;

export const jobCostAlertDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    projectName: z.string(),
    costCodeId: uuidSchema.nullable(),
    /** Cost code of the alert (null for a project alert). */
    code: z.string().nullable(),
    descTh: z.string().nullable(),
    descEn: z.string().nullable(),
    kind: jobCostAlertKindSchema,
    level: jobCostAlertLevelSchema,
    /** cost_overrun: EAC · commitment_over_budget: committedOpen + actual · margin_drop: projected margin (fraction). */
    value: z.number(),
    /** cost_overrun / commitment_over_budget: budget · margin_drop: quoted margin − tolerance. */
    threshold: z.number(),
    firstSeenAt: isoDateTimeSchema,
    lastSeenAt: isoDateTimeSchema,
    resolvedAt: isoDateTimeSchema.nullable(),
    notifiedAt: isoDateTimeSchema.nullable(),
});
export type JobCostAlertDto = z.infer<typeof jobCostAlertDtoSchema>;
export const jobCostAlertListDtoSchema = z.array(jobCostAlertDtoSchema);

/** GET /projects/:projectId/job-cost */
export const jobCostReportDtoSchema = z.object({
    projectId: uuidSchema,
    /** false = no baseline yet: no cost codes, only unassigned rows. */
    baselineLocked: z.boolean(),
    progressSource: jobCostProgressSourceSchema,
    /** BOQ order. Omitted cost codes appear only when they have a budget or ledger rows. */
    lines: z.array(jobCostLineDtoSchema),
    /** Section number order. */
    sections: z.array(jobCostSectionDtoSchema),
    unassigned: jobCostUnassignedDtoSchema,
    /** Cost codes only (committedOpen / actual here leave out `unassigned`). */
    totals: jobCostFiguresSchema,
    profit: jobCostProfitDtoSchema,
    /** Open alerts of the project. */
    alerts: z.array(jobCostAlertDtoSchema),
    generatedAt: isoDateTimeSchema,
});
export type JobCostReportDto = z.infer<typeof jobCostReportDtoSchema>;

/** PUT /projects/:projectId/job-cost/forecasts/:costCodeId — `auto` clears a manual forecast. Answers the report. */
export const putJobCostForecastRequestSchema = z.discriminatedUnion('method', [
    z.object({ method: z.literal('auto'), note: z.string().max(1000).optional() }),
    z.object({ method: z.literal('manual'), eac: amountSchema, note: z.string().max(1000).optional() }),
]);
export type PutJobCostForecastRequest = z.infer<typeof putJobCostForecastRequestSchema>;

/** GET /workspaces/:workspaceId/job-cost/alerts?projectId=&includeResolved= — open alerts first (newest first). */
export const jobCostAlertListQuerySchema = z.object({
    projectId: uuidSchema.optional(),
    includeResolved: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
});
export type JobCostAlertListQuery = z.infer<typeof jobCostAlertListQuerySchema>;

// ── Cash flow (WP-47) ──
// Planned money = what the modules still expect to move (open invoices, unbilled milestones with a due date, issued POs
// not billed, labour to pay, unpaid subcontract installments; supplier bills from payables later). Actual money =
// Σ `fin_events.cash` per week (+ in, − out). Weeks start on Monday (Bangkok). Outstanding items dated before the current
// week count in the current week.

/** Where a planned item comes from. */
export const CASH_PLAN_SOURCES = ['invoice', 'milestone', 'purchase_order', 'labour', 'subcontract', 'supplier_bill'] as const;
export const cashPlanSourceSchema = z.enum(CASH_PLAN_SOURCES);
export type CashPlanSourceKind = z.infer<typeof cashPlanSourceSchema>;

export const CASH_FLOW_DEFAULT_WEEKS = 13;
export const CASH_FLOW_MAX_WEEKS = 52;
export const CASH_FLOW_MAX_PAST_WEEKS = 26;

export const cashPlanItemDtoSchema = z.object({
    projectId: uuidSchema,
    projectName: z.string(),
    date: businessDateSchema,
    direction: z.enum(['in', 'out']),
    amount: z.number(),
    source: cashPlanSourceSchema,
    /** Document number or label (e.g. `INV-2026-0001`, `2026-11-A`, `งวด 2`). */
    ref: z.string(),
});
export type CashPlanItemDto = z.infer<typeof cashPlanItemDtoSchema>;

export const cashWeekDtoSchema = z.object({
    weekStart: businessDateSchema,
    weekEnd: businessDateSchema,
    /** Before the current week: actual figures only. */
    past: z.boolean(),
    plannedIn: z.number(),
    plannedOut: z.number(),
    actualIn: z.number(),
    actualOut: z.number(),
    /** Balance at the end of the week. */
    balance: z.number(),
});
export type CashWeekDto = z.infer<typeof cashWeekDtoSchema>;

/** The estimate's CashFlow sheet (planning) per week: the "plan at estimating" line of a project. */
export const cashEstimateWeekDtoSchema = z.object({
    weekStart: businessDateSchema,
    inflow: z.number(),
    outflow: z.number(),
    cumulative: z.number(),
});
export type CashEstimateWeekDto = z.infer<typeof cashEstimateWeekDtoSchema>;

export const cashSettingsDtoSchema = z.object({
    openingBalance: z.number(),
    /** The day `openingBalance` is the balance at (start of day); null = not set (opening 0 before every event). */
    asOf: businessDateSchema.nullable(),
    minBalance: z.number(),
    updatedAt: isoDateTimeSchema.nullable(),
});
export type CashSettingsDto = z.infer<typeof cashSettingsDtoSchema>;

/**
 * GET /projects/:projectId/cash-flow and GET /workspaces/:workspaceId/cash-flow. Project: opening = Σ cash of the
 * project before the window, minimum 0, with `estimate`. Company: every live project plus money without a project,
 * opening from `settings`, minimum `settings.minBalance`, `estimate` null.
 */
export const cashFlowDtoSchema = z.object({
    scope: z.enum(['project', 'company']),
    projectId: uuidSchema.nullable(),
    today: businessDateSchema,
    opening: z.number(),
    minBalance: z.number(),
    weeks: z.array(cashWeekDtoSchema),
    /** weekStart of the first current-or-later week whose balance < minBalance. */
    firstBelowMin: businessDateSchema.nullable(),
    lowestBalance: z.number().nullable(),
    /** Planned items inside the window (date order). */
    items: z.array(cashPlanItemDtoSchema),
    estimate: z.array(cashEstimateWeekDtoSchema).nullable(),
    settings: cashSettingsDtoSchema.nullable(),
    generatedAt: isoDateTimeSchema,
});
export type CashFlowDto = z.infer<typeof cashFlowDtoSchema>;

/** ?weeks=13&pastWeeks=0 */
export const cashFlowQuerySchema = z.object({
    weeks: z.coerce.number().int().min(1).max(CASH_FLOW_MAX_WEEKS).default(CASH_FLOW_DEFAULT_WEEKS),
    pastWeeks: z.coerce.number().int().min(0).max(CASH_FLOW_MAX_PAST_WEEKS).default(0),
});
export type CashFlowQuery = z.infer<typeof cashFlowQuerySchema>;

/** PUT /workspaces/:workspaceId/cash-settings — `cost.manage`. */
export const putCashSettingsRequestSchema = z.object({
    openingBalance: signedAmountSchema,
    asOf: businessDateSchema,
    minBalance: signedAmountSchema,
});
export type PutCashSettingsRequest = z.infer<typeof putCashSettingsRequestSchema>;
