// ─── Purchasing: purchase requests and requests for quotation (module `procurement`, docs/erp/02-domain-model.md §7.2, WP-38) ───
// PR: `draft → (pending_approval →) approved | rejected`, `approved → partially_ordered → ordered → closed` (POs, WP-39),
// `draft | pending_approval | approved → cancelled`. Submitting checks the budget per cost code (warnings need an
// `overrideReason`), issues the `PR` number and asks the approval `purchase_request.approve`.
// RFQ: `draft → sent → awarded → closed`, `draft | sent → cancelled`. Suppliers do not log in (v1, D-11): the team
// prints / sends the RFQ and types the prices received. Amounts exclude VAT unless named otherwise; money is round2.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { fileDtoSchema } from '../files';
import { amountSchema, businessDateSchema, docLanguageSchema, quantitySchema, rateSchema, unitPriceSchema } from './common';
import { supplierSnapshotSchema, supplierWhtPresetSchema } from './suppliers';

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

/** POST /rfqs/:rfqId/award: the RFQ is `awarded` and a PO draft is made from the winning quote (WP-39). */
export const rfqAwardDtoSchema = z.object({ awardedSupplierId: uuidSchema, orderId: uuidSchema });
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

/** POST /rfqs/:rfqId/award — a supplier who quoted; makes a PO draft from that quote. */
export const awardRfqRequestSchema = z.object({ supplierId: uuidSchema });
export type AwardRfqRequest = z.infer<typeof awardRfqRequestSchema>;

// ── purchase orders and goods receipts (WP-39) ──
// PO: `draft → (pending_approval →) issued`, `pending_approval → draft` (rejected), `issued → partially_received →
// received → closed`, `draft | pending_approval | issued (nothing received) → cancelled`. Issuing posts a cost
// commitment per line (amount after the header discount, without VAT); each confirmed goods receipt moves its value
// from committed to actual; closing releases what was not received. GR: `draft → confirmed | cancelled`.

export const PURCHASE_ORDER_STATUSES = [
    'draft', 'pending_approval', 'issued', 'partially_received', 'received', 'closed', 'cancelled',
] as const;
export const purchaseOrderStatusSchema = z.enum(PURCHASE_ORDER_STATUSES);
export type PurchaseOrderStatus = z.infer<typeof purchaseOrderStatusSchema>;
/** Issued and waiting for (more) goods: receipts may be made; counted as open in the hub. */
export const PURCHASE_ORDER_RECEIVABLE_STATUSES: readonly PurchaseOrderStatus[] = ['issued', 'partially_received'];
/** Statuses whose lines count as ordered (budget check, price history). */
export const PURCHASE_ORDER_ISSUED_STATUSES: readonly PurchaseOrderStatus[] = ['issued', 'partially_received', 'received', 'closed'];

export const GOODS_RECEIPT_STATUSES = ['draft', 'confirmed', 'cancelled'] as const;
export const goodsReceiptStatusSchema = z.enum(GOODS_RECEIPT_STATUSES);
export type GoodsReceiptStatus = z.infer<typeof goodsReceiptStatusSchema>;

export const RECEIPT_CONDITIONS = ['ok', 'damaged', 'short'] as const;
export const receiptConditionSchema = z.enum(RECEIPT_CONDITIONS);
export type ReceiptCondition = z.infer<typeof receiptConditionSchema>;

/** 3-way match result of one supplier bill line (pure `src/domain/procurement/three-way-match.ts`). */
export const THREE_WAY_MATCH_STATUSES = ['matched', 'qty_exceeds_received', 'price_differs', 'no_po'] as const;
export const threeWayMatchStatusSchema = z.enum(THREE_WAY_MATCH_STATUSES);
export type ThreeWayMatchStatus = z.infer<typeof threeWayMatchStatusSchema>;

export const purchaseOrderLineDtoSchema = z.object({
    id: uuidSchema,
    costCodeId: uuidSchema.nullable(),
    costCode: z.string().nullable(),
    /** The purchase request line it orders (null = typed on the PO). */
    requestLineId: uuidSchema.nullable(),
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    qty: z.number(),
    /** Without VAT. */
    unitPrice: z.number(),
    /** qty × unitPrice (before the header discount). */
    amount: z.number(),
    receivedQty: z.number(),
    billedQty: z.number(),
    sort: z.number().int(),
});
export type PurchaseOrderLineDto = z.infer<typeof purchaseOrderLineDtoSchema>;

