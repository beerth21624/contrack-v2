// ─── Purchasing: purchase requests and requests for quotation (module `procurement`, docs/erp/02-domain-model.md §7.2, WP-38) ───
// PR: `draft → (pending_approval →) approved | rejected`, `approved → partially_ordered → ordered → closed` (POs, WP-39),
// `draft | pending_approval | approved → cancelled`. Submitting checks the budget per cost code (warnings need an
// `overrideReason`), issues the `PR` number and asks the approval `purchase_request.approve`.
// RFQ: `draft → sent → awarded → closed`, `draft | sent → cancelled`. Suppliers do not log in (v1, D-11): the team
// prints / sends the RFQ and types the prices received. Amounts exclude VAT unless named otherwise; money is round2.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { fileDtoSchema } from '../files';
import { businessDateSchema, docLanguageSchema, quantitySchema, unitPriceSchema } from './common';

export const PURCHASE_REQUEST_STATUSES = [
    'draft', 'pending_approval', 'approved', 'rejected', 'partially_ordered', 'ordered', 'closed', 'cancelled',
] as const;
export const purchaseRequestStatusSchema = z.enum(PURCHASE_REQUEST_STATUSES);
export type PurchaseRequestStatus = z.infer<typeof purchaseRequestStatusSchema>;
/** Approved and not fully ordered yet: lines may go into an RFQ / a PO. */
export const PURCHASE_REQUEST_ORDERABLE_STATUSES: readonly PurchaseRequestStatus[] = ['approved', 'partially_ordered'];

/** `site` = typed on site; `boq` = picked from the project's cost codes (quantity filled with what remains). */
export const PURCHASE_REQUEST_SOURCES = ['site', 'boq'] as const;
export const purchaseRequestSourceSchema = z.enum(PURCHASE_REQUEST_SOURCES);
export type PurchaseRequestSource = z.infer<typeof purchaseRequestSourceSchema>;

export const RFQ_STATUSES = ['draft', 'sent', 'awarded', 'closed', 'cancelled'] as const;
export const rfqStatusSchema = z.enum(RFQ_STATUSES);
export type RfqStatus = z.infer<typeof rfqStatusSchema>;

export const RFQ_SUPPLIER_STATUSES = ['invited', 'quoted', 'declined'] as const;
export const rfqSupplierStatusSchema = z.enum(RFQ_SUPPLIER_STATUSES);
export type RfqSupplierStatus = z.infer<typeof rfqSupplierStatusSchema>;

/** Budget warnings per cost code (pure `src/domain/procurement/budget-check.ts`). They never block: they need a reason. */
export const BUDGET_WARNING_KINDS = ['over_quantity', 'over_price', 'over_budget'] as const;
export const budgetWarningKindSchema = z.enum(BUDGET_WARNING_KINDS);
export type BudgetWarningKind = z.infer<typeof budgetWarningKindSchema>;
/** Tolerance over the budget before a warning (5%). */
export const BUDGET_TOLERANCE = 0.05;

export const budgetWarningSchema = z.object({
    kind: budgetWarningKindSchema,
    costCodeId: uuidSchema,
    /** Code of the cost code, e.g. `R58`. */
    code: z.string(),
    /** The most allowed without a warning: quantity (over_quantity), unit price (over_price), baht (over_budget). */
    limit: z.number(),
    /** What the document would reach: quantity incl. earlier requests, highest unit price, committed + actual + this. */
    value: z.number(),
});
export type BudgetWarning = z.infer<typeof budgetWarningSchema>;

// ── purchase requests ──

export const purchaseRequestLineDtoSchema = z.object({
    id: uuidSchema,
    costCodeId: uuidSchema.nullable(),
    /** Code of the cost code (null without one). */
    costCode: z.string().nullable(),
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    qty: z.number(),
    /** Estimated unit price (default: the cost code's baseline material unit cost). */
    estUnitPrice: z.number(),
    estAmount: z.number(),
    /** Quantity already put on POs (WP-39). */
    orderedQty: z.number(),
    note: z.string(),
    sort: z.number().int(),
});
export type PurchaseRequestLineDto = z.infer<typeof purchaseRequestLineDtoSchema>;

