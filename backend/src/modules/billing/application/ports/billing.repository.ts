import type {
    ArAdvanceEntryKind, ArRetentionEntryKind, ArClaimStatus, DocLanguage, InvoiceKind, InvoiceLine, InvoiceSource, InvoiceStatus,
    MainContractBillingMode, QuotationCompanySnapshot, QuotationCustomerSnapshot, ReceiptMethod, ReceiptStatus,
} from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** One `ar_claims` row. */
export interface ClaimRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    contractId: string;
    milestoneId: string | null;
    mode: MainContractBillingMode;
    claimNo: number;
    periodFrom: string | null;
    periodTo: string | null;
    status: ArClaimStatus;
    workValue: number;
    cumulativeValue: number;
    previousValue: number;
    isFinal: boolean;
    advanceRecovery: number;
    retention: number;
    penalty: number;
    penaltyDays: number;
    penaltyOverride: number | null;
    penaltyMax: number;
    escalation: number;
    escalationK: number | null;
    escalationIndices: Record<string, number>;
    otherDeduction: number;
    otherDeductionNote: string;
    vatBase: number;
    vat: number;
    wht: number;
    payable: number;
    certifiedByName: string;
    certifiedAt: string | null;
    certifiedNote: string;
    invoiceId: string | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `ar_claim_lines` row. */
export interface ClaimLineRecord {
    claimId: string;
    costCodeId: string;
    workspaceId: WorkspaceId;
    contractAmount: number;
    prevProgress: number;
    cumProgress: number;
    prevAmount: number;
    cumAmount: number;
    thisAmount: number;
    note: string;
}

/** One `ar_invoices` row. */
export interface InvoiceRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId | null;
    contractId: string | null;
    claimId: string | null;
    milestoneId: string | null;
    customerId: string;
    kind: InvoiceKind;
    source: InvoiceSource;
    number: string | null;
    status: InvoiceStatus;
    issueDate: string;
    dueDate: string;
    language: DocLanguage;
    customerSnapshot: QuotationCustomerSnapshot | null;
    companySnapshot: QuotationCompanySnapshot | null;
    lines: InvoiceLine[];
    net: number;
    vat: number;
    total: number;
    retention: number;
    advanceRecovery: number;
    penalty: number;
    whtExpected: number;
    payable: number;
    paidAmount: number;
    relatedInvoiceId: string | null;
    note: string;
    voidReason: string;
    issuedBy: UserId | null;
    issuedAt: Date | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `ar_retention_entries` row. */
export interface RetentionEntryRecord {
    id: string;
    workspaceId: WorkspaceId;
    contractId: string;
    projectId: ProjectId;
    kind: ArRetentionEntryKind;
    amount: number;
    claimId: string | null;
    invoiceId: string | null;
    entryDate: string;
    note: string;
    createdBy: UserId;
    createdAt: Date;
}

/** One `ar_advance_entries` row. */
export interface AdvanceEntryRecord {
    id: string;
    workspaceId: WorkspaceId;
    contractId: string;
    projectId: ProjectId;
    kind: ArAdvanceEntryKind;
    amount: number;
    invoiceId: string | null;
    claimId: string | null;
    /** The receipt that recorded a `received` row. */
    receiptId: string | null;
    entryDate: string;
    createdBy: UserId;
    createdAt: Date;
}

/** One `ar_receipts` row. */
export interface ReceiptRecord {
    id: string;
    workspaceId: WorkspaceId;
    customerId: string;
    projectId: ProjectId | null;
    number: string;
    receiptDate: string;
    method: ReceiptMethod;
    bankRef: string;
    cashAmount: number;
    whtAmount: number;
    whtCertificateNo: string;
    whtCertificateFileId: string | null;
    taxInvoiceIds: string[];
    status: ReceiptStatus;
    fileIds: string[];
    language: DocLanguage;
    customerSnapshot: QuotationCustomerSnapshot | null;
    companySnapshot: QuotationCompanySnapshot | null;
    note: string;
    voidReason: string;
    voidedAt: Date | null;
    voidedBy: UserId | null;
    createdBy: UserId;
    createdAt: Date;
}

/** One `ar_receipt_allocations` row. */
export interface ReceiptAllocationRecord {
    receiptId: string;
    invoiceId: string;
    workspaceId: WorkspaceId;
    cash: number;
    wht: number;
    settled: number;
    taxInvoiceId: string | null;
}

