import type {
    BudgetWarning, DocLanguage, GoodsReceiptPhoto, GoodsReceiptStatus, PurchaseOrderStatus, PurchaseRequestSource, PurchaseRequestStatus,
    ReceiptCondition, RfqQuoteLine, RfqStatus, RfqSupplierStatus, SupplierSnapshot, SupplierWhtPreset,
} from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** One `pc_requests` row. */
export interface PurchaseRequestRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    number: string | null;
    status: PurchaseRequestStatus;
    source: PurchaseRequestSource;
    requiredDate: string | null;
    requestedBy: UserId;
    note: string;
    estTotal: number;
    budgetWarnings: BudgetWarning[];
    overrideReason: string;
    submittedAt: Date | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `pc_request_lines` row. */
export interface PurchaseRequestLineRecord {
    id: string;
    requestId: string;
    workspaceId: WorkspaceId;
    costCodeId: string | null;
    descTh: string;
    descEn: string;
    unit: string;
    qty: number;
    estUnitPrice: number;
    estAmount: number;
    orderedQty: number;
    note: string;
    sort: number;
}

/** Statuses whose lines count as "requested before" in the budget check (closed ones count what was ordered). */
export const REQUESTED_STATUSES: readonly PurchaseRequestStatus[] = ['pending_approval', 'approved', 'partially_ordered', 'ordered', 'closed'];

/** Quantity a line holds of its cost code: closed requests keep only what was ordered. */
export const heldQty = (status: PurchaseRequestStatus, l: Pick<PurchaseRequestLineRecord, 'qty' | 'orderedQty'>): number =>
    status === 'closed' ? l.orderedQty : Math.max(l.qty, l.orderedQty);

/** Tables `pc_requests` / `pc_request_lines`. Every method filters by workspace except `find`. */
export abstract class PurchaseRequestRepository {
    abstract find(requestId: string): Promise<PurchaseRequestRecord | undefined>;
    /** `select … for update`. */
    abstract lock(workspaceId: WorkspaceId, requestId: string): Promise<PurchaseRequestRecord | undefined>;
    /** Newest first. */
    abstract listByProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<PurchaseRequestRecord[]>;
    abstract findMany(workspaceId: WorkspaceId, requestIds: readonly string[]): Promise<PurchaseRequestRecord[]>;
    /** A second (workspace, number) throws. */
    abstract insert(r: PurchaseRequestRecord): Promise<void>;
    abstract save(r: PurchaseRequestRecord): Promise<void>;

    /** `sort` order. */
    abstract linesOf(workspaceId: WorkspaceId, requestId: string): Promise<PurchaseRequestLineRecord[]>;
    /** Lines by id (unknown ids left out). */
    abstract linesByIds(workspaceId: WorkspaceId, lineIds: readonly string[]): Promise<PurchaseRequestLineRecord[]>;
    abstract replaceLines(workspaceId: WorkspaceId, requestId: string, lines: readonly PurchaseRequestLineRecord[]): Promise<void>;
    abstract lineCounts(workspaceId: WorkspaceId, requestIds: readonly string[]): Promise<Map<string, number>>;
    /**
     * Quantity per cost code held by the project's requests in REQUESTED_STATUSES (see `heldQty`), leaving out the
     * request `exceptRequestId`.
     */
    abstract requestedQty(
        workspaceId: WorkspaceId, projectId: ProjectId, costCodeIds: readonly string[], exceptRequestId: string | null,
    ): Promise<Map<string, number>>;
    /** Adds `qty` (may be negative) to each line's `ordered_qty`. */
    abstract addOrderedQty(workspaceId: WorkspaceId, deltas: readonly { lineId: string; qty: number }[]): Promise<void>;

    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}

/** One `pc_rfqs` row. */
export interface RfqRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    number: string | null;
    status: RfqStatus;
    title: string;
    dueDate: string | null;
    deliveryAddress: string;
    language: DocLanguage;
    requestIds: string[];
    awardedSupplierId: string | null;
    awardedAt: Date | null;
    sentAt: Date | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `pc_rfq_lines` row. */
export interface RfqLineRecord {
    id: string;
    rfqId: string;
    workspaceId: WorkspaceId;
    requestLineId: string | null;
    costCodeId: string | null;
    descTh: string;
    descEn: string;
    unit: string;
    qty: number;
    budgetUnitPrice: number;
    sort: number;
}

