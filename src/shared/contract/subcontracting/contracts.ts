// ─── Subcontracting contract: subcontracts, variations, claims, retention, ratings, overview, report, settings ───
// Both sides read the same SubcontractDto (it holds only agreed facts, no BOQ estimate).
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { fileDtoSchema } from '../files';
import {
    dateSchema, installmentSchema, locationSchema, moneySchema, packageTermsSchema, scheduleSchema,
    signedMoneySchema, tradeIdSchema,
} from './common';
import { packageStatusSchema } from './packages';

export const SUBCONTRACT_STATUSES = ['pending_acceptance', 'active', 'completed', 'closed', 'cancelled', 'terminated'] as const;
export const subcontractStatusSchema = z.enum(SUBCONTRACT_STATUSES);
export type SubcontractStatus = z.infer<typeof subcontractStatusSchema>;

export const CLAIM_STATUSES = ['requested', 'inspected', 'approved', 'paid', 'rejected'] as const;
export const claimStatusSchema = z.enum(CLAIM_STATUSES);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export const inspectionResultSchema = z.enum(['pass', 'pass_with_fixes', 'fail']);
export type InspectionResult = z.infer<typeof inspectionResultSchema>;

export const subcontractTermsSchema = packageTermsSchema.extend({
    /** Withholding tax on the labour part (0.03 = 3 %); 0 = not shown. */
    whtPct: z.number().finite().min(0).max(0.15),
    /** Add VAT 7 % to claims (vendor is VAT-registered). */
    vat: z.boolean(),
});
export type SubcontractTerms = z.infer<typeof subcontractTermsSchema>;

export const subcontractLineDtoSchema = z.object({
    idx: z.number().int(),
    desc: z.string(),
    unit: z.string(),
    qty: z.number(),
    unitPrice: z.number().nullable(),
    matUnitPrice: z.number().nullable(),
    total: z.number(),
});
export type SubcontractLineDto = z.infer<typeof subcontractLineDtoSchema>;

export const installmentStateSchema = installmentSchema.extend({
    amount: z.number(),
    /** Latest non-rejected claim of this installment. */
    claimId: uuidSchema.nullable(),
    state: z.enum(['not_started', 'requested', 'inspected', 'approved', 'paid']),
});

export const retentionSummarySchema = z.object({
    withheld: z.number(),
    released: z.number(),
    forfeited: z.number(),
    balance: z.number(),
    /** Planned releases (default: half at completion, the rest when the warranty ends). */
    schedule: z.array(z.object({ amount: z.number(), dueAt: dateSchema.nullable(), label: z.string() })),
});
export type RetentionSummary = z.infer<typeof retentionSummarySchema>;

export const subcontractSummaryDtoSchema = z.object({
    id: uuidSchema,
    contractNo: z.string(),
    projectId: uuidSchema,
    projectName: z.string(),
    packageId: uuidSchema,
    buyerWorkspaceId: uuidSchema,
    buyerName: z.string(),
    /** null while the winner has no account yet (a price the buyer typed in); linked when the crew signs up. */
    vendorWorkspaceId: uuidSchema.nullable(),
    vendorName: z.string(),
    title: z.string(),
    trade: tradeIdSchema,
    status: subcontractStatusSchema,
    total: z.number(),
    paidTotal: z.number(),
    retentionBalance: z.number(),
    /** Number of the next installment not yet paid (null when all paid). */
    nextInstallment: z.number().int().nullable(),
    pendingAction: z.enum(['none', 'vendor_accept', 'buyer_inspect', 'buyer_approve', 'buyer_pay', 'variation_response']),
    createdAt: isoDateTimeSchema,
});
export type SubcontractSummaryDto = z.infer<typeof subcontractSummaryDtoSchema>;

