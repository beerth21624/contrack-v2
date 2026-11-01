// ─── Payables (module `payables`, WP-49 … WP-51, docs/erp/02-domain-model.md §10) ───
// Supplier bills: from a purchase order + goods received (3-way match), from an approved subcontract claim, from an
// approved labour pay period, or typed (service / expense). Draft → (approval `supplier_bill.approve`) → approved
// (posted: number `AP`, fin_events `ap.bill_posted`, cost of price differences / bills without a PO) → scheduled →
// paid (payment runs, WP-50) · draft / approved → voided.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { amountSchema, businessDateSchema, quantitySchema, rateSchema, unitPriceSchema } from './common';
import { costCategorySchema } from './ledger';
import { supplierWhtPresetSchema } from './suppliers';

export const SUPPLIER_BILL_KINDS = ['material', 'subcontract', 'service', 'labour', 'expense'] as const;
export const supplierBillKindSchema = z.enum(SUPPLIER_BILL_KINDS);
export type SupplierBillKind = z.infer<typeof supplierBillKindSchema>;

export const SUPPLIER_BILL_STATUSES = ['draft', 'pending_approval', 'approved', 'scheduled', 'paid', 'voided'] as const;
export const supplierBillStatusSchema = z.enum(SUPPLIER_BILL_STATUSES);
export type SupplierBillStatus = z.infer<typeof supplierBillStatusSchema>;

/** Posted and not paid yet: what the company still owes. */
export const SUPPLIER_BILL_OPEN_STATUSES: readonly SupplierBillStatus[] = ['approved', 'scheduled'];

export const BILL_MATCH_STATUSES = ['not_applicable', 'matched', 'exceptions'] as const;
export const billMatchStatusSchema = z.enum(BILL_MATCH_STATUSES);
export type BillMatchStatus = z.infer<typeof billMatchStatusSchema>;

/** Same values as `ThreeWayMatchStatus` of src/domain/procurement/three-way-match.ts. */
export const BILL_LINE_MATCHES = ['matched', 'qty_exceeds_received', 'price_differs', 'no_po'] as const;
export const billLineMatchSchema = z.enum(BILL_LINE_MATCHES);
export type BillLineMatch = z.infer<typeof billLineMatchSchema>;

/** Bills due within this many days are portal tasks; `supplier_bill.due_soon` goes out this many days before. */
export const SUPPLIER_BILL_PORTAL_DAYS = 7;
export const SUPPLIER_BILL_DUE_SOON_DAYS = 3;

export const supplierBillLineDtoSchema = z.object({
    id: uuidSchema,
    orderLineId: uuidSchema.nullable(),
    costCodeId: uuidSchema.nullable(),
    category: costCategorySchema,
    desc: z.string(),
    unit: z.string(),
    qty: z.number(),
    unitPrice: z.number(),
    /** round2(qty × unitPrice), without VAT. */
    amount: z.number(),
    match: billLineMatchSchema,
    /** Quantity counted against the PO line when posted (0 before, and for lines without a PO). */
    billedQty: z.number(),
    /** PO unit price (null without a PO line), for the 3-way match view. */
    orderUnitPrice: z.number().nullable(),
    /** Received − billed on the PO line before this bill (null without a PO line). */
    billableQty: z.number().nullable(),
});
export type SupplierBillLineDto = z.infer<typeof supplierBillLineDtoSchema>;