/** One `pc_rfq_suppliers` row. */
export interface RfqSupplierRecord {
    rfqId: string;
    supplierId: string;
    workspaceId: WorkspaceId;
    status: RfqSupplierStatus;
    invitedAt: Date;
    quotedAt: Date | null;
}

/** One `pc_rfq_quotes` row. */
export interface RfqQuoteRecord {
    id: string;
    rfqId: string;
    supplierId: string;
    workspaceId: WorkspaceId;
    quoteRef: string;
    quoteDate: string | null;
    validUntil: string | null;
    pricesIncludeVat: boolean;
    deliveryDays: number | null;
    paymentTermDays: number | null;
    lines: RfqQuoteLine[];
    subtotal: number;
    vat: number;
    total: number;
    fileIds: string[];
    note: string;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

export interface RfqCounts {
    lines: number;
    suppliers: number;
    quotes: number;
}

/** Tables `pc_rfq*`. Every method filters by workspace except `find`. */
export abstract class RfqRepository {
    abstract find(rfqId: string): Promise<RfqRecord | undefined>;
    abstract lock(workspaceId: WorkspaceId, rfqId: string): Promise<RfqRecord | undefined>;
    /** Newest first. */
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<RfqRecord[]>;
    /** RFQs in `statuses` whose `request_ids` hold the request. */
    abstract withRequest(workspaceId: WorkspaceId, requestId: string, statuses: readonly RfqStatus[]): Promise<RfqRecord[]>;
    abstract insert(r: RfqRecord): Promise<void>;
    abstract save(r: RfqRecord): Promise<void>;

    abstract linesOf(workspaceId: WorkspaceId, rfqId: string): Promise<RfqLineRecord[]>;
    abstract replaceLines(workspaceId: WorkspaceId, rfqId: string, lines: readonly RfqLineRecord[]): Promise<void>;
    /** `invited_at` order. */
    abstract suppliersOf(workspaceId: WorkspaceId, rfqId: string): Promise<RfqSupplierRecord[]>;
    abstract replaceSuppliers(workspaceId: WorkspaceId, rfqId: string, rows: readonly RfqSupplierRecord[]): Promise<void>;
    abstract quotesOf(workspaceId: WorkspaceId, rfqId: string): Promise<RfqQuoteRecord[]>;
    /** Insert or replace the quote of (rfq, supplier). */
    abstract upsertQuote(q: RfqQuoteRecord): Promise<void>;
    abstract deleteQuote(workspaceId: WorkspaceId, rfqId: string, supplierId: string): Promise<void>;
    abstract counts(workspaceId: WorkspaceId, rfqIds: readonly string[]): Promise<Map<string, RfqCounts>>;

    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}

/** One `pc_orders` row. */
export interface PurchaseOrderRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    supplierId: string;
    rfqId: string | null;
    number: string | null;
    status: PurchaseOrderStatus;
    orderDate: string | null;
    deliveryDate: string | null;
    deliveryAddress: string;
    language: DocLanguage;
    supplierSnapshot: SupplierSnapshot | null;
    vatRate: number;
    subtotal: number;
    discount: number;
    vat: number;
    total: number;
    whtPreset: SupplierWhtPreset;
    paymentTermDays: number | null;
    terms: string;
    budgetWarnings: BudgetWarning[];
    overrideReason: string;
    issuedBy: UserId | null;
    issuedAt: Date | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `pc_order_lines` row. */
export interface PurchaseOrderLineRecord {
    id: string;
    orderId: string;
    workspaceId: WorkspaceId;
    costCodeId: string | null;
    requestLineId: string | null;
    descTh: string;
    descEn: string;
    unit: string;
    qty: number;
    unitPrice: number;
    amount: number;
    receivedQty: number;
    billedQty: number;
    sort: number;
}

/** Statuses whose lines hold quantity of a cost code in the PO budget check (closed ones count what was received). */
export const ORDERED_STATUSES: readonly PurchaseOrderStatus[] = ['pending_approval', 'issued', 'partially_received', 'received', 'closed'];

/** Quantity a PO line holds of its cost code: a closed PO keeps only what was received. */
export const orderHeldQty = (status: PurchaseOrderStatus, l: Pick<PurchaseOrderLineRecord, 'qty' | 'receivedQty'>): number =>
    status === 'closed' ? l.receivedQty : Math.max(l.qty, l.receivedQty);

/** One line of the price history of a supplier. */
export interface PriceHistoryRow {
    orderId: string;
    orderNumber: string | null;
    projectId: ProjectId;
    orderDate: string | null;
    issuedAt: Date | null;
    descTh: string;
    descEn: string;
    unit: string;
    qty: number;
    unitPrice: number;
    costCodeId: string | null;
}

/** Tables `pc_orders` / `pc_order_lines`. Every method filters by workspace except `find`. */
export abstract class PurchaseOrderRepository {
    abstract find(orderId: string): Promise<PurchaseOrderRecord | undefined>;
    abstract lock(workspaceId: WorkspaceId, orderId: string): Promise<PurchaseOrderRecord | undefined>;
    /** Newest first. */
    abstract listByProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<PurchaseOrderRecord[]>;
    /** Newest first; `statuses` empty / undefined = all. */
    abstract listByWorkspace(workspaceId: WorkspaceId, statuses?: readonly PurchaseOrderStatus[]): Promise<PurchaseOrderRecord[]>;
    /** A second (workspace, number) throws. */
    abstract insert(r: PurchaseOrderRecord): Promise<void>;
    abstract save(r: PurchaseOrderRecord): Promise<void>;