const purchaseOrderBase = {
    id: uuidSchema,
    projectId: uuidSchema,
    supplierId: uuidSchema,
    /** Name of the supplier (from the snapshot once issued, else the supplier record). */
    supplierName: z.string(),
    rfqId: uuidSchema.nullable(),
    /** `PO…`, set when issued. */
    number: z.string().nullable(),
    status: purchaseOrderStatusSchema,
    orderDate: businessDateSchema.nullable(),
    deliveryDate: businessDateSchema.nullable(),
    deliveryAddress: z.string(),
    language: docLanguageSchema,
    vatRate: z.number(),
    /** Σ line amounts, without VAT. */
    subtotal: z.number(),
    discount: z.number(),
    vat: z.number(),
    /** subtotal − discount + vat. */
    total: z.number(),
    whtPreset: supplierWhtPresetSchema,
    paymentTermDays: z.number().int().nullable(),
    terms: z.string(),
    budgetWarnings: z.array(budgetWarningSchema),
    overrideReason: z.string(),
    issuedBy: uuidSchema.nullable(),
    issuedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
};

export const purchaseOrderSummaryDtoSchema = z.object({ ...purchaseOrderBase, lineCount: z.number().int() });
export type PurchaseOrderSummaryDto = z.infer<typeof purchaseOrderSummaryDtoSchema>;
export const purchaseOrderListDtoSchema = z.array(purchaseOrderSummaryDtoSchema);

export const purchaseOrderDtoSchema = z.object({
    ...purchaseOrderBase,
    /** Frozen when issued (null while draft). */
    supplierSnapshot: supplierSnapshotSchema.nullable(),
    lines: z.array(purchaseOrderLineDtoSchema),
    /** The caller may edit / issue the draft (`procurement.manage`, project not archived). */
    canEdit: z.boolean(),
    /** The caller may record goods received (`procurement.receive`, PO issued / partially received). */
    canReceive: z.boolean(),
    createdBy: uuidSchema,
});
export type PurchaseOrderDto = z.infer<typeof purchaseOrderDtoSchema>;

export const goodsReceiptPhotoSchema = z.object({
    fileId: uuidSchema,
    takenAt: isoDateTimeSchema.nullable(),
    caption: z.string(),
});
export type GoodsReceiptPhoto = z.infer<typeof goodsReceiptPhotoSchema>;

export const goodsReceiptLineDtoSchema = z.object({
    id: uuidSchema,
    orderLineId: uuidSchema,
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    /** Accepted quantity (moves to actual cost). */
    qtyReceived: z.number(),
    qtyRejected: z.number(),
    condition: receiptConditionSchema,
    note: z.string(),
});
export type GoodsReceiptLineDto = z.infer<typeof goodsReceiptLineDtoSchema>;

export const goodsReceiptDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    orderId: uuidSchema,
    /** `GR…`, set when confirmed. */
    number: z.string().nullable(),
    status: goodsReceiptStatusSchema,
    receivedDate: businessDateSchema,
    receivedBy: uuidSchema,
    deliveryNoteNo: z.string(),
    photos: z.array(goodsReceiptPhotoSchema.extend({ file: fileDtoSchema.nullable() })),
    note: z.string(),
    lines: z.array(goodsReceiptLineDtoSchema),
    /** Value moved to actual cost when confirmed (without VAT). */
    amount: z.number(),
    confirmedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type GoodsReceiptDto = z.infer<typeof goodsReceiptDtoSchema>;
export const goodsReceiptListDtoSchema = z.array(goodsReceiptDtoSchema);

/** GET /suppliers/:supplierId/price-history — lines of the supplier's issued POs, newest first. */
export const supplierPriceHistoryItemSchema = z.object({
    orderId: uuidSchema,
    orderNumber: z.string().nullable(),
    projectId: uuidSchema,
    orderDate: businessDateSchema.nullable(),
    issuedAt: isoDateTimeSchema.nullable(),
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    qty: z.number(),
    unitPrice: z.number(),
    costCodeId: uuidSchema.nullable(),
});
export type SupplierPriceHistoryItem = z.infer<typeof supplierPriceHistoryItemSchema>;
export const supplierPriceHistoryDtoSchema = z.array(supplierPriceHistoryItemSchema);
export const supplierPriceHistoryQuerySchema = z.object({ q: z.string().trim().max(100).optional() });
export type SupplierPriceHistoryQuery = z.infer<typeof supplierPriceHistoryQuerySchema>;

