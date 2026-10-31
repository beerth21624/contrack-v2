// ─── Billing: progress claims, invoices, customer retention / advance ledgers (docs/erp/02-domain-model.md §4, WP-29) ───
// A claim (`ar_claims`) of a signed main contract: `draft → (pending_approval →) submitted → certified → invoiced`,
// `draft | pending_approval | submitted | certified → cancelled`; one open (draft / pending_approval / submitted) per
// contract. Every amount is computed by the server (src/domain/billing/claim.ts); amounts exclude VAT unless named so.
// Receipts, tax invoices and credit notes: WP-30 (below).
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { amountSchema, businessDateSchema, docLanguageSchema, rateSchema } from './common';
import { bankAccountSchema } from './company';
import { mainContractBillingModeSchema } from './main-contracts';
import { quotationCompanySnapshotSchema, quotationCustomerSnapshotSchema } from './quotations';

export const AR_CLAIM_STATUSES = ['draft', 'pending_approval', 'submitted', 'certified', 'invoiced', 'cancelled'] as const;
export const arClaimStatusSchema = z.enum(AR_CLAIM_STATUSES);
export type ArClaimStatus = z.infer<typeof arClaimStatusSchema>;
/** Statuses of the claim being worked on (at most one per contract). */
export const AR_CLAIM_OPEN_STATUSES: readonly ArClaimStatus[] = ['draft', 'pending_approval', 'submitted'];

export const INVOICE_KINDS = ['advance_invoice', 'invoice', 'tax_invoice', 'credit_note'] as const;
export const invoiceKindSchema = z.enum(INVOICE_KINDS);
export type InvoiceKind = z.infer<typeof invoiceKindSchema>;
export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'voided'] as const;
export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
/** What made the document: a certified claim, the advance payment, a retention release, a receipt (tax invoice, WP-30). */
export const INVOICE_SOURCES = ['claim', 'advance', 'retention_release', 'receipt'] as const;
export const invoiceSourceSchema = z.enum(INVOICE_SOURCES);
export type InvoiceSource = z.infer<typeof invoiceSourceSchema>;

export const AR_RETENTION_ENTRY_KINDS = ['withheld', 'released', 'forfeited'] as const;
export type ArRetentionEntryKind = (typeof AR_RETENTION_ENTRY_KINDS)[number];
export const AR_ADVANCE_ENTRY_KINDS = ['received', 'recovered'] as const;
export type ArAdvanceEntryKind = (typeof AR_ADVANCE_ENTRY_KINDS)[number];

// ── DTOs ──

export const arClaimLineDtoSchema = z.object({
    costCodeId: uuidSchema,
    code: z.string(),
    sectionNo: z.number().int(),
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    /** `contract_amount + vo_contract_amount` of the cost code when the claim was made. */
    contractAmount: z.number(),
    prevProgress: z.number(),
    cumProgress: z.number(),
    prevAmount: z.number(),
    cumAmount: z.number(),
    thisAmount: z.number(),
    /** Latest progress from site reports (0 when none). */
    reportedProgress: z.number(),
    note: z.string(),
});
export type ArClaimLineDto = z.infer<typeof arClaimLineDtoSchema>;