    /** `sort` order. */
    abstract linesOf(workspaceId: WorkspaceId, orderId: string): Promise<PurchaseOrderLineRecord[]>;
    abstract linesByIds(workspaceId: WorkspaceId, lineIds: readonly string[]): Promise<PurchaseOrderLineRecord[]>;
    abstract replaceLines(workspaceId: WorkspaceId, orderId: string, lines: readonly PurchaseOrderLineRecord[]): Promise<void>;
    /** Updates received / billed quantities of existing lines. */
    abstract saveLineProgress(workspaceId: WorkspaceId, lines: readonly Pick<PurchaseOrderLineRecord, 'id' | 'receivedQty' | 'billedQty'>[]): Promise<void>;
    abstract lineCounts(workspaceId: WorkspaceId, orderIds: readonly string[]): Promise<Map<string, number>>;
    /**
     * Quantity per cost code held by the project's POs in ORDERED_STATUSES (see `orderHeldQty`), leaving out
     * `exceptOrderId`; `withoutRequestOnly` counts only lines typed on the PO (not ordering a purchase request line).
     */
    abstract orderedQty(
        workspaceId: WorkspaceId, projectId: ProjectId, costCodeIds: readonly string[], exceptOrderId: string | null, withoutRequestOnly: boolean,
    ): Promise<Map<string, number>>;
    /** Lines of the supplier's POs in PURCHASE_ORDER_ISSUED_STATUSES whose description contains `q`, newest first. */
    abstract priceHistory(workspaceId: WorkspaceId, supplierId: string, q: string, limit: number): Promise<PriceHistoryRow[]>;

    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}

/** One `pc_receipts` row. */
export interface GoodsReceiptRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    orderId: string;
    number: string | null;
    status: GoodsReceiptStatus;
    receivedDate: string;
    receivedBy: UserId;
    deliveryNoteNo: string;
    photos: GoodsReceiptPhoto[];
    note: string;
    amount: number;
    confirmedAt: Date | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `pc_receipt_lines` row. */
export interface GoodsReceiptLineRecord {
    id: string;
    receiptId: string;
    workspaceId: WorkspaceId;
    orderLineId: string;
    qtyReceived: number;
    qtyRejected: number;
    condition: ReceiptCondition;
    note: string;
    sort: number;
}

/** Tables `pc_receipts` / `pc_receipt_lines`. Every method filters by workspace except `find`. */
export abstract class GoodsReceiptRepository {
    abstract find(receiptId: string): Promise<GoodsReceiptRecord | undefined>;
    abstract lock(workspaceId: WorkspaceId, receiptId: string): Promise<GoodsReceiptRecord | undefined>;
    /** Oldest first. */
    abstract listByOrder(workspaceId: WorkspaceId, orderId: string): Promise<GoodsReceiptRecord[]>;
    /** A second (workspace, number) throws. */
    abstract insert(r: GoodsReceiptRecord): Promise<void>;
    abstract save(r: GoodsReceiptRecord): Promise<void>;
    /** `sort` order. */
    abstract linesOf(workspaceId: WorkspaceId, receiptId: string): Promise<GoodsReceiptLineRecord[]>;
    abstract replaceLines(workspaceId: WorkspaceId, receiptId: string, lines: readonly GoodsReceiptLineRecord[]): Promise<void>;

    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