export const subcontractDtoSchema = z.object({
    ...subcontractSummaryDtoSchema.shape,
    location: locationSchema,
    lines: z.array(subcontractLineDtoSchema),
    baseTotal: z.number(),
    variationsTotal: z.number(),
    terms: subcontractTermsSchema,
    schedule: scheduleSchema,
    installments: z.array(installmentStateSchema),
    documentVersion: z.number().int(),
    documentPdf: fileDtoSchema.nullable(),
    signedScan: fileDtoSchema.nullable(),
    acceptedAt: isoDateTimeSchema.nullable(),
    activatedAt: isoDateTimeSchema.nullable(),
    completedAt: isoDateTimeSchema.nullable(),
    closedAt: isoDateTimeSchema.nullable(),
    cancelledAt: isoDateTimeSchema.nullable(),
    terminatedAt: isoDateTimeSchema.nullable(),
    endReason: z.string().nullable(),
    changeRequests: z.array(z.object({ text: z.string(), at: isoDateTimeSchema, resolved: z.boolean() })),
    retention: retentionSummarySchema,
    myRating: z.object({ submitted: z.boolean() }),
    /** Who the caller is in this contract. */
    viewerSide: z.enum(['buyer', 'vendor']),
    /** The buyer's subcontracting module is on: false = read-only for both sides (hide every action). */
    buyerModuleOn: z.boolean(),
});
export type SubcontractDto = z.infer<typeof subcontractDtoSchema>;

/** GET /subcontracting/subcontracts/:id/document → the contract text (HTML) of the current version. */
export const contractDocumentDtoSchema = z.object({ version: z.number().int(), html: z.string(), editable: z.boolean() });
export type ContractDocumentDto = z.infer<typeof contractDocumentDtoSchema>;

/** PUT …/document (buyer, before acceptance) → new version; the vendor must accept again. */
export const updateContractDocumentRequestSchema = z.object({ html: z.string().min(1).max(200_000) });
export type UpdateContractDocumentRequest = z.infer<typeof updateContractDocumentRequestSchema>;

export const acceptSubcontractRequestSchema = z.object({ documentVersion: z.number().int().min(1) });
export type AcceptSubcontractRequest = z.infer<typeof acceptSubcontractRequestSchema>;

export const requestChangeRequestSchema = z.object({ text: z.string().trim().min(1).max(2000) });
export type RequestChangeRequest = z.infer<typeof requestChangeRequestSchema>;

export const endSubcontractRequestSchema = z.object({ reason: z.string().trim().min(1).max(1000) });
export type EndSubcontractRequest = z.infer<typeof endSubcontractRequestSchema>;

export const attachScanRequestSchema = z.object({ fileId: uuidSchema });
export type AttachScanRequest = z.infer<typeof attachScanRequestSchema>;

// ── Variations (งานเพิ่ม-ลด) ──

export const variationLineSchema = z.object({
    desc: z.string().trim().min(1).max(300),
    unit: z.string().trim().min(1).max(20),
    qty: z.number().finite().min(-1e9).max(1e9),
    unitPrice: moneySchema,
});

export const proposeVariationRequestSchema = z.object({
    lines: z.array(variationLineSchema).min(1).max(100),
    reason: z.string().trim().min(1).max(1000),
});
export type ProposeVariationRequest = z.infer<typeof proposeVariationRequestSchema>;

export const variationDtoSchema = z.object({
    id: uuidSchema,
    proposedBy: z.enum(['buyer', 'vendor']),
    lines: z.array(variationLineSchema.extend({ total: z.number() })),
    amount: z.number(),
    reason: z.string(),
    status: z.enum(['proposed', 'accepted', 'rejected']),
    createdAt: isoDateTimeSchema,
    decidedAt: isoDateTimeSchema.nullable(),
});
export type VariationDto = z.infer<typeof variationDtoSchema>;

export const respondVariationRequestSchema = z.object({ accept: z.boolean() });
export type RespondVariationRequest = z.infer<typeof respondVariationRequestSchema>;

// ── Claims (ใบเบิกงวด) ──

export const claimAdjustmentSchema = z.object({ label: z.string().trim().min(1).max(200), amount: signedMoneySchema });

export const claimAmountsSchema = z.object({
    /** Installment amount (pct × contract total; the last installment absorbs variations and rounding). */
    gross: z.number(),
    adjustments: z.array(claimAdjustmentSchema),
    retention: z.number(),
    wht: z.number(),
    vat: z.number(),
    /** gross + Σadjustments − retention − wht + vat. */
    net: z.number(),
});
export type ClaimAmounts = z.infer<typeof claimAmountsSchema>;