/** GET /workspaces/:workspaceId/purchase-orders?status=issued,partially_received */
export const purchaseOrderListQuerySchema = z.object({
    status: z.string().optional()
        .transform(v => (v === undefined || v.trim() === '' ? undefined : v.split(',').map(x => x.trim()).filter(x => x !== '')))
        .pipe(z.array(purchaseOrderStatusSchema).optional()),
});
export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>;

export const purchaseOrderLineInputSchema = z.object({
    /** A line of an approved purchase request of the project (description / unit / cost code default to it). */
    requestLineId: uuidSchema.nullable().optional(),
    costCodeId: uuidSchema.nullable().optional(),
    descTh: descField.optional(),
    descEn: descField.optional(),
    unit: z.string().trim().max(40).optional(),
    qty: positiveQty,
    /** Without VAT. Default: the request line's estimate, else the cost code's baseline material unit cost, else 0. */
    unitPrice: unitPriceSchema.optional(),
}).refine(l => (l.requestLineId ?? null) !== null || (l.costCodeId ?? null) !== null || (l.descTh ?? '') !== '' || (l.descEn ?? '') !== '', {
    message: 'A line needs a request line, a cost code or a description',
});
export type PurchaseOrderLineInput = z.infer<typeof purchaseOrderLineInputSchema>;

const orderHeader = {
    orderDate: businessDateSchema.nullable().optional(),
    deliveryDate: businessDateSchema.nullable().optional(),
    deliveryAddress: z.string().trim().max(1000).optional(),
    language: docLanguageSchema.optional(),
    /** Default 7% when the supplier is VAT registered, else 0. */
    vatRate: rateSchema.optional(),
    discount: amountSchema.optional(),
    whtPreset: supplierWhtPresetSchema.optional(),
    paymentTermDays: z.number().int().min(0).max(3650).nullable().optional(),
    terms: z.string().max(4000).optional(),
};

/**
 * POST /projects/:projectId/purchase-orders — empty, or from purchase request lines (`requestLineIds`: quantity =
 * what is not ordered yet, price = the estimate) and / or typed `lines`. A PO from an RFQ is made by the award.
 */
export const createPurchaseOrderRequestSchema = z.object({
    supplierId: uuidSchema,
    ...orderHeader,
    requestLineIds: z.array(uuidSchema).max(500).optional(),
    lines: z.array(purchaseOrderLineInputSchema).max(500).optional(),
});
export type CreatePurchaseOrderRequest = z.infer<typeof createPurchaseOrderRequestSchema>;

/** PATCH /purchase-orders/:orderId — draft only; `lines` replaces every line. */
export const patchPurchaseOrderRequestSchema = z.object({
    supplierId: uuidSchema.optional(),
    ...orderHeader,
    overrideReason: z.string().trim().max(2000).optional(),
    lines: z.array(purchaseOrderLineInputSchema).max(500).optional(),
});
export type PatchPurchaseOrderRequest = z.infer<typeof patchPurchaseOrderRequestSchema>;

/** POST /purchase-orders/:orderId/issue — budget warnings need `overrideReason` (sent here or saved before). */
export const issuePurchaseOrderRequestSchema = z.object({
    overrideReason: z.string().trim().max(2000).optional(),
});
export type IssuePurchaseOrderRequest = z.infer<typeof issuePurchaseOrderRequestSchema>;

/** POST /purchase-orders/:orderId/receipts — a draft receipt (confirm it to post the cost). Photos: purposes `delivery_note_photo` / `goods_photo`. */
export const createGoodsReceiptRequestSchema = z.object({
    receivedDate: businessDateSchema.optional(),
    deliveryNoteNo: z.string().trim().max(100).optional(),
    note: noteField.optional(),
    photos: z.array(z.object({
        fileId: uuidSchema,
        takenAt: isoDateTimeSchema.nullable().optional(),
        caption: z.string().trim().max(500).optional(),
    })).max(30).optional(),
    lines: z.array(z.object({
        orderLineId: uuidSchema,
        qtyReceived: quantitySchema.refine(v => v >= 0, { message: 'Must be 0 or more' }),
        qtyRejected: quantitySchema.refine(v => v >= 0, { message: 'Must be 0 or more' }).optional(),
        condition: receiptConditionSchema.optional(),
        note: z.string().max(1000).optional(),
    })).min(1).max(500),
});
export type CreateGoodsReceiptRequest = z.infer<typeof createGoodsReceiptRequestSchema>;