const purchaseRequestBase = {
    id: uuidSchema,
    projectId: uuidSchema,
    /** `PR…`, set when submitted. */
    number: z.string().nullable(),
    status: purchaseRequestStatusSchema,
    source: purchaseRequestSourceSchema,
    requiredDate: businessDateSchema.nullable(),
    requestedBy: uuidSchema,
    note: z.string(),
    estTotal: z.number(),
    budgetWarnings: z.array(budgetWarningSchema),
    overrideReason: z.string(),
    submittedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
};

export const purchaseRequestSummaryDtoSchema = z.object({ ...purchaseRequestBase, lineCount: z.number().int() });
export type PurchaseRequestSummaryDto = z.infer<typeof purchaseRequestSummaryDtoSchema>;
export const purchaseRequestListDtoSchema = z.array(purchaseRequestSummaryDtoSchema);

export const purchaseRequestDtoSchema = z.object({
    ...purchaseRequestBase,
    lines: z.array(purchaseRequestLineDtoSchema),
    /** The caller may edit / submit (draft, `procurement.request`, project not archived). */
    canEdit: z.boolean(),
});
export type PurchaseRequestDto = z.infer<typeof purchaseRequestDtoSchema>;

// ── RFQs ──

export const rfqLineDtoSchema = z.object({
    id: uuidSchema,
    requestLineId: uuidSchema.nullable(),
    costCodeId: uuidSchema.nullable(),
    costCode: z.string().nullable(),
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    qty: z.number(),
    /** Unit price a line nobody quotes is counted at in the normalized comparison (the PR's estimate). */
    budgetUnitPrice: z.number(),
    sort: z.number().int(),
});
export type RfqLineDto = z.infer<typeof rfqLineDtoSchema>;

export const rfqSupplierDtoSchema = z.object({
    supplierId: uuidSchema,
    nameTh: z.string(),
    nameEn: z.string(),
    phone: z.string(),
    email: z.string(),
    status: rfqSupplierStatusSchema,
    invitedAt: isoDateTimeSchema,
    quotedAt: isoDateTimeSchema.nullable(),
});
export type RfqSupplierDto = z.infer<typeof rfqSupplierDtoSchema>;

/** One priced line of a supplier's quote; `available: false` = the supplier does not offer it. */
export const rfqQuoteLineSchema = z.object({
    rfqLineId: uuidSchema,
    unitPrice: z.number(),
    amount: z.number(),
    available: z.boolean(),
    note: z.string(),
});
export type RfqQuoteLine = z.infer<typeof rfqQuoteLineSchema>;

export const rfqQuoteDtoSchema = z.object({
    id: uuidSchema,
    supplierId: uuidSchema,
    quoteRef: z.string(),
    quoteDate: businessDateSchema.nullable(),
    validUntil: businessDateSchema.nullable(),
    /** The prices typed include VAT (subtotal / vat / total are split from them). */
    pricesIncludeVat: z.boolean(),
    deliveryDays: z.number().int().nullable(),
    paymentTermDays: z.number().int().nullable(),
    lines: z.array(rfqQuoteLineSchema),
    /** Without VAT. */
    subtotal: z.number(),
    vat: z.number(),
    total: z.number(),
    files: z.array(fileDtoSchema),
    note: z.string(),
    updatedAt: isoDateTimeSchema,
});
export type RfqQuoteDto = z.infer<typeof rfqQuoteDtoSchema>;

const rfqBase = {
    id: uuidSchema,
    projectId: uuidSchema,
    /** `RFQ…`, set when sent. */
    number: z.string().nullable(),
    status: rfqStatusSchema,
    title: z.string(),
    dueDate: businessDateSchema.nullable(),
    deliveryAddress: z.string(),
    language: docLanguageSchema,
    /** The purchase requests the lines came from. */
    requestIds: z.array(uuidSchema),
    awardedSupplierId: uuidSchema.nullable(),
    awardedAt: isoDateTimeSchema.nullable(),
    sentAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
};