export const claimDtoSchema = z.object({
    id: uuidSchema,
    subcontractId: uuidSchema,
    installmentNo: z.number().int(),
    condition: z.string(),
    status: claimStatusSchema,
    requestedBy: z.enum(['buyer', 'vendor']),
    requestedAt: isoDateTimeSchema,
    note: z.string(),
    photos: z.array(fileDtoSchema),
    inspection: z.object({
        result: inspectionResultSchema,
        checklist: z.array(z.object({ item: z.string(), ok: z.boolean() })),
        fixes: z.array(z.object({ text: z.string(), done: z.boolean() })),
        note: z.string(),
        byName: z.string(),
        at: isoDateTimeSchema,
    }).nullable(),
    amounts: claimAmountsSchema,
    approvedAt: isoDateTimeSchema.nullable(),
    paidAt: dateSchema.nullable(),
    paidAmount: z.number().nullable(),
    paidChannel: z.string().nullable(),
    paidRef: z.string().nullable(),
    rejectedReason: z.string().nullable(),
});
export type ClaimDto = z.infer<typeof claimDtoSchema>;

/** POST /subcontracting/subcontracts/:id/claims — the vendor, or the buyer on its behalf (one path for both sides). */
export const requestClaimRequestSchema = z.object({
    installmentNo: z.number().int().min(1),
    note: z.string().trim().max(2000).default(''),
    photoFileIds: z.array(uuidSchema).max(10),
});
export type RequestClaimRequest = z.infer<typeof requestClaimRequestSchema>;

export const inspectClaimRequestSchema = z.object({
    result: inspectionResultSchema,
    checklist: z.array(z.object({ item: z.string().trim().min(1).max(200), ok: z.boolean() })).max(40),
    fixes: z.array(z.object({ text: z.string().trim().min(1).max(300), done: z.boolean() })).max(40),
    note: z.string().trim().max(2000).default(''),
});
export type InspectClaimRequest = z.infer<typeof inspectClaimRequestSchema>;

export const approveClaimRequestSchema = z.object({ adjustments: z.array(claimAdjustmentSchema).max(20) });
export type ApproveClaimRequest = z.infer<typeof approveClaimRequestSchema>;

export const payClaimRequestSchema = z.object({
    paidAt: dateSchema,
    amount: moneySchema,
    channel: z.string().trim().max(60).default(''),
    ref: z.string().trim().max(120).default(''),
});
export type PayClaimRequest = z.infer<typeof payClaimRequestSchema>;

export const rejectClaimRequestSchema = z.object({ reason: z.string().trim().min(1).max(1000) });
export type RejectClaimRequest = z.infer<typeof rejectClaimRequestSchema>;

/** Inspection checklist suggested per trade (GET /subcontracting/checklists). */
export const tradeChecklistsDtoSchema = z.record(tradeIdSchema, z.array(z.string()));

// ── Retention ──

export const retentionEntryDtoSchema = z.object({
    id: uuidSchema,
    kind: z.enum(['withheld', 'released', 'forfeited']),
    amount: z.number(),
    claimId: uuidSchema.nullable(),
    note: z.string(),
    at: isoDateTimeSchema,
});
export type RetentionEntryDto = z.infer<typeof retentionEntryDtoSchema>;

export const retentionMoveRequestSchema = z.object({
    amount: z.number().finite().positive().max(1e11),
    note: z.string().trim().max(500).default(''),
});
export type RetentionMoveRequest = z.infer<typeof retentionMoveRequestSchema>;

/** GET /workspaces/:ws/subcontracting/retention — every contract with a retention balance. */
export const workspaceRetentionRowSchema = z.object({
    subcontractId: uuidSchema,
    contractNo: z.string(),
    projectName: z.string(),
    vendorName: z.string(),
    balance: z.number(),
    nextDueAt: dateSchema.nullable(),
    status: subcontractStatusSchema,
});
export const workspaceRetentionDtoSchema = z.array(workspaceRetentionRowSchema);
export type WorkspaceRetentionRow = z.infer<typeof workspaceRetentionRowSchema>;

