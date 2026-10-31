// ─── Main contracts with the project owner (docs/erp/02-domain-model.md §3, WP-26) ───
// One effective contract per project (D-26): `draft → signed → completed → closed`, `draft → cancelled`,
// `signed → terminated`. Signing issues the `CT` number, locks the BOQ baseline when it is not locked yet, spreads the
// contract value over the cost codes and fixes the milestone amounts. Amounts exclude VAT.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { fileDtoSchema } from '../files';
import { amountSchema, businessDateSchema, docLanguageSchema, rateSchema } from './common';
import { BILLING_MODES } from './company';
import { quotationCompanySnapshotSchema, quotationCustomerSnapshotSchema } from './quotations';

export const MAIN_CONTRACT_STATUSES = ['draft', 'signed', 'completed', 'closed', 'cancelled', 'terminated'] as const;
export const mainContractStatusSchema = z.enum(MAIN_CONTRACT_STATUSES);
export type MainContractStatus = z.infer<typeof mainContractStatusSchema>;
/** Statuses that no longer count as the project's contract (another one may be made). */
export const MAIN_CONTRACT_ENDED_STATUSES: readonly MainContractStatus[] = ['cancelled', 'terminated'];

export const mainContractBillingModeSchema = z.enum(BILLING_MODES);
export type MainContractBillingMode = z.infer<typeof mainContractBillingModeSchema>;

export const CONTRACT_MILESTONE_KINDS = ['advance', 'work', 'final'] as const;
export type ContractMilestoneKind = (typeof CONTRACT_MILESTONE_KINDS)[number];
export const CONTRACT_MILESTONE_TRIGGERS = ['signing', 'progress', 'date', 'handover', 'manual'] as const;
export type ContractMilestoneTrigger = (typeof CONTRACT_MILESTONE_TRIGGERS)[number];
export const CONTRACT_MILESTONE_STATUSES = ['planned', 'claimable', 'claimed', 'invoiced', 'paid'] as const;
export const contractMilestoneStatusSchema = z.enum(CONTRACT_MILESTONE_STATUSES);
export type ContractMilestoneStatus = z.infer<typeof contractMilestoneStatusSchema>;
export const CONTRACT_MILESTONE_SOURCES = ['contract', 'variation'] as const;
export type ContractMilestoneSource = (typeof CONTRACT_MILESTONE_SOURCES)[number];

export const GUARANTEE_KINDS = ['performance', 'advance_payment', 'warranty'] as const;
export const GUARANTEE_FORMS = ['bank_guarantee', 'cash', 'cheque', 'bond'] as const;
export const GUARANTEE_STATUSES = ['active', 'returned', 'claimed', 'expired'] as const;
export type GuaranteeKind = (typeof GUARANTEE_KINDS)[number];
export type GuaranteeForm = (typeof GUARANTEE_FORMS)[number];
export type GuaranteeStatus = (typeof GUARANTEE_STATUSES)[number];

export const RETENTION_RELEASES = ['half_at_completion_half_after_warranty', 'all_after_warranty', 'all_at_completion'] as const;
export const PENALTY_BASES = ['contract_value', 'remaining_work'] as const;

/** How an accepted variation reaches the milestones (D-41: `next_claim` only on progress-billed contracts). */
export const CONTRACT_VARIATION_BILLINGS = ['next_claim', 'spread', 'separate_milestone'] as const;
export type ContractVariationBilling = (typeof CONTRACT_VARIATION_BILLINGS)[number];

/** Tolerance of "the work + final shares add up to 100%". */
export const MILESTONE_PCT_TOLERANCE = 1e-6;

// ── Terms ──

export const escalationTermsSchema = z.object({
    enabled: z.boolean(),
    /** Fixed part of the K formula (D-13: entered per contract). */
    fixed: z.number().finite().min(0).max(1),
    terms: z.array(z.object({
        index: z.string().trim().min(1).max(40),
        weight: z.number().finite().min(0).max(1),
        baseValue: z.number().finite().gt(0).max(1e9),
    })).max(20),
    /** Change of K below which nothing is paid (0.04 = 4%). */
    threshold: z.number().finite().min(0).max(1),
});