/** Tables `ar_*`. Every method filters by workspace except the by-id lookups (callers then check access). */
export abstract class BillingRepository {
    abstract findClaim(claimId: string): Promise<ClaimRecord | undefined>;
    /** `select … for update` of the claim row. */
    abstract lockClaim(workspaceId: WorkspaceId, claimId: string): Promise<ClaimRecord | undefined>;
    /** Claims of a contract by `claim_no`. */
    abstract claimsOfContract(workspaceId: WorkspaceId, contractId: string): Promise<ClaimRecord[]>;
    /** Claims of many projects (guards, roll-up). */
    abstract claimsOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<ClaimRecord[]>;
    /** A second open claim of the contract, or a taken `claim_no`, throws (unique keys). */
    abstract insertClaim(c: ClaimRecord): Promise<void>;
    abstract saveClaim(c: ClaimRecord): Promise<void>;
    abstract linesOf(workspaceId: WorkspaceId, claimIds: readonly string[]): Promise<ClaimLineRecord[]>;
    abstract replaceLines(workspaceId: WorkspaceId, claimId: string, lines: readonly ClaimLineRecord[]): Promise<void>;

    abstract findInvoice(invoiceId: string): Promise<InvoiceRecord | undefined>;
    abstract lockInvoice(workspaceId: WorkspaceId, invoiceId: string): Promise<InvoiceRecord | undefined>;
    /** Newest first. */
    abstract invoicesOfProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<InvoiceRecord[]>;
    abstract invoicesOfContract(workspaceId: WorkspaceId, contractId: string): Promise<InvoiceRecord[]>;
    abstract invoicesOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<InvoiceRecord[]>;
    abstract insertInvoice(i: InvoiceRecord): Promise<void>;
    abstract saveInvoice(i: InvoiceRecord): Promise<void>;
    /** Tax invoices / credit notes whose `related_invoice_id` is the invoice, oldest first. */
    abstract relatedInvoices(workspaceId: WorkspaceId, invoiceId: string): Promise<InvoiceRecord[]>;
    /** Every invoice (any kind / status) of a customer, oldest first. */
    abstract invoicesOfCustomer(workspaceId: WorkspaceId, customerId: string): Promise<InvoiceRecord[]>;
    /** Receivable invoices (`invoice` / `advance_invoice`, issued or partially paid) of a workspace. */
    abstract openInvoices(workspaceId: WorkspaceId): Promise<InvoiceRecord[]>;
    /** Receivable invoices of every workspace due between the dates (inclusive), at most `limit` (daily sweep). */
    abstract openInvoicesDueBetween(from: string, to: string, limit: number): Promise<InvoiceRecord[]>;

    abstract findReceipt(receiptId: string): Promise<ReceiptRecord | undefined>;
    abstract lockReceipt(workspaceId: WorkspaceId, receiptId: string): Promise<ReceiptRecord | undefined>;
    /** A taken number throws (unique key). */
    abstract insertReceipt(r: ReceiptRecord): Promise<void>;
    abstract saveReceipt(r: ReceiptRecord): Promise<void>;
    /** Oldest first. */
    abstract receiptsOfCustomer(workspaceId: WorkspaceId, customerId: string): Promise<ReceiptRecord[]>;
    abstract insertAllocations(rows: readonly ReceiptAllocationRecord[]): Promise<void>;
    abstract allocationsOf(workspaceId: WorkspaceId, receiptIds: readonly string[]): Promise<ReceiptAllocationRecord[]>;

    /** Oldest first. */
    abstract retentionEntries(workspaceId: WorkspaceId, contractId: string): Promise<RetentionEntryRecord[]>;
    abstract insertRetentionEntry(e: RetentionEntryRecord): Promise<void>;
    /** Rows written by an invoice that is voided (before any receipt). */
    abstract deleteRetentionEntriesOfInvoice(workspaceId: WorkspaceId, invoiceId: string): Promise<void>;
    /** Oldest first. */
    abstract advanceEntries(workspaceId: WorkspaceId, contractId: string): Promise<AdvanceEntryRecord[]>;
    abstract insertAdvanceEntry(e: AdvanceEntryRecord): Promise<void>;
    abstract deleteAdvanceEntriesOfInvoice(workspaceId: WorkspaceId, invoiceId: string): Promise<void>;
    abstract deleteAdvanceEntriesOfReceipt(workspaceId: WorkspaceId, receiptId: string): Promise<void>;
    /** Retention / advance rows of many projects (totals, roll-up). */
    abstract retentionEntriesOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<RetentionEntryRecord[]>;
    abstract advanceEntriesOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<AdvanceEntryRecord[]>;
    /** Contracts of every workspace that ever withheld retention, at most `limit` (daily sweep). */
    abstract contractsWithRetention(limit: number): Promise<{ workspaceId: WorkspaceId; contractId: string }[]>;

    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