// ── Ratings ──

export const ratingRequestSchema = z.object({
    /** Buyer → vendor: quality, time, communication. Vendor → buyer: payment, communication. Scores 1–5. */
    scores: z.record(z.enum(['quality', 'time', 'communication', 'payment']), z.number().int().min(1).max(5)),
    comment: z.string().trim().max(1000).default(''),
});
export type RatingRequest = z.infer<typeof ratingRequestSchema>;

// ── Project overview + report (buyer) ──

export const tradeRowStatusSchema = z.enum(['not_sourced', 'waiting_bids', 'has_bids', 'contracted', 'problem']);

export const procurementOverviewDtoSchema = z.object({
    projectId: uuidSchema,
    /** Σ labour (and material where vendor-supplied) estimates of every trade with BOQ quantities. */
    estimateTotal: z.number(),
    contractedTotal: z.number(),
    /** Share of the BOQ labour value covered by subcontracts (0–1). */
    coverage: z.number(),
    trades: z.array(z.object({
        trade: tradeIdSchema,
        /**
         * Whole-trade estimate from the live BOQ while nothing is contracted; once the trade has live subcontracts, the
         * estimate of the contracted scope only (Σ estTotal of the awarded package lines), so `contracted − estimate`
         * compares like with like. 0 for members without sc.readPrices.
         */
        estimate: z.number(),
        contracted: z.number(),
        status: tradeRowStatusSchema,
        problem: z.string().nullable(),
        packages: z.array(z.object({ id: uuidSchema, title: z.string(), status: packageStatusSchema })),
        subcontracts: z.array(z.object({ id: uuidSchema, vendorName: z.string(), total: z.number() })),
    })),
    todo: z.array(z.object({
        kind: z.enum(['claim_to_inspect', 'claim_to_approve', 'claim_to_pay', 'deadline_today', 'deadline_passed', 'boq_changed', 'awaiting_acceptance', 'retention_due']),
        label: z.string(),
        href: z.string(),
    })),
});
export type ProcurementOverviewDto = z.infer<typeof procurementOverviewDtoSchema>;

export const procurementReportDtoSchema = z.object({
    rows: z.array(z.object({
        trade: tradeIdSchema,
        estimate: z.number(),
        contracted: z.number(),
        paid: z.number(),
        /** contracted − estimate. */
        diff: z.number(),
    })),
    totals: z.object({ estimate: z.number(), contracted: z.number(), paid: z.number(), diff: z.number() }),
});
export type ProcurementReportDto = z.infer<typeof procurementReportDtoSchema>;

// ── Workspace settings of the module ──

export const subcontractingSettingsDtoSchema = z.object({
    defaultRetentionPct: z.number().finite().min(0).max(0.3),
    defaultWarrantyMonths: z.number().int().min(0).max(120),
    defaultWhtPct: z.number().finite().min(0).max(0.15),
    estimatorCanAward: z.boolean(),
    estimatorCanApproveClaims: z.boolean(),
    viewerSeesPrices: z.boolean(),
    /** Flag bids that differ from the estimate by more than this fraction. */
    levelingThreshold: z.number().finite().min(0.01).max(2),
    /** Fixes must be closed before the next installment can be approved. */
    fixesBlockNextClaim: z.boolean(),
    /** Contract template (HTML with {{placeholders}}); '' = built-in Thai template. */
    contractTemplateHtml: z.string().max(200_000),
});
export type SubcontractingSettingsDto = z.infer<typeof subcontractingSettingsDtoSchema>;
export const putSubcontractingSettingsRequestSchema = subcontractingSettingsDtoSchema;
export type PutSubcontractingSettingsRequest = SubcontractingSettingsDto;

/** Writing the planned dates/costs of a contract back into the S-Curve actual rows is done on the client (project doc). */
export const scheduleWritebackHintSchema = z.object({ taskIds: z.array(z.string()), start: dateSchema.nullable(), cost: z.number() });