export const rfqSummaryDtoSchema = z.object({ ...rfqBase, lineCount: z.number().int(), supplierCount: z.number().int(), quoteCount: z.number().int() });
export type RfqSummaryDto = z.infer<typeof rfqSummaryDtoSchema>;
export const rfqListDtoSchema = z.array(rfqSummaryDtoSchema);

export const rfqDtoSchema = z.object({
    ...rfqBase,
    lines: z.array(rfqLineDtoSchema),
    suppliers: z.array(rfqSupplierDtoSchema),
    quotes: z.array(rfqQuoteDtoSchema),
    /** The caller may edit the draft (`procurement.manage`, project not archived). */
    canEdit: z.boolean(),
    createdBy: uuidSchema,
});
export type RfqDto = z.infer<typeof rfqDtoSchema>;

/** GET /rfqs/:rfqId/compare (amounts without VAT; prices typed with VAT are split first). */
export const rfqCompareCellSchema = z.object({
    supplierId: uuidSchema,
    /** null = not quoted / not offered. */
    unitPrice: z.number().nullable(),
    amount: z.number().nullable(),
    lowest: z.boolean(),
});
export const rfqCompareLineSchema = z.object({
    rfqLineId: uuidSchema,
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    qty: z.number(),
    budgetUnitPrice: z.number(),
    lowestUnitPrice: z.number().nullable(),
    /** Suppliers at the lowest unit price (ties: several). */
    lowestSupplierIds: z.array(uuidSchema),
    cells: z.array(rfqCompareCellSchema),
});
export const rfqCompareSupplierSchema = z.object({
    supplierId: uuidSchema,
    nameTh: z.string(),
    nameEn: z.string(),
    /** Σ quoted lines (no VAT). */
    quotedTotal: z.number(),
    /** quotedTotal + lines not offered at qty × budgetUnitPrice: the fair total to compare. */
    normalizedTotal: z.number(),
    /** Lines not offered. */
    missingLines: z.number().int(),
    /** Lines where this supplier is (one of) the lowest. */
    lowestLines: z.number().int(),
    vat: z.number(),
    total: z.number(),
    deliveryDays: z.number().int().nullable(),
    paymentTermDays: z.number().int().nullable(),
    validUntil: businessDateSchema.nullable(),
});
export const rfqCompareDtoSchema = z.object({
    rfqId: uuidSchema,
    lines: z.array(rfqCompareLineSchema),
    /** Suppliers with a quote, lowest normalized total first. */
    suppliers: z.array(rfqCompareSupplierSchema),
    /** Lowest normalized total (null without quotes). */
    bestSupplierId: uuidSchema.nullable(),
    budgetTotal: z.number(),
});
export type RfqCompareDto = z.infer<typeof rfqCompareDtoSchema>;

export const rfqAwardDtoSchema = z.object({ awardedSupplierId: uuidSchema });
export type RfqAwardDto = z.infer<typeof rfqAwardDtoSchema>;

// ── Requests ──

const descField = z.string().trim().max(500);
const noteField = z.string().max(4000);
const positiveQty = quantitySchema.refine(v => v > 0, { message: 'Must be more than 0' });

export const purchaseRequestLineInputSchema = z.object({
    /** A cost code of the project: description / unit default to it. */
    costCodeId: uuidSchema.nullable().optional(),
    descTh: descField.optional(),
    descEn: descField.optional(),
    unit: z.string().trim().max(40).optional(),
    qty: positiveQty,
    /** Default: the cost code's baseline material unit cost, else 0. */
    estUnitPrice: unitPriceSchema.optional(),
    note: noteField.optional(),
}).refine(l => (l.costCodeId ?? null) !== null || (l.descTh ?? '') !== '' || (l.descEn ?? '') !== '', {
    message: 'A line needs a cost code or a description',
});
export type PurchaseRequestLineInput = z.infer<typeof purchaseRequestLineInputSchema>;

/**
 * POST /projects/:projectId/purchase-requests. `source='boq'` with `costCodeIds`: one line per cost code with the
 * quantity that remains (`baseline_qty + vo_qty − requested before`, at least 0 — edit it before submitting);
 * `lines` are added after them.
 */
