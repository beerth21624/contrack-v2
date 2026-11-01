// ─── Labour (ใบลงเวลา งวดค่าแรง 15 วัน เบิกล่วงหน้า, docs/erp/02-domain-model.md §8.2, WP-44) ───
// Timesheets: one entry per person per project per day (0.5 / 1 day; Σ days of a person on a day ≤ 1 across projects),
// written per project-day with one PUT (prefilled from the crews of that day's site report). Approving a date range
// (`timesheet.approve`) posts the actual labour cost per cost code. Pay periods are half months (`2026-10-A` = 1–15,
// `2026-10-B` = 16–end): build (approved entries + wage advances recovered oldest first) → approve (`pay_period.approve`)
// → pay (fin_events `lb.wages_paid` per project, `lb.advance_recovered`). From `pending_approval` on, the period's
// timesheets are locked (409 `period_locked`). A person's wage, amounts and advances are null for roles without
// `workforce.seeWages` (`wagesHidden: true`).
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { amountSchema, businessDateSchema } from './common';

export const TIMESHEET_STATUSES = ['draft', 'approved', 'paid'] as const;
export const timesheetStatusSchema = z.enum(TIMESHEET_STATUSES);
export type TimesheetStatus = z.infer<typeof timesheetStatusSchema>;

export const TIMESHEET_SOURCES = ['manual', 'site_diary'] as const;
export const timesheetSourceSchema = z.enum(TIMESHEET_SOURCES);
export type TimesheetSource = z.infer<typeof timesheetSourceSchema>;

/** open → pending_approval → approved → paid; open → approved when the approval is skipped; pending_approval → open on reject. */
export const PAY_PERIOD_STATUSES = ['open', 'pending_approval', 'approved', 'paid'] as const;
export const payPeriodStatusSchema = z.enum(PAY_PERIOD_STATUSES);
export type PayPeriodStatus = z.infer<typeof payPeriodStatusSchema>;

/** Periods in these statuses lock their timesheets (409 `period_locked`). */
export const PAY_PERIOD_LOCKED_STATUSES: readonly PayPeriodStatus[] = ['pending_approval', 'approved', 'paid'];

export const WAGE_ADVANCE_STATUSES = ['open', 'partially_recovered', 'recovered', 'written_off'] as const;
export const wageAdvanceStatusSchema = z.enum(WAGE_ADVANCE_STATUSES);
export type WageAdvanceStatus = z.infer<typeof wageAdvanceStatusSchema>;

export const LABOUR_PAYMENT_METHODS = ['cash', 'transfer'] as const;
export const labourPaymentMethodSchema = z.enum(LABOUR_PAYMENT_METHODS);
export type LabourPaymentMethod = z.infer<typeof labourPaymentMethodSchema>;

/** Days per entry: half a day or a full day. */
export const TIMESHEET_DAYS = [0.5, 1] as const;
/** Default OT rate = daily wage / 8 × 1.5. */
export const TIMESHEET_DAY_HOURS = 8;
export const TIMESHEET_OT_FACTOR = 1.5;
/** At most this many days per approve call. */
export const TIMESHEET_APPROVE_MAX_DAYS = 62;

/** `2026-10-A` (days 1–15) or `2026-10-B` (16 to the end of the month). */
export const payPeriodKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-[AB]$/);

// ── DTOs ──

export const timesheetEntryDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    personId: uuidSchema,
    /** From workforce ('' when the person is gone). */
    personName: z.string(),
    workDate: businessDateSchema,
    crewId: uuidSchema.nullable(),
    costCodeId: uuidSchema.nullable(),
    days: z.number(),
    otHours: z.number(),
    /** ฿/day snapshot; null when hidden (`wagesHidden`). */
    dailyWage: z.number().nullable(),
    otRate: z.number().nullable(),
    amount: z.number().nullable(),
    status: timesheetStatusSchema,
    /** A draft held by a pending `timesheet.approve` request (cannot be edited). */
    pendingApproval: z.boolean(),
    payPeriodId: uuidSchema.nullable(),
    source: timesheetSourceSchema,
    note: z.string(),
    recordedBy: uuidSchema,
    approvedBy: uuidSchema.nullable(),
    approvedAt: isoDateTimeSchema.nullable(),
    updatedAt: isoDateTimeSchema,
});
export type TimesheetEntryDto = z.infer<typeof timesheetEntryDtoSchema>;