export const supplierBillSummaryDtoSchema = z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    projectId: uuidSchema.nullable(),
    supplierId: uuidSchema.nullable(),
    /** Supplier name (labour bills: empty). */
    supplierName: z.string(),
    kind: supplierBillKindSchema,
    /** `AP…`, set when posted. */
    number: z.string().nullable(),
    status: supplierBillStatusSchema,
    billDate: businessDateSchema,
    supplierInvoiceNo: z.string(),
    supplierInvoiceDate: businessDateSchema.nullable(),
    taxInvoiceNo: z.string(),
    taxInvoiceDate: businessDateSchema.nullable(),
    inputVatClaimable: z.boolean(),
    dueDate: businessDateSchema,
    orderId: uuidSchema.nullable(),
    scClaimId: uuidSchema.nullable(),
    payPeriodId: uuidSchema.nullable(),
    vatRate: z.number(),
    subtotal: z.number(),
    discount: z.number(),
    vat: z.number(),
    /** subtotal − discount + vat. */
    total: z.number(),
    whtPreset: supplierWhtPresetSchema,
    whtRate: z.number(),
    whtAmount: z.number(),
    retentionAmount: z.number(),
    /** subtotal − discount + vat − wht − retention: what will be paid. */
    payable: z.number(),
    paidAmount: z.number(),
    matchStatus: billMatchStatusSchema,
    note: z.string(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type SupplierBillSummaryDto = z.infer<typeof supplierBillSummaryDtoSchema>;
export const supplierBillListDtoSchema = z.object({ items: z.array(supplierBillSummaryDtoSchema) });
export type SupplierBillListDto = z.infer<typeof supplierBillListDtoSchema>;

export const supplierBillDtoSchema = supplierBillSummaryDtoSchema.extend({
    lines: z.array(supplierBillLineDtoSchema),
    fileIds: z.array(uuidSchema),
    orderNumber: z.string().nullable(),
    approvedBy: uuidSchema.nullable(),
    approvedAt: isoDateTimeSchema.nullable(),
    voidedAt: isoDateTimeSchema.nullable(),
    voidReason: z.string(),
    createdBy: uuidSchema,
    /** `payables.manage` and draft. */
    canEdit: z.boolean(),
    /** `payables.manage` and draft (exceptions need a note first). */
    canApprove: z.boolean(),
    /** `payables.manage`, draft / pending / approved. */
    canVoid: z.boolean(),
});
export type SupplierBillDto = z.infer<typeof supplierBillDtoSchema>;

const csv = <T extends z.ZodTypeAny>(item: T) => z.string().optional()
    .transform(v => (v === undefined || v.trim() === '' ? undefined : v.split(',').map(x => x.trim()).filter(x => x !== '')))
    .pipe(z.array(item).optional());

/** GET /workspaces/:workspaceId/supplier-bills?status=draft,approved&kind=&supplierId=&projectId= */
export const supplierBillListQuerySchema = z.object({
    status: csv(supplierBillStatusSchema),
    kind: supplierBillKindSchema.optional(),
    supplierId: uuidSchema.optional(),
    projectId: uuidSchema.optional(),
});
export type SupplierBillListQuery = z.infer<typeof supplierBillListQuerySchema>;

const text = (max: number) => z.string().trim().max(max);

/** A typed line (service / expense bills, or extra lines of a PO bill such as freight). */
export const supplierBillLineInputSchema = z.object({
    /** A line of the bill's purchase order (PO bills only). */
    orderLineId: uuidSchema.nullable().optional(),
    /** A cost code of the bill's project (default: the PO line's). */
    costCodeId: uuidSchema.nullable().optional(),
    /** Default: material for PO lines, else by the bill kind (service / expense → other). */
    category: costCategorySchema.optional(),
    /** Default: the PO line's description. */
    desc: text(500).optional(),
    unit: text(40).optional(),
    qty: quantitySchema.refine(v => v > 0, { message: 'Must be more than 0' }),
    /** Without VAT. Default: the PO line's unit price, else 0. */
    unitPrice: unitPriceSchema.optional(),
});
export type SupplierBillLineInput = z.infer<typeof supplierBillLineInputSchema>;

const billHeader = {
    billDate: businessDateSchema.optional(),
    supplierInvoiceNo: text(100).optional(),
    supplierInvoiceDate: businessDateSchema.nullable().optional(),
    taxInvoiceNo: text(100).optional(),
    taxInvoiceDate: businessDateSchema.nullable().optional(),
    /** Default: true when a tax invoice number is given. */
    inputVatClaimable: z.boolean().optional(),
    /** Default: invoice date (else bill date) + the PO's payment term, else the supplier's credit term. */
    dueDate: businessDateSchema.optional(),
    /** Default 7% when the supplier is VAT registered, else 0. */
    vatRate: rateSchema.optional(),
    /** VAT as printed on the supplier's invoice (default: round2((subtotal − discount) × vatRate)). */
    vat: amountSchema.optional(),
    discount: amountSchema.optional(),
    /** Default: the PO's, else the supplier's default preset. */
    whtPreset: supplierWhtPresetSchema.optional(),
    note: z.string().max(4000).optional(),
    /** Scans of the supplier's invoice (purpose `supplier_bill_scan`). */
    fileIds: z.array(uuidSchema).max(20).optional(),
};

/** POST /workspaces/:workspaceId/supplier-bills — a typed bill (service / expense / material without a PO). */
export const createSupplierBillRequestSchema = z.object({
    kind: z.enum(['material', 'service', 'expense']),
    supplierId: uuidSchema,
    /** null = company overhead (no cost posted). */
    projectId: uuidSchema.nullable().optional(),
    ...billHeader,
    lines: z.array(supplierBillLineInputSchema.omit({ orderLineId: true })).max(500).optional(),
});
export type CreateSupplierBillRequest = z.infer<typeof createSupplierBillRequestSchema>;

/** POST /purchase-orders/:orderId/bill — without `lines`: every PO line not billed yet, qty = received − billed, PO price. */
export const createBillFromOrderRequestSchema = z.object({
    ...billHeader,
    lines: z.array(supplierBillLineInputSchema).max(500).optional(),
});
export type CreateBillFromOrderRequest = z.infer<typeof createBillFromOrderRequestSchema>;

/** POST /workspaces/:workspaceId/supplier-bills/from-sc-claim — `supplierId` when the vendor is not linked to the register. */
export const createBillFromScClaimRequestSchema = z.object({
    claimId: uuidSchema,
    supplierId: uuidSchema.optional(),
    billDate: businessDateSchema.optional(),
    supplierInvoiceNo: text(100).optional(),
    supplierInvoiceDate: businessDateSchema.nullable().optional(),
    taxInvoiceNo: text(100).optional(),
    taxInvoiceDate: businessDateSchema.nullable().optional(),
    inputVatClaimable: z.boolean().optional(),
    dueDate: businessDateSchema.optional(),
    note: z.string().max(4000).optional(),
    fileIds: z.array(uuidSchema).max(20).optional(),
});
export type CreateBillFromScClaimRequest = z.infer<typeof createBillFromScClaimRequestSchema>;

/** POST /workspaces/:workspaceId/supplier-bills/from-pay-period — one bill per approved pay period. */
export const createBillFromPayPeriodRequestSchema = z.object({
    periodId: uuidSchema,
    billDate: businessDateSchema.optional(),
    dueDate: businessDateSchema.optional(),
    note: z.string().max(4000).optional(),
});
export type CreateBillFromPayPeriodRequest = z.infer<typeof createBillFromPayPeriodRequestSchema>;

/** PATCH /supplier-bills/:billId — draft only; `lines` replaces every line (subcontract / labour bills keep theirs). */
export const patchSupplierBillRequestSchema = z.object({
    ...billHeader,
    projectId: uuidSchema.nullable().optional(),
    lines: z.array(supplierBillLineInputSchema).max(500).optional(),
});
export type PatchSupplierBillRequest = z.infer<typeof patchSupplierBillRequestSchema>;

/** POST /supplier-bills/:billId/approve — exceptions of the 3-way match need a note (sent here or saved before). */
export const approveSupplierBillRequestSchema = z.object({
    note: z.string().trim().max(4000).optional(),
});
export type ApproveSupplierBillRequest = z.infer<typeof approveSupplierBillRequestSchema>;

export const voidSupplierBillRequestSchema = z.object({
    reason: z.string().trim().min(1).max(1000),
});
export type VoidSupplierBillRequest = z.infer<typeof voidSupplierBillRequestSchema>;

/** An approved subcontract claim not paid and not billed yet. */
export const billableScClaimDtoSchema = z.object({
    claimId: uuidSchema,
    subcontractId: uuidSchema,
    projectId: uuidSchema,
    contractNo: z.string(),
    title: z.string(),
    vendorName: z.string(),
    /** Supplier of the register linked to the vendor (null = pick one when billing). */
    supplierId: uuidSchema.nullable(),
    installmentNo: z.number().int(),
    approvedOn: businessDateSchema.nullable(),
    gross: z.number(),
    retention: z.number(),
    wht: z.number(),
    vat: z.number(),
    net: z.number(),
});
export type BillableScClaimDto = z.infer<typeof billableScClaimDtoSchema>;

/** An approved labour pay period not billed yet. */
export const billablePayPeriodDtoSchema = z.object({
    periodId: uuidSchema,
    periodKey: z.string(),
    startDate: businessDateSchema,
    endDate: businessDateSchema,
    net: z.number(),
});
export type BillablePayPeriodDto = z.infer<typeof billablePayPeriodDtoSchema>;

/** GET /workspaces/:workspaceId/payables/due?within=30 */
export const payablesDueQuerySchema = z.object({
    within: z.coerce.number().int().min(0).max(366).default(30),
});
export type PayablesDueQuery = z.infer<typeof payablesDueQuerySchema>;

export const payablesDueDtoSchema = z.object({
    /** Posted bills not paid, due on or before today + `within` (overdue ones too), earliest first. */
    bills: z.array(supplierBillSummaryDtoSchema),
    totalDue: z.number(),
    totalOverdue: z.number(),
    /** Approved subcontract claims to bill ([] while subcontracting is not active). */
    scClaims: z.array(billableScClaimDtoSchema),
    /** Approved pay periods to bill ([] while labour is not active). */
    payPeriods: z.array(billablePayPeriodDtoSchema),
});
export type PayablesDueDto = z.infer<typeof payablesDueDtoSchema>;
