import type {
    ApPaymentMethod, ApPaymentStatus, BillLineMatch, BillMatchStatus, CostCategory, PaymentRunStatus, SupplierBillKind, SupplierBillStatus,
    SupplierWhtPreset, WhtCertificateStatus, WhtCondition, WhtForm, WhtIncomeType, WhtPayeeSnapshot, WhtPayerSnapshot,
} from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** One `ap_bills` row. */
export interface BillRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId | null;
    supplierId: string | null;
    payPeriodId: string | null;
    kind: SupplierBillKind;
    number: string | null;
    billDate: string;
    supplierInvoiceNo: string;
    supplierInvoiceDate: string | null;
    taxInvoiceNo: string;
    taxInvoiceDate: string | null;
    inputVatClaimable: boolean;
    status: SupplierBillStatus;
    dueDate: string;
    orderId: string | null;
    scClaimId: string | null;
    vatRate: number;
    subtotal: number;
    discount: number;
    vat: number;
    total: number;
    whtPreset: SupplierWhtPreset;
    whtRate: number;
    whtAmount: number;
    retentionAmount: number;
    payable: number;
    paidAmount: number;
    matchStatus: BillMatchStatus;
    fileIds: string[];
    note: string;
    approvedBy: UserId | null;
    approvedAt: Date | null;
    voidedAt: Date | null;
    voidReason: string;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `ap_bill_lines` row. */
export interface BillLineRecord {
    id: string;
    billId: string;
    workspaceId: WorkspaceId;
    orderLineId: string | null;
    costCodeId: string | null;
    category: CostCategory;
    desc: string;
    unit: string;
    qty: number;
    unitPrice: number;
    amount: number;
    match: BillLineMatch;
    billedQty: number;
    sort: number;
}

export interface BillListFilter {
    statuses?: readonly SupplierBillStatus[];
    kind?: SupplierBillKind;
    supplierId?: string;
    projectId?: ProjectId;
    /** Due on or before this date. */
    dueTo?: string;
}

/** One `ap_payment_runs` row (WP-50). */
export interface PaymentRunRecord {
    id: string;
    workspaceId: WorkspaceId;
    number: string | null;
    status: PaymentRunStatus;
    billIds: string[];
    payDate: string;
    method: ApPaymentMethod;
    note: string;
    totalCash: number;
    totalWht: number;
    approvedBy: UserId | null;
    approvedAt: Date | null;
    paidAt: Date | null;
    paidBy: UserId | null;
    cancelledAt: Date | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `ap_payments` row: a payment voucher. */
export interface PaymentRecord {
    id: string;
    workspaceId: WorkspaceId;
    runId: string | null;
    supplierId: string | null;
    payeeName: string;
    number: string;
    payDate: string;
    method: ApPaymentMethod;
    bankRef: string;
    cashAmount: number;
    whtAmount: number;
    whtCertificateId: string | null;
    status: ApPaymentStatus;
    fileIds: string[];
    createdBy: UserId;
    createdAt: Date;
}

/** One `ap_payment_allocations` row. */
export interface PaymentAllocationRecord {
    paymentId: string;
    billId: string;
    workspaceId: WorkspaceId;
    settled: number;
    wht: number;
    cash: number;
}

/** One `ap_wht_certificates` row (50 ทวิ). */
export interface WhtCertificateRecord {
    id: string;
    workspaceId: WorkspaceId;
    number: string;
    bookNo: string;
    paymentId: string;
    payeeSnapshot: WhtPayeeSnapshot;
    payerSnapshot: WhtPayerSnapshot;
    form: WhtForm;
    incomeType: WhtIncomeType;
    incomeDesc: string;
    payDate: string;
    baseAmount: number;
    whtRate: number;
    whtAmount: number;
    condition: WhtCondition;
    status: WhtCertificateStatus;
    issuedAt: Date;
    createdBy: UserId;
}

/** Supplier bills. Every method filters by `workspaceId` except `find` (the route carries only the id) and `dueOn`. */
export abstract class PayablesRepository {
    /** Serializes bill creation / posting of a workspace (duplicate checks) until the transaction ends. */
    abstract lockWorkspace(workspaceId: WorkspaceId): Promise<void>;
    abstract find(billId: string): Promise<BillRecord | undefined>;
    abstract lock(workspaceId: WorkspaceId, billId: string): Promise<BillRecord | undefined>;
    /** Newest first (bill date, creation). */
    abstract list(workspaceId: WorkspaceId, filter: BillListFilter): Promise<BillRecord[]>;
    abstract insert(bill: BillRecord, lines: readonly BillLineRecord[]): Promise<void>;
    abstract save(bill: BillRecord): Promise<void>;
    abstract linesOf(workspaceId: WorkspaceId, billId: string): Promise<BillLineRecord[]>;
    abstract replaceLines(workspaceId: WorkspaceId, billId: string, lines: readonly BillLineRecord[]): Promise<void>;
    abstract saveLines(lines: readonly BillLineRecord[]): Promise<void>;
    /** A bill (not voided) of the supplier with this invoice number, other than `exceptId`. */
    abstract findByInvoiceNo(workspaceId: WorkspaceId, supplierId: string, invoiceNo: string, exceptId?: string): Promise<BillRecord | undefined>;
    /** The bill (not voided) of a pay period. */
    abstract findByPayPeriod(workspaceId: WorkspaceId, periodId: string): Promise<BillRecord | undefined>;
    /** Claim ids among `claimIds` that have a bill (not voided). */
    abstract billedClaims(workspaceId: WorkspaceId, claimIds: readonly string[]): Promise<Set<string>>;
    /** Bills of every workspace in these statuses due exactly on `date` (the due-soon sweep). */
    abstract dueOn(date: string, statuses: readonly SupplierBillStatus[], limit: number): Promise<BillRecord[]>;
    /** Memory adapter: forget a deleted project's bills (PostgreSQL drops them with the project). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;

    /** Bills of the workspace among these ids (any status). */
    abstract findMany(workspaceId: WorkspaceId, billIds: readonly string[]): Promise<BillRecord[]>;

    // ── payment runs, payments, WHT certificates (WP-50) ──
    abstract findRun(runId: string): Promise<PaymentRunRecord | undefined>;
    abstract lockRun(workspaceId: WorkspaceId, runId: string): Promise<PaymentRunRecord | undefined>;
    /** Newest first (pay date, creation). */
    abstract listRuns(workspaceId: WorkspaceId, statuses?: readonly PaymentRunStatus[]): Promise<PaymentRunRecord[]>;
    abstract insertRun(run: PaymentRunRecord): Promise<void>;
    abstract saveRun(run: PaymentRunRecord): Promise<void>;
    abstract insertPayment(payment: PaymentRecord, allocations: readonly PaymentAllocationRecord[]): Promise<void>;
    abstract findPayment(paymentId: string): Promise<PaymentRecord | undefined>;
    /** Payments of a run, in number order. */
    abstract paymentsOfRun(workspaceId: WorkspaceId, runId: string): Promise<PaymentRecord[]>;
    abstract allocationsOf(workspaceId: WorkspaceId, paymentId: string): Promise<PaymentAllocationRecord[]>;
    abstract insertCertificate(certificate: WhtCertificateRecord): Promise<void>;
    abstract findCertificate(certificateId: string): Promise<WhtCertificateRecord | undefined>;
    abstract certificatesOf(workspaceId: WorkspaceId, certificateIds: readonly string[]): Promise<WhtCertificateRecord[]>;
}
