// ─── Variation orders (งานเพิ่ม-ลด, docs/erp/02-domain-model.md §5, WP-33) ───
// A VO changes the signed main contract: `draft → (pending_approval →) submitted → accepted | rejected | withdrawn`,
// `draft → cancelled`. Submitting issues the `VO` number; accepting (customer link or recorded with evidence) changes
// the cost codes' budget, the contract value, the finish date and the milestones in one transaction.
// Amounts are signed (a VO may remove work) and exclude VAT; `vat` is the VAT on `sellTotal` at the contract's rate.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { fileDtoSchema } from '../files';
import { businessDateSchema, docLanguageSchema, quantitySchema, unitPriceSchema } from './common';
import { CONTRACT_VARIATION_BILLINGS } from './main-contracts';
import { quotationCustomerSnapshotSchema } from './quotations';

export const VARIATION_STATUSES = ['draft', 'pending_approval', 'submitted', 'accepted', 'rejected', 'withdrawn', 'cancelled'] as const;
export const variationStatusSchema = z.enum(VARIATION_STATUSES);
export type VariationStatus = z.infer<typeof variationStatusSchema>;
/** Not answered yet: counted as "open" on the hub. */
export const VARIATION_OPEN_STATUSES: readonly VariationStatus[] = ['draft', 'pending_approval', 'submitted'];

export const VARIATION_REASONS = ['owner_request', 'design_change', 'site_condition', 'omission', 'other'] as const;
export const variationReasonSchema = z.enum(VARIATION_REASONS);
export type VariationReason = z.infer<typeof variationReasonSchema>;

export const variationBillingSchema = z.enum(CONTRACT_VARIATION_BILLINGS);

export const VARIATION_LINE_SOURCES = ['manual', 'calculator'] as const;
export type VariationLineSource = (typeof VARIATION_LINE_SOURCES)[number];

export const VARIATION_EVIDENCE_KINDS = ['photo', 'note', 'document'] as const;
export const variationEvidenceKindSchema = z.enum(VARIATION_EVIDENCE_KINDS);
export type VariationEvidenceKind = z.infer<typeof variationEvidenceKindSchema>;

/** What the customer (or the team, recording it) may answer. */
export const VARIATION_RESPONSE_ACTIONS = ['accept', 'reject'] as const;
export type VariationResponseAction = (typeof VARIATION_RESPONSE_ACTIONS)[number];

/**
 * Calculator inputs and BOQ edits of the VO, laid over the baseline snapshot (same shapes as `Project.calculators` /
 * `Project.boqOverrides`): a calculator id here replaces the baseline's input, a line key replaces its override.
 */
export const variationSandboxSchema = z.object({
    calculators: z.record(z.string(), z.unknown()),
    boqOverrides: z.record(z.string(), z.record(z.string(), z.unknown())),
});
export type VariationSandbox = z.infer<typeof variationSandboxSchema>;
export const EMPTY_VARIATION_SANDBOX: Readonly<VariationSandbox> = { calculators: {}, boqOverrides: {} };

// ── DTOs ──

export const variationOrderLineDtoSchema = z.object({
    id: uuidSchema,
    /** null = a new item (it gets a cost code `VO{seq}-{n}` when accepted). */
    costCodeId: uuidSchema.nullable(),
    /** Code of the cost code (null for a new item before acceptance). */
    costCode: z.string().nullable(),
    sectionNo: z.number().int(),
    lineKey: z.string().nullable(),
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    qtyDelta: z.number(),
    /** Cost fields: key absent for callers without `variations.manage`. */
    costMatUnit: z.number().optional(),
    costLabUnit: z.number().optional(),
    costAmount: z.number().optional(),
    sellUnit: z.number(),
    sellAmount: z.number(),
    source: z.enum(VARIATION_LINE_SOURCES),
    sort: z.number().int(),
});
export type VariationOrderLineDto = z.infer<typeof variationOrderLineDtoSchema>;

export const variationOrderEvidenceDtoSchema = z.object({
    id: uuidSchema,
    kind: variationEvidenceKindSchema,
    file: fileDtoSchema.nullable(),
    note: z.string(),
    takenAt: isoDateTimeSchema.nullable(),
    authorUserId: uuidSchema,
    createdAt: isoDateTimeSchema,
});
export type VariationOrderEvidenceDto = z.infer<typeof variationOrderEvidenceDtoSchema>;