export const mainContractTermsSchema = z.object({
    advancePct: z.number().finite().min(0).max(0.3),
    retentionPct: z.number().finite().min(0).max(0.1),
    /** Cap of the retention held, as a share of the contract value; null = no cap. */
    retentionCapPct: rateSchema.nullable(),
    retentionRelease: z.enum(RETENTION_RELEASES),
    customerWhtRate: rateSchema,
    /** Share of the base per day late. */
    penaltyRatePerDay: rateSchema,
    penaltyBase: z.enum(PENALTY_BASES),
    penaltyCapPct: rateSchema,
    warrantyMonths: z.number().int().min(0).max(240),
    guaranteePct: rateSchema,
    paymentTermDays: z.number().int().min(0).max(365),
    escalation: escalationTermsSchema.nullable(),
});
export type MainContractTerms = z.infer<typeof mainContractTermsSchema>;

// ── DTOs ──

export const contractMilestoneDtoSchema = z.object({
    id: uuidSchema,
    no: z.number().int(),
    labelTh: z.string(),
    labelEn: z.string(),
    kind: z.enum(CONTRACT_MILESTONE_KINDS),
    pct: z.number(),
    amount: z.number(),
    trigger: z.enum(CONTRACT_MILESTONE_TRIGGERS),
    triggerProgress: z.number().nullable(),
    dueDate: businessDateSchema.nullable(),
    costCodeIds: z.array(uuidSchema),
    /** `planned` turns `claimable` on read once its trigger is met (signed, progress reached, due date reached). */
    status: contractMilestoneStatusSchema,
    source: z.enum(CONTRACT_MILESTONE_SOURCES),
    variationId: uuidSchema.nullable(),
});
export type ContractMilestoneDto = z.infer<typeof contractMilestoneDtoSchema>;