/** A person suggested from the crews of that day's site report (only while the day has no entry yet). */
export const timesheetSuggestionDtoSchema = z.object({
    personId: uuidSchema,
    personName: z.string(),
    crewId: uuidSchema,
    crewName: z.string(),
    costCodeId: uuidSchema.nullable(),
    days: z.number(),
    otHours: z.number(),
    /** ฿/day from workforce; null when not set or hidden. */
    dailyWage: z.number().nullable(),
});
export type TimesheetSuggestionDto = z.infer<typeof timesheetSuggestionDtoSchema>;

/** GET /projects/:projectId/timesheets/:date */
export const timesheetDayDtoSchema = z.object({
    projectId: uuidSchema,
    workDate: businessDateSchema,
    periodKey: payPeriodKeySchema,
    /** Status of the day's pay period ('open' when not built yet). */
    periodStatus: payPeriodStatusSchema,
    /** The pay period is pending_approval / approved / paid: nothing of the day can change. */
    locked: z.boolean(),
    entries: z.array(timesheetEntryDtoSchema),
    suggestions: z.array(timesheetSuggestionDtoSchema),
    totals: z.object({ days: z.number(), otHours: z.number(), amount: z.number().nullable() }),
    wagesHidden: z.boolean(),
    /** PUT allowed (`labour.record`, project not archived, period not locked). */
    canEdit: z.boolean(),
});
export type TimesheetDayDto = z.infer<typeof timesheetDayDtoSchema>;

/** POST /projects/:projectId/timesheets/approve */
export const approveTimesheetsResultDtoSchema = z.object({
    /** approved = posted at once; pending = waiting for an approver; none = no draft entry in the range. */
    status: z.enum(['approved', 'pending', 'none']),
    entryCount: z.number().int(),
    amount: z.number().nullable(),
    approvalRequestId: uuidSchema.nullable(),
});
export type ApproveTimesheetsResultDto = z.infer<typeof approveTimesheetsResultDtoSchema>;

export const payPeriodSummaryDtoSchema = z.object({
    /** null = not built yet (the current period is always listed). */
    id: uuidSchema.nullable(),
    periodKey: payPeriodKeySchema,
    startDate: businessDateSchema,
    endDate: businessDateSchema,
    status: payPeriodStatusSchema,
    gross: z.number(),
    advanceDeduction: z.number(),
    net: z.number(),
    lineCount: z.number().int(),
    builtAt: isoDateTimeSchema.nullable(),
    approvedBy: uuidSchema.nullable(),
    approvedAt: isoDateTimeSchema.nullable(),
    paidDate: businessDateSchema.nullable(),
    paidAt: isoDateTimeSchema.nullable(),
    paymentMethod: labourPaymentMethodSchema.nullable(),
});
export type PayPeriodSummaryDto = z.infer<typeof payPeriodSummaryDtoSchema>;

export const payPeriodListDtoSchema = z.object({ items: z.array(payPeriodSummaryDtoSchema) });
export type PayPeriodListDto = z.infer<typeof payPeriodListDtoSchema>;

export const payLineDtoSchema = z.object({
    id: uuidSchema,
    personId: uuidSchema,
    personName: z.string(),
    days: z.number(),
    otHours: z.number(),
    /** null when hidden (`wagesHidden`). */
    gross: z.number().nullable(),
    advanceDeduction: z.number().nullable(),
    otherDeduction: z.number().nullable(),
    net: z.number().nullable(),
    paid: z.boolean(),
    note: z.string(),
});
export type PayLineDto = z.infer<typeof payLineDtoSchema>;

/** GET /pay-periods/:periodId and the answer of build / approve / pay. */
export const payPeriodDtoSchema = payPeriodSummaryDtoSchema.extend({
    lines: z.array(payLineDtoSchema),
    /** Draft timesheet entries in the period's dates (not included until approved). */
    unapprovedCount: z.number().int(),
    wagesHidden: z.boolean(),
    canBuild: z.boolean(),
    canApprove: z.boolean(),
    canPay: z.boolean(),
});
export type PayPeriodDto = z.infer<typeof payPeriodDtoSchema>;