const variationOrderBase = {
    id: uuidSchema,
    projectId: uuidSchema,
    contractId: uuidSchema,
    seqNo: z.number().int(),
    /** `VO…`, set when submitted. */
    number: z.string().nullable(),
    title: z.string(),
    reason: variationReasonSchema,
    requestedByName: z.string(),
    requestedDate: businessDateSchema.nullable(),
    status: variationStatusSchema,
    /** Key absent for callers without `variations.manage`. */
    costTotal: z.number().optional(),
    sellTotal: z.number(),
    vat: z.number(),
    scheduleImpactDays: z.number().int(),
    billing: variationBillingSchema,
    language: docLanguageSchema,
    submittedAt: isoDateTimeSchema.nullable(),
    acceptedAt: isoDateTimeSchema.nullable(),
    acceptedByName: z.string(),
    responseNote: z.string(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
};

export const variationOrderSummaryDtoSchema = z.object({ ...variationOrderBase, lineCount: z.number().int(), evidenceCount: z.number().int() });
export type VariationOrderSummaryDto = z.infer<typeof variationOrderSummaryDtoSchema>;
export const variationOrderListDtoSchema = z.array(variationOrderSummaryDtoSchema);

export const variationOrderDtoSchema = z.object({
    ...variationOrderBase,
    sandbox: variationSandboxSchema,
    /** Set when submitted. */
    customerSnapshot: quotationCustomerSnapshotSchema.nullable(),
    lines: z.array(variationOrderLineDtoSchema),
    evidence: z.array(variationOrderEvidenceDtoSchema),
    /** The caller may edit (draft, `variations.manage`, project not archived). */
    canEdit: z.boolean(),
    createdBy: uuidSchema,
});
export type VariationOrderDto = z.infer<typeof variationOrderDtoSchema>;

/** Customer link payload (subject `variation`): never costs. */
export const variationLinkPayloadSchema = z.object({
    variation: variationOrderDtoSchema,
    projectName: z.string(),
    contractNumber: z.string().nullable(),
});
export type VariationLinkPayload = z.infer<typeof variationLinkPayloadSchema>;

// ── Requests ──

const titleField = z.string().trim().max(200);
const nameField = z.string().trim().max(200);
const noteField = z.string().max(4000);

/** POST /projects/:projectId/variations — the project needs a signed main contract. */
export const createVariationOrderRequestSchema = z.object({
    title: titleField.min(1),
    reason: variationReasonSchema.optional(),
    requestedByName: nameField.min(1),
    requestedDate: businessDateSchema.optional(),
    /** Default: `next_claim` on a progress-billed contract, `spread` on a milestone-billed one. */
    billing: variationBillingSchema.optional(),
    scheduleImpactDays: z.number().int().min(-3650).max(3650).optional(),
    language: docLanguageSchema.optional(),
}).strict();
export type CreateVariationOrderRequest = z.infer<typeof createVariationOrderRequestSchema>;

/** PATCH /variations/:variationId — draft only; only the fields sent change. */
export const patchVariationOrderRequestSchema = z.object({
    title: titleField.min(1).optional(),
    reason: variationReasonSchema.optional(),
    requestedByName: nameField.min(1).optional(),
    requestedDate: businessDateSchema.nullable().optional(),
    billing: variationBillingSchema.optional(),
    scheduleImpactDays: z.number().int().min(-3650).max(3650).optional(),
    language: docLanguageSchema.optional(),
    sandbox: variationSandboxSchema.optional(),
}).strict();
export type PatchVariationOrderRequest = z.infer<typeof patchVariationOrderRequestSchema>;

/** One line as the editor sends it; sell prices are computed by the server. */
export const variationOrderLineInputSchema = z.object({
    /** Existing cost code; omitted / null = a new item (then `sectionNo`, `descTh`, `unit` are used). */
    costCodeId: uuidSchema.nullable().optional(),
    sectionNo: z.number().int().min(0).max(999).optional(),
    descTh: z.string().trim().max(500).optional(),
    descEn: z.string().trim().max(500).optional(),
    unit: z.string().trim().max(40).optional(),
    qtyDelta: quantitySchema,
    costMatUnit: unitPriceSchema,
    costLabUnit: unitPriceSchema,
}).strict().superRefine((l, ctx) => {
    if (l.costCodeId !== undefined && l.costCodeId !== null) return;
    if (l.descTh === undefined || l.descTh === '') ctx.addIssue({ code: 'custom', path: ['descTh'], message: 'A new item needs descTh' });
    if (l.sectionNo === undefined) ctx.addIssue({ code: 'custom', path: ['sectionNo'], message: 'A new item needs sectionNo' });
});
export type VariationOrderLineInput = z.infer<typeof variationOrderLineInputSchema>;

/** PUT /variations/:variationId/lines — the manual lines as a whole (calculator lines are kept). */
export const putVariationOrderLinesRequestSchema = z.object({
    lines: z.array(variationOrderLineInputSchema).max(1000),
}).strict();
export type PutVariationOrderLinesRequest = z.infer<typeof putVariationOrderLinesRequestSchema>;

/** POST /variations/:variationId/compute — replaces the calculator lines from the sandbox (sent here or stored). */
export const computeVariationOrderRequestSchema = z.object({
    sandbox: variationSandboxSchema.optional(),
}).strict();
export type ComputeVariationOrderRequest = z.infer<typeof computeVariationOrderRequestSchema>;

/** POST /variations/:variationId/evidence — a photo / document (purpose `variation_evidence`) or a note. */
export const addVariationEvidenceRequestSchema = z.object({
    kind: variationEvidenceKindSchema,
    fileId: uuidSchema.optional(),
    note: noteField.optional(),
    takenAt: isoDateTimeSchema.optional(),
}).strict().superRefine((e, ctx) => {
    if (e.kind !== 'note' && e.fileId === undefined) ctx.addIssue({ code: 'custom', path: ['fileId'], message: 'A photo or document needs fileId' });
    if (e.kind === 'note' && (e.note === undefined || e.note.trim() === '')) ctx.addIssue({ code: 'custom', path: ['note'], message: 'A note needs text' });
});
export type AddVariationEvidenceRequest = z.infer<typeof addVariationEvidenceRequestSchema>;

/** POST /variations/:variationId/record-response — the team records the customer's answer (accept needs evidence). */
export const recordVariationResponseRequestSchema = z.object({
    action: z.enum(VARIATION_RESPONSE_ACTIONS),
    name: nameField.min(1),
    note: noteField.optional(),
    /** When the customer answered (default now). */
    at: isoDateTimeSchema.optional(),
}).strict();
export type RecordVariationResponseRequest = z.infer<typeof recordVariationResponseRequestSchema>;