export const createPurchaseRequestRequestSchema = z.object({
    source: purchaseRequestSourceSchema.default('site'),
    requiredDate: businessDateSchema.nullable().optional(),
    note: noteField.optional(),
    costCodeIds: z.array(uuidSchema).max(500).optional(),
    lines: z.array(purchaseRequestLineInputSchema).max(500).optional(),
});
export type CreatePurchaseRequestRequest = z.infer<typeof createPurchaseRequestRequestSchema>;

/** PATCH /purchase-requests/:requestId — draft only; `lines` replaces every line. */
export const patchPurchaseRequestRequestSchema = z.object({
    requiredDate: businessDateSchema.nullable().optional(),
    note: noteField.optional(),
    overrideReason: z.string().trim().max(2000).optional(),
    lines: z.array(purchaseRequestLineInputSchema).max(500).optional(),
});
export type PatchPurchaseRequestRequest = z.infer<typeof patchPurchaseRequestRequestSchema>;

/** POST /purchase-requests/:requestId/submit — budget warnings need `overrideReason` (sent here or saved before). */
export const submitPurchaseRequestRequestSchema = z.object({
    overrideReason: z.string().trim().max(2000).optional(),
});
export type SubmitPurchaseRequestRequest = z.infer<typeof submitPurchaseRequestRequestSchema>;

/** POST /projects/:projectId/rfqs — from lines of approved purchase requests of the project (quantity: what remains). */
export const createRfqRequestSchema = z.object({
    title: z.string().trim().max(200).optional(),
    dueDate: businessDateSchema.nullable().optional(),
    deliveryAddress: z.string().trim().max(1000).optional(),
    language: docLanguageSchema.optional(),
    requestLineIds: z.array(uuidSchema).min(1).max(500),
    supplierIds: z.array(uuidSchema).max(50).optional(),
});
export type CreateRfqRequest = z.infer<typeof createRfqRequestSchema>;

/** PATCH /rfqs/:rfqId — draft only; `lines` changes quantities of existing lines. */
export const patchRfqRequestSchema = z.object({
    title: z.string().trim().max(200).optional(),
    dueDate: businessDateSchema.nullable().optional(),
    deliveryAddress: z.string().trim().max(1000).optional(),
    language: docLanguageSchema.optional(),
    lines: z.array(z.object({ id: uuidSchema, qty: positiveQty })).max(500).optional(),
});
export type PatchRfqRequest = z.infer<typeof patchRfqRequestSchema>;

/** PUT /rfqs/:rfqId/suppliers — the whole invited set (draft / sent); a supplier who quoted cannot be removed. */
export const putRfqSuppliersRequestSchema = z.object({
    supplierIds: z.array(uuidSchema).max(50),
});
export type PutRfqSuppliersRequest = z.infer<typeof putRfqSuppliersRequestSchema>;

/**
 * PUT /rfqs/:rfqId/quotes/:supplierId — the prices a supplier sent (RFQ sent). Lines left out = not offered.
 * `declined: true` marks the supplier declined and drops its quote.
 */
export const putRfqQuoteRequestSchema = z.object({
    declined: z.boolean().optional(),
    quoteRef: z.string().trim().max(100).optional(),
    quoteDate: businessDateSchema.nullable().optional(),
    validUntil: businessDateSchema.nullable().optional(),
    pricesIncludeVat: z.boolean().default(false),
    deliveryDays: z.number().int().min(0).max(3650).nullable().optional(),
    paymentTermDays: z.number().int().min(0).max(3650).nullable().optional(),
    lines: z.array(z.object({
        rfqLineId: uuidSchema,
        unitPrice: unitPriceSchema,
        available: z.boolean().default(true),
        note: z.string().max(1000).optional(),
    })).max(500).default([]),
    /** Uploaded with purpose `supplier_quote`. */
    fileIds: z.array(uuidSchema).max(20).optional(),
    note: noteField.optional(),
});
export type PutRfqQuoteRequest = z.infer<typeof putRfqQuoteRequestSchema>;

/** POST /rfqs/:rfqId/award — a supplier who quoted (the PO draft is made by WP-39). */
export const awardRfqRequestSchema = z.object({ supplierId: uuidSchema });
export type AwardRfqRequest = z.infer<typeof awardRfqRequestSchema>;