export const wageAdvanceDtoSchema = z.object({
    id: uuidSchema,
    personId: uuidSchema,
    personName: z.string(),
    advanceDate: businessDateSchema,
    /** null when hidden (`wagesHidden`). */
    amount: z.number().nullable(),
    recoveredAmount: z.number().nullable(),
    outstanding: z.number().nullable(),
    reason: z.string(),
    status: wageAdvanceStatusSchema,
    paidAt: isoDateTimeSchema.nullable(),
    paymentMethod: labourPaymentMethodSchema.nullable(),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type WageAdvanceDto = z.infer<typeof wageAdvanceDtoSchema>;

export const wageAdvanceListDtoSchema = z.object({ items: z.array(wageAdvanceDtoSchema), wagesHidden: z.boolean() });
export type WageAdvanceListDto = z.infer<typeof wageAdvanceListDtoSchema>;

// ── requests ──

const noteField = z.string().trim().max(2000);

export const timesheetEntryInputSchema = z.object({
    personId: uuidSchema,
    days: z.union([z.literal(0.5), z.literal(1)]),
    otHours: z.number().finite().min(0).max(24).optional(),
    crewId: uuidSchema.nullable().optional(),
    costCodeId: uuidSchema.nullable().optional(),
    /** ฿/day: required when the person has no daily wage in workforce; overrides it only for `workforce.seeWages`. */
    dailyWage: amountSchema.optional(),
    /** ฿/OT hour (`workforce.seeWages` only); default daily wage / 8 × 1.5. */
    otRate: amountSchema.optional(),
    source: timesheetSourceSchema.optional(),
    note: noteField.optional(),
});
export type TimesheetEntryInput = z.infer<typeof timesheetEntryInputSchema>;

/**
 * PUT /projects/:projectId/timesheets/:date — replaces the day's draft entries of the project (approved / paid ones
 * stay; naming their person again → 409 `entry_approved`). One entry per person (422 `duplicate_person`).
 */
export const putTimesheetDayRequestSchema = z.object({
    entries: z.array(timesheetEntryInputSchema).max(500),
});
export type PutTimesheetDayRequest = z.infer<typeof putTimesheetDayRequestSchema>;

/** POST /projects/:projectId/timesheets/approve — the project's draft entries from `from` to `to` (inclusive). */
export const approveTimesheetsRequestSchema = z.object({
    from: businessDateSchema,
    to: businessDateSchema,
}).refine(v => v.from <= v.to, { message: '`from` must not be after `to`', path: ['to'] });
export type ApproveTimesheetsRequest = z.infer<typeof approveTimesheetsRequestSchema>;

/** GET /workspaces/:workspaceId/pay-periods?year= */
export const payPeriodListQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type PayPeriodListQuery = z.infer<typeof payPeriodListQuerySchema>;

/** POST /workspaces/:workspaceId/pay-periods/:periodKey/pay */
export const payPayPeriodRequestSchema = z.object({
    paymentMethod: labourPaymentMethodSchema,
    /** Business date of the payment (default today). */
    paidDate: businessDateSchema.optional(),
});
export type PayPayPeriodRequest = z.infer<typeof payPayPeriodRequestSchema>;

/** GET /workspaces/:workspaceId/wage-advances?personId=&status= */
export const wageAdvanceListQuerySchema = z.object({
    personId: uuidSchema.optional(),
    status: wageAdvanceStatusSchema.optional(),
});
export type WageAdvanceListQuery = z.infer<typeof wageAdvanceListQuerySchema>;

/** POST /workspaces/:workspaceId/wage-advances — `paymentMethod` given = paid at once (`lb.advance_paid`). */
export const createWageAdvanceRequestSchema = z.object({
    personId: uuidSchema,
    advanceDate: businessDateSchema,
    amount: amountSchema.refine(v => v > 0, { message: 'Must be above 0' }),
    reason: z.string().trim().max(500).optional(),
    paymentMethod: labourPaymentMethodSchema.optional(),
});
export type CreateWageAdvanceRequest = z.infer<typeof createWageAdvanceRequestSchema>;

/**
 * PATCH /wage-advances/:advanceId — date / amount only before it is paid; `paymentMethod` marks it paid;
 * `status: 'written_off'` stops recovering what is left.
 */
export const patchWageAdvanceRequestSchema = z.object({
    advanceDate: businessDateSchema.optional(),
    amount: amountSchema.refine(v => v > 0, { message: 'Must be above 0' }).optional(),
    reason: z.string().trim().max(500).optional(),
    paymentMethod: labourPaymentMethodSchema.optional(),
    status: z.literal('written_off').optional(),
}).refine(v => Object.keys(v).length > 0, { message: 'Nothing to change' });
export type PatchWageAdvanceRequest = z.infer<typeof patchWageAdvanceRequestSchema>;