export const arClaimSummaryDtoSchema = z.object({
    id: uuidSchema,
    contractId: uuidSchema,
    projectId: uuidSchema,
    mode: mainContractBillingModeSchema,
    /** Milestone mode: the claimed milestone. */
    milestoneId: uuidSchema.nullable(),
    claimNo: z.number().int(),
    periodFrom: businessDateSchema.nullable(),
    periodTo: businessDateSchema.nullable(),
    status: arClaimStatusSchema,
    /** W. */
    workValue: z.number(),
    previousValue: z.number(),
    cumulativeValue: z.number(),
    /** The claim completes the contract (the advance is recovered in full). */
    isFinal: z.boolean(),
    advanceRecovery: z.number(),
    retention: z.number(),
    penalty: z.number(),
    penaltyDays: z.number().int(),
    /** Amount typed instead of the computed penalty; null = computed from the days. */
    penaltyOverride: z.number().nullable(),
    /** Most this claim may deduct as penalty (cap left over the contract). */
    penaltyMax: z.number(),
    /** E (signed). */
    escalation: z.number(),
    /** K; null when escalation is off. */
    escalationK: z.number().nullable(),
    escalationIndices: z.record(z.string(), z.number()),
    otherDeduction: z.number(),
    otherDeductionNote: z.string(),
    vatBase: z.number(),
    vat: z.number(),
    wht: z.number(),
    payable: z.number(),
    certifiedByName: z.string(),
    certifiedAt: businessDateSchema.nullable(),
    certifiedNote: z.string(),
    invoiceId: uuidSchema.nullable(),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type ArClaimSummaryDto = z.infer<typeof arClaimSummaryDtoSchema>;

export const arClaimDtoSchema = arClaimSummaryDtoSchema.extend({
    lines: z.array(arClaimLineDtoSchema),
    /** The caller may edit the lines / deductions (draft or submitted, `billing.manage`, project not archived). */
    canEdit: z.boolean(),
});
export type ArClaimDto = z.infer<typeof arClaimDtoSchema>;
export const arClaimListDtoSchema = z.array(arClaimSummaryDtoSchema);

export const invoiceLineSchema = z.object({
    descTh: z.string(),
    descEn: z.string(),
    /** Signed (an advance recovery line is negative); Σ = net. */
    amount: z.number(),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const invoiceDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema.nullable(),
    contractId: uuidSchema.nullable(),
    claimId: uuidSchema.nullable(),
    milestoneId: uuidSchema.nullable(),
    customerId: uuidSchema,
    kind: invoiceKindSchema,
    source: invoiceSourceSchema,
    /** Set when issued. */
    number: z.string().nullable(),
    status: invoiceStatusSchema,
    issueDate: businessDateSchema,
    dueDate: businessDateSchema,
    language: docLanguageSchema,
    /** Set when issued. */
    customerSnapshot: quotationCustomerSnapshotSchema.nullable(),
    companySnapshot: quotationCompanySnapshotSchema.nullable(),
    lines: z.array(invoiceLineSchema),
    net: z.number(),
    vat: z.number(),
    /** net + vat. */
    total: z.number(),
    retention: z.number(),
    advanceRecovery: z.number(),
    penalty: z.number(),
    whtExpected: z.number(),
    payable: z.number(),
    /** Cash + WHT settled by receipts. */
    paidAmount: z.number(),
    relatedInvoiceId: uuidSchema.nullable(),
    note: z.string(),
    voidReason: z.string(),
    issuedBy: uuidSchema.nullable(),
    issuedAt: isoDateTimeSchema.nullable(),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type InvoiceDto = z.infer<typeof invoiceDtoSchema>;
export const invoiceListDtoSchema = z.array(invoiceDtoSchema);

export const arRetentionEntryDtoSchema = z.object({
    id: uuidSchema,
    kind: z.enum(AR_RETENTION_ENTRY_KINDS),
    amount: z.number(),
    claimId: uuidSchema.nullable(),
    invoiceId: uuidSchema.nullable(),
    entryDate: businessDateSchema,
    note: z.string(),
    createdAt: isoDateTimeSchema,
});
export type ArRetentionEntryDto = z.infer<typeof arRetentionEntryDtoSchema>;

/** GET /main-contracts/:contractId/retention. */
export const contractRetentionDtoSchema = z.object({
    contractId: uuidSchema,
    withheld: z.number(),
    released: z.number(),
    forfeited: z.number(),
    /** Still held. */
    balance: z.number(),
    /** Cap over the contract; null = none. */
    cap: z.number().nullable(),
    /** Draft release invoices not issued yet. */
    pendingRelease: z.number(),
    /** balance − pendingRelease: most a new release invoice may ask. */
    releasable: z.number(),
    schedule: z.array(z.object({
        stage: z.enum(['completion', 'warranty_end']),
        amount: z.number(),
        dueAt: businessDateSchema.nullable(),
    })),
    entries: z.array(arRetentionEntryDtoSchema),
});
export type ContractRetentionDto = z.infer<typeof contractRetentionDtoSchema>;

export const arAdvanceEntryDtoSchema = z.object({
    id: uuidSchema,
    kind: z.enum(AR_ADVANCE_ENTRY_KINDS),
    amount: z.number(),
    claimId: uuidSchema.nullable(),
    invoiceId: uuidSchema.nullable(),
    entryDate: businessDateSchema,
    createdAt: isoDateTimeSchema,
});
export type ArAdvanceEntryDto = z.infer<typeof arAdvanceEntryDtoSchema>;

/** GET /main-contracts/:contractId/advance. */
export const contractAdvanceDtoSchema = z.object({
    contractId: uuidSchema,
    advancePct: z.number(),
    /** round2(original value × advancePct); 0 = no advance on this contract. */
    amount: z.number(),
    received: z.number(),
    recovered: z.number(),
    /** received − recovered. */
    balance: z.number(),
    /** The advance invoice that is not voided (null = none yet: the billing page offers to make it). */
    invoice: invoiceDtoSchema.nullable(),
    /** An advance invoice may be made now (signed, advancePct > 0, none yet, `billing.manage`). */
    canCreateInvoice: z.boolean(),
    entries: z.array(arAdvanceEntryDtoSchema),
});
export type ContractAdvanceDto = z.infer<typeof contractAdvanceDtoSchema>;

// ── Requests ──

const noteField = z.string().trim().max(1000);

/** POST /main-contracts/:contractId/claims — milestone-billed contracts name the claimable milestone. */
export const createArClaimRequestSchema = z.object({
    milestoneId: uuidSchema.optional(),
    periodFrom: businessDateSchema.optional(),
    periodTo: businessDateSchema.optional(),
}).strict();
export type CreateArClaimRequest = z.infer<typeof createArClaimRequestSchema>;

export const arClaimLineInputSchema = z.object({
    costCodeId: uuidSchema,
    cumProgress: rateSchema,
    /** Required when cumProgress is below the previous claim's (400 `progress_below_previous`). */
    note: noteField.optional(),
}).strict();
export type ArClaimLineInput = z.infer<typeof arClaimLineInputSchema>;

/** PATCH /claims/:claimId — draft or submitted; only the fields sent change; lines are merged by cost code. */
export const patchArClaimRequestSchema = z.object({
    periodFrom: businessDateSchema.nullable().optional(),
    periodTo: businessDateSchema.nullable().optional(),
    lines: z.array(arClaimLineInputSchema).max(5000).optional(),
    penaltyDays: z.number().int().min(0).max(36500).optional(),
    /** null = back to the amount computed from the days. Above the cap left → 422 `penalty_cap_exceeded`. */
    penaltyOverride: amountSchema.nullable().optional(),
    escalationIndices: z.record(z.string().trim().min(1).max(40), z.number().finite().gt(0).max(1e9)).optional(),
    otherDeduction: amountSchema.optional(),
    otherDeductionNote: noteField.optional(),
}).strict();
export type PatchArClaimRequest = z.infer<typeof patchArClaimRequestSchema>;

/** POST /claims/:claimId/certify — submitted → certified (the customer's inspector); lines may still be adjusted. */
export const certifyArClaimRequestSchema = z.object({
    certifiedByName: z.string().trim().min(1).max(200),
    certifiedAt: businessDateSchema.optional(),
    note: noteField.optional(),
    lines: z.array(arClaimLineInputSchema).max(5000).optional(),
}).strict();
export type CertifyArClaimRequest = z.infer<typeof certifyArClaimRequestSchema>;

/** Dates / language of an invoice (defaults: today, + `terms.paymentTermDays`, the contract's language). */
const invoiceDatesFields = {
    issueDate: businessDateSchema.optional(),
    dueDate: businessDateSchema.optional(),
};

/** POST /claims/:claimId/invoice — certified → invoiced; the invoice is issued at once (number `INV`). */
export const invoiceArClaimRequestSchema = z.object({ ...invoiceDatesFields, language: docLanguageSchema.optional(), note: noteField.optional() }).strict();
export type InvoiceArClaimRequest = z.infer<typeof invoiceArClaimRequestSchema>;

/** POST /main-contracts/:contractId/advance-invoice — a draft advance invoice (issue it with /invoices/:id/issue). */
export const createAdvanceInvoiceRequestSchema = z.object({ ...invoiceDatesFields, language: docLanguageSchema.optional(), note: noteField.optional() }).strict();
export type CreateAdvanceInvoiceRequest = z.infer<typeof createAdvanceInvoiceRequestSchema>;

/** POST /main-contracts/:contractId/retention-release-invoice — a draft invoice paying back held retention (no VAT / WHT). */
export const createRetentionReleaseInvoiceRequestSchema = z.object({
    amount: amountSchema.gt(0),
    ...invoiceDatesFields,
    language: docLanguageSchema.optional(),
    note: noteField.optional(),
}).strict();
export type CreateRetentionReleaseInvoiceRequest = z.infer<typeof createRetentionReleaseInvoiceRequestSchema>;

/** POST /invoices/:invoiceId/issue — draft → issued (number `INV`, snapshots). */
export const issueInvoiceRequestSchema = z.object(invoiceDatesFields).strict();
export type IssueInvoiceRequest = z.infer<typeof issueInvoiceRequestSchema>;

/** POST /invoices/:invoiceId/void — not paid in any part (409 `invoice_has_receipts`). */
export const voidInvoiceRequestSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export type VoidInvoiceRequest = z.infer<typeof voidInvoiceRequestSchema>;

// ── Receipts, tax invoices, credit notes, receivables (WP-30, docs/erp/02-domain-model.md §4.2, §4.3, §4.5) ──
// A receipt (`ar_receipts`, number `RC`) settles one or more invoices of one customer: per invoice cash + the WHT the
// customer withheld. A tax invoice (`kind='tax_invoice'`, `source='receipt'`, number `TI`) is issued per invoice for the
// share settled when the company is VAT registered (or ahead of payment for what is left). A credit note
// (`kind='credit_note'`, number `CN`) reduces a tax invoice. Permission to record any of them: `billing.receive`.

export const RECEIPT_METHODS = ['transfer', 'cash', 'cheque', 'promptpay', 'other'] as const;
export const receiptMethodSchema = z.enum(RECEIPT_METHODS);
export type ReceiptMethod = z.infer<typeof receiptMethodSchema>;
export const RECEIPT_STATUSES = ['issued', 'voided'] as const;
export const receiptStatusSchema = z.enum(RECEIPT_STATUSES);
export type ReceiptStatus = z.infer<typeof receiptStatusSchema>;

export const receiptAllocationDtoSchema = z.object({
    invoiceId: uuidSchema,
    invoiceNumber: z.string().nullable(),
    projectId: uuidSchema.nullable(),
    cash: z.number(),
    wht: z.number(),
    /** cash + wht. */
    settled: z.number(),
    /** The tax invoice issued for this allocation (null = none). */
    taxInvoiceId: uuidSchema.nullable(),
});
export type ReceiptAllocationDto = z.infer<typeof receiptAllocationDtoSchema>;

export const receiptDtoSchema = z.object({
    id: uuidSchema,
    customerId: uuidSchema,
    /** Set when every allocated invoice is of one project. */
    projectId: uuidSchema.nullable(),
    number: z.string(),
    receiptDate: businessDateSchema,
    method: receiptMethodSchema,
    bankRef: z.string(),
    cashAmount: z.number(),
    whtAmount: z.number(),
    whtCertificateNo: z.string(),
    whtCertificateFileId: uuidSchema.nullable(),
    taxInvoiceIds: z.array(uuidSchema),
    status: receiptStatusSchema,
    /** Payment slips (purpose `payment_slip`). */
    fileIds: z.array(uuidSchema),
    language: docLanguageSchema,
    customerSnapshot: quotationCustomerSnapshotSchema.nullable(),
    companySnapshot: quotationCompanySnapshotSchema.nullable(),
    note: z.string(),
    voidReason: z.string(),
    voidedAt: isoDateTimeSchema.nullable(),
    allocations: z.array(receiptAllocationDtoSchema),
    /** The tax invoices of the receipt (also readable with GET /invoices/:id). */
    taxInvoices: z.array(invoiceDtoSchema),
    /** It may still be voided (same Bangkok day it was recorded, `billing.receive`). */
    canVoid: z.boolean(),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
});
export type ReceiptDto = z.infer<typeof receiptDtoSchema>;

const moneyIn = amountSchema;

export const receiptAllocationInputSchema = z.object({
    invoiceId: uuidSchema,
    /** Cash (or transfer) received for this invoice. */
    cash: moneyIn,
    /** WHT the customer withheld on this invoice (0 when none). */
    wht: moneyIn.default(0),
}).strict();
export type ReceiptAllocationInput = z.infer<typeof receiptAllocationInputSchema>;

/**
 * POST /workspaces/:workspaceId/receipts — numbered at once (`RC`). Every invoice must be of one customer (422
 * `customer_mismatch`) and issued / partially paid; above what is due → 422 `overpayment`. `issueTaxInvoice` defaults to
 * the company's VAT registration; true while not registered → 422 `not_vat_registered`; a juristic customer without a
 * tax id → 422 `customer_tax_id_required`.
 */
export const createReceiptRequestSchema = z.object({
    customerId: uuidSchema.optional(),
    receiptDate: businessDateSchema.optional(),
    method: receiptMethodSchema,
    bankRef: z.string().trim().max(200).optional(),
    allocations: z.array(receiptAllocationInputSchema).min(1).max(100),
    whtCertificateNo: z.string().trim().max(100).optional(),
    whtCertificateFileId: uuidSchema.nullable().optional(),
    fileIds: z.array(uuidSchema).max(20).optional(),
    issueTaxInvoice: z.boolean().optional(),
    language: docLanguageSchema.optional(),
    note: noteField.optional(),
}).strict();
export type CreateReceiptRequest = z.infer<typeof createReceiptRequestSchema>;

/** POST /receipts/:receiptId/void — only on the Bangkok day it was recorded (409 `receipt_void_window`). */
export const voidReceiptRequestSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export type VoidReceiptRequest = z.infer<typeof voidReceiptRequestSchema>;

/** POST /invoices/:invoiceId/tax-invoice — a tax invoice ahead of payment for everything not on one yet. */
export const issueTaxInvoiceRequestSchema = z.object({
    issueDate: businessDateSchema.optional(),
    language: docLanguageSchema.optional(),
    note: noteField.optional(),
}).strict();
export type IssueTaxInvoiceRequest = z.infer<typeof issueTaxInvoiceRequestSchema>;

/** POST /invoices/:invoiceId/credit-note — on an issued tax invoice; `amount` without VAT, at most what is not credited yet. */
export const createCreditNoteRequestSchema = z.object({
    amount: amountSchema.gt(0),
    reason: z.string().trim().min(1).max(500),
    issueDate: businessDateSchema.optional(),
    language: docLanguageSchema.optional(),
}).strict();
export type CreateCreditNoteRequest = z.infer<typeof createCreditNoteRequestSchema>;

export const AR_AGING_BUCKETS = ['current', '1_30', '31_60', '61_90', 'over_90'] as const;
export const arAgingBucketSchema = z.enum(AR_AGING_BUCKETS);
export type ArAgingBucket = z.infer<typeof arAgingBucketSchema>;
const agingBucketsSchema = z.object({ current: z.number(), '1_30': z.number(), '31_60': z.number(), '61_90': z.number(), over_90: z.number() });

/** GET /workspaces/:workspaceId/receivables/aging — open invoices (issued / partially paid) by days past due. */
export const arAgingDtoSchema = z.object({
    asOf: businessDateSchema,
    buckets: agingBucketsSchema,
    total: z.number(),
    overdue: z.number(),
    customers: z.array(z.object({
        customerId: uuidSchema,
        customerName: z.string(),
        buckets: agingBucketsSchema,
        total: z.number(),
        overdue: z.number(),
    })),
    invoices: z.array(z.object({
        invoiceId: uuidSchema,
        number: z.string().nullable(),
        kind: invoiceKindSchema,
        projectId: uuidSchema.nullable(),
        customerId: uuidSchema,
        customerName: z.string(),
        issueDate: businessDateSchema,
        dueDate: businessDateSchema,
        /** payable + whtExpected. */
        due: z.number(),
        paidAmount: z.number(),
        outstanding: z.number(),
        daysOverdue: z.number().int(),
        bucket: arAgingBucketSchema,
    })),
});
export type ArAgingDto = z.infer<typeof arAgingDtoSchema>;

export const customerStatementQuerySchema = z.object({
    from: businessDateSchema.optional(),
    to: businessDateSchema.optional(),
});
export type CustomerStatementQuery = z.infer<typeof customerStatementQuerySchema>;

/** GET /customers/:customerId/statement — invoices (debit = payable + whtExpected) and receipts (credit = settled). */
export const customerStatementDtoSchema = z.object({
    customerId: uuidSchema,
    customerName: z.string(),
    from: businessDateSchema.nullable(),
    to: businessDateSchema,
    openingBalance: z.number(),
    entries: z.array(z.object({
        date: businessDateSchema,
        type: z.enum(['invoice', 'receipt']),
        documentId: uuidSchema,
        number: z.string().nullable(),
        kind: invoiceKindSchema.nullable(),
        projectId: uuidSchema.nullable(),
        debit: z.number(),
        credit: z.number(),
        balance: z.number(),
    })),
    closingBalance: z.number(),
    /** Open invoices now (independent of the dates). */
    openInvoices: z.array(invoiceDtoSchema),
});
export type CustomerStatementDto = z.infer<typeof customerStatementDtoSchema>;

/** GET /invoices/:invoiceId/promptpay — EMVCo payload of the cash still to pay (render it as a QR on the web). */
export const invoicePromptPayDtoSchema = z.object({
    invoiceId: uuidSchema,
    promptpayId: z.string(),
    /** Cash still to pay (WHT share left out). */
    amount: z.number(),
    payload: z.string(),
});
export type InvoicePromptPayDto = z.infer<typeof invoicePromptPayDtoSchema>;

/** `payload` of a customer link of subject `invoice` (view only: no costs, no other documents). */
export const invoiceLinkPayloadSchema = z.object({
    invoice: invoiceDtoSchema,
    projectName: z.string(),
    outstanding: z.number(),
    /** null when the company has no PromptPay id or nothing is left to pay. */
    promptpay: invoicePromptPayDtoSchema.nullable(),
    bankAccounts: z.array(bankAccountSchema),
});
export type InvoiceLinkPayload = z.infer<typeof invoiceLinkPayloadSchema>;