export const contractGuaranteeDtoSchema = z.object({
    id: uuidSchema,
    contractId: uuidSchema,
    projectId: uuidSchema,
    kind: z.enum(GUARANTEE_KINDS),
    form: z.enum(GUARANTEE_FORMS),
    issuer: z.string(),
    refNo: z.string(),
    amount: z.number(),
    issueDate: businessDateSchema.nullable(),
    expiryDate: businessDateSchema.nullable(),
    status: z.enum(GUARANTEE_STATUSES),
    returnedAt: businessDateSchema.nullable(),
    files: z.array(fileDtoSchema),
    note: z.string(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type ContractGuaranteeDto = z.infer<typeof contractGuaranteeDtoSchema>;
export const contractGuaranteeListDtoSchema = z.array(contractGuaranteeDtoSchema);

export const mainContractDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    customerId: uuidSchema,
    quotationId: uuidSchema.nullable(),
    quotationVersionId: uuidSchema.nullable(),
    /** Margin of the accepted quotation version; key absent for callers without `quotations.seeMargins`. */
    quotedMarginPct: z.number().nullable().optional(),
    number: z.string().nullable(),
    status: mainContractStatusSchema,
    title: z.string(),
    language: docLanguageSchema,
    signDate: businessDateSchema.nullable(),
    startDate: businessDateSchema.nullable(),
    /** Grows with the extension days of accepted variations. */
    finishDate: businessDateSchema.nullable(),
    durationDays: z.number().int().nullable(),
    billingMode: mainContractBillingModeSchema,
    originalValue: z.number(),
    /** original + Σ accepted variations (no VAT). */
    currentValue: z.number(),
    vatRate: z.number(),
    extensionDays: z.number().int(),
    terms: mainContractTermsSchema,
    /** Sanitized HTML with `{{placeholders}}` (src/domain/erp/main-contract-template.ts fills them when printing). */
    bodyTh: z.string(),
    bodyEn: z.string(),
    /** Set when signed. */
    customerSnapshot: quotationCustomerSnapshotSchema.nullable(),
    companySnapshot: quotationCompanySnapshotSchema.nullable(),
    signedScans: z.array(fileDtoSchema),
    completedAt: businessDateSchema.nullable(),
    closedAt: businessDateSchema.nullable(),
    terminatedAt: businessDateSchema.nullable(),
    terminationReason: z.string(),
    /** Cumulative reported work progress (0–1) weighted by contract amount; null before signing. */
    progress: z.number().nullable(),
    milestones: z.array(contractMilestoneDtoSchema),
    /** The caller may edit (draft, `contracts.manage`, project not archived). */
    canEdit: z.boolean(),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type MainContractDto = z.infer<typeof mainContractDtoSchema>;

export const mainContractSummaryDtoSchema = mainContractDtoSchema.pick({
    id: true, number: true, status: true, title: true, originalValue: true, currentValue: true, signDate: true, updatedAt: true,
});
export type MainContractSummaryDto = z.infer<typeof mainContractSummaryDtoSchema>;

/** GET /projects/:projectId/main-contract: the effective contract (null = none yet) and the ended ones. */
export const projectMainContractDtoSchema = z.object({
    contract: mainContractDtoSchema.nullable(),
    ended: z.array(mainContractSummaryDtoSchema),
});
export type ProjectMainContractDto = z.infer<typeof projectMainContractDtoSchema>;

/** POST /main-contracts/:contractId/sign: the signed contract and how the value went to the cost codes. */
export const signMainContractResponseSchema = z.object({
    contract: mainContractDtoSchema,
    allocation: z.object({
        /** Manual cost codes made for quotation lines without a baseline cost code. */
        created: z.number().int(),
        /** Baseline cost codes left without a selling amount. */
        uncoveredCount: z.number().int(),
    }),
    /** The baseline was locked by this signature (false = it was locked already). */
    baselineLocked: z.boolean(),
});
export type SignMainContractResponse = z.infer<typeof signMainContractResponseSchema>;

// ── Requests ──

const titleField = z.string().trim().max(200);
const bodyField = z.string().max(200_000);

/**
 * POST /projects/:projectId/main-contract — from an accepted quotation (`quotationId`), or empty (`customerId` +
 * `originalValue` required).
 */
export const createMainContractRequestSchema = z.object({
    quotationId: uuidSchema.optional(),
    customerId: uuidSchema.optional(),
    originalValue: amountSchema.optional(),
    title: titleField.optional(),
    language: docLanguageSchema.optional(),
    billingMode: mainContractBillingModeSchema.optional(),
    startDate: businessDateSchema.optional(),
    finishDate: businessDateSchema.optional(),
}).strict().superRefine((v, ctx) => {
    if (v.quotationId !== undefined) return;
    if (v.customerId === undefined) ctx.addIssue({ code: 'custom', path: ['customerId'], message: 'customerId is required without a quotation' });
    if (v.originalValue === undefined) ctx.addIssue({ code: 'custom', path: ['originalValue'], message: 'originalValue is required without a quotation' });
});
export type CreateMainContractRequest = z.infer<typeof createMainContractRequestSchema>;

/** PATCH /main-contracts/:contractId — draft only; only the fields sent change. */
export const patchMainContractRequestSchema = z.object({
    title: titleField.optional(),
    language: docLanguageSchema.optional(),
    customerId: uuidSchema.optional(),
    originalValue: amountSchema.optional(),
    vatRate: rateSchema.optional(),
    billingMode: mainContractBillingModeSchema.optional(),
    signDate: businessDateSchema.nullable().optional(),
    startDate: businessDateSchema.nullable().optional(),
    finishDate: businessDateSchema.nullable().optional(),
    durationDays: z.number().int().min(1).max(36500).nullable().optional(),
    terms: mainContractTermsSchema.optional(),
    bodyTh: bodyField.optional(),
    bodyEn: bodyField.optional(),
}).strict();
export type PatchMainContractRequest = z.infer<typeof patchMainContractRequestSchema>;

/** One work / final milestone as the editor sends it (the advance one follows `terms.advancePct` by itself). */
export const contractMilestoneInputSchema = z.object({
    labelTh: z.string().trim().min(1).max(200),
    labelEn: z.string().trim().max(200),
    kind: z.enum(['work', 'final']),
    pct: z.number().finite().gt(0).max(1),
    trigger: z.enum(CONTRACT_MILESTONE_TRIGGERS),
    triggerProgress: z.number().finite().gt(0).max(1).nullable().optional(),
    dueDate: businessDateSchema.nullable().optional(),
    costCodeIds: z.array(uuidSchema).max(500).optional(),
}).strict().superRefine((m, ctx) => {
    if (m.trigger === 'progress' && (m.triggerProgress === undefined || m.triggerProgress === null)) {
        ctx.addIssue({ code: 'custom', path: ['triggerProgress'], message: 'A progress milestone needs triggerProgress' });
    }
    if (m.trigger === 'date' && (m.dueDate === undefined || m.dueDate === null)) {
        ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'A date milestone needs dueDate' });
    }
});
export type ContractMilestoneInput = z.infer<typeof contractMilestoneInputSchema>;

/** PUT /main-contracts/:contractId/milestones — the whole list, in order; shares add up to 100% (or the list is empty). */
export const putContractMilestonesRequestSchema = z.object({
    milestones: z.array(contractMilestoneInputSchema).max(60),
}).strict().superRefine((v, ctx) => {
    if (v.milestones.length === 0) return;
    const total = v.milestones.reduce((s, m) => s + m.pct, 0);
    if (Math.abs(total - 1) > MILESTONE_PCT_TOLERANCE) {
        ctx.addIssue({ code: 'custom', path: ['milestones'], message: 'Milestone shares must add up to 100%', params: { reason: 'milestone_pct_not_100' } });
    }
});
export type PutContractMilestonesRequest = z.infer<typeof putContractMilestonesRequestSchema>;

/** POST /main-contracts/:contractId/sign. `signDate` default: today (Bangkok). */
export const signMainContractRequestSchema = z.object({
    signDate: businessDateSchema.optional(),
    startDate: businessDateSchema.optional(),
}).strict();
export type SignMainContractRequest = z.infer<typeof signMainContractRequestSchema>;

export const terminateMainContractRequestSchema = z.object({
    reason: z.string().trim().min(1).max(2000),
    date: businessDateSchema.optional(),
}).strict();
export type TerminateMainContractRequest = z.infer<typeof terminateMainContractRequestSchema>;

/** POST /main-contracts/:contractId/close (completed → closed). */
export const closeMainContractRequestSchema = z.object({ date: businessDateSchema.optional() }).strict();
export type CloseMainContractRequest = z.infer<typeof closeMainContractRequestSchema>;

/** POST /main-contracts/:contractId/signed-scan — files uploaded with purpose `main_contract_scan`, appended. */
export const addSignedScanRequestSchema = z.object({ fileIds: z.array(uuidSchema).min(1).max(20) }).strict();
export type AddSignedScanRequest = z.infer<typeof addSignedScanRequestSchema>;

const guaranteeShape = {
    kind: z.enum(GUARANTEE_KINDS),
    form: z.enum(GUARANTEE_FORMS),
    issuer: z.string().trim().max(200),
    refNo: z.string().trim().max(100),
    amount: amountSchema,
    issueDate: businessDateSchema.nullable(),
    expiryDate: businessDateSchema.nullable(),
    note: z.string().trim().max(2000),
    /** Files uploaded with purpose `guarantee_scan`. */
    fileIds: z.array(uuidSchema).max(20),
};

/** POST /main-contracts/:contractId/guarantees. */
export const createGuaranteeRequestSchema = z.object({
    ...guaranteeShape,
    issuer: guaranteeShape.issuer.default(''),
    refNo: guaranteeShape.refNo.default(''),
    issueDate: guaranteeShape.issueDate.default(null),
    expiryDate: guaranteeShape.expiryDate.default(null),
    note: guaranteeShape.note.default(''),
    fileIds: guaranteeShape.fileIds.default([]),
}).strict();
export type CreateGuaranteeRequest = z.infer<typeof createGuaranteeRequestSchema>;

/** PATCH /guarantees/:guaranteeId — returning one: `{status: 'returned', returnedAt?}` (default today). */
export const patchGuaranteeRequestSchema = z.object({
    ...guaranteeShape,
    status: z.enum(GUARANTEE_STATUSES),
    returnedAt: businessDateSchema.nullable(),
}).partial().strict();
export type PatchGuaranteeRequest = z.infer<typeof patchGuaranteeRequestSchema>;
