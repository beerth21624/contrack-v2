import type {
    BillLineMatch, BillMatchStatus, CostCategory, SupplierBillKind, SupplierBillStatus, SupplierWhtPreset,
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
}
