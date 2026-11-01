// ─── Shared parts of the payables use cases: transactions, access, bill lines + 3-way match, totals, views, posting ───
import { Injectable } from '@nestjs/common';
import {
    type BillMatchStatus, type CostCategory, type FinCounterpartyType, type Role, SUPPLIER_WHT_PRESET_RATE, type SupplierBillDto,
    type SupplierBillKind, type SupplierBillLineInput, type SupplierBillSummaryDto, type SupplierWhtPreset,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { round2, roundQty, sumMoney, vatOf, whtOf } from '@contrack/domain/money';
import { lineNetAmounts, orderLineAmount } from '@contrack/domain/procurement/order-totals';
import { threeWayMatch } from '@contrack/domain/procurement/three-way-match';
import { type WorkspaceGrant, ModuleAccess } from '../../../shared/application/module-access';
import {
    Approvals, AuditLog, Clock, CostCodeLookup, CostLedger, type CostLedgerEntryInput, DocumentNumbering, FinancialEvents,
    IdGenerator, type PurchaseOrderLineInfo, PurchaseOrders, type Supplier, SupplierLookup, UnitOfWork,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../shared/domain/ids';
import { can } from '../../../shared/domain/permissions';
import { type Result, err, ok, okVoid } from '../../../shared/domain/result';
import { requireBillTransition } from '../domain/payables-state';
import { type BillLineRecord, type BillRecord, PayablesRepository } from './ports/payables.repository';

export const MODULE = 'payables';
/** Cost ledger / fin_events `source_type` and numbering subject of a bill. */
export const BILL_SOURCE = 'supplier_bill';
export const APPROVAL_SUBJECT = 'supplier_bill.approve' as const;

export const READ = 'payables.read' as const;
export const MANAGE = 'payables.manage' as const;

/** Thrown inside a transaction so an `err` rolls it back (the UnitOfWork commits on a normal return). */
class Rollback extends Error {
    constructor(readonly error: DomainError) {
        super(error.message);
    }
}

/** Runs `work` in one transaction; an `err` result rolls everything back and is returned. Joins an open transaction. */
export async function transact<T>(uow: UnitOfWork, work: () => Promise<Result<T, DomainError>>): Promise<Result<T, DomainError>> {
    try {
        return await uow.run(async () => {
            const r = await work();
            if (!r.ok) throw new Rollback(r.error);
            return r;
        });
    } catch (e) {
        if (e instanceof Rollback) return err(e.error);
        throw e;
    }
}

export const billNotFound = (): DomainError => DomainError.notFound('SupplierBill');

export const supplierDisplayName = (s: Pick<Supplier, 'nameTh' | 'nameEn'> | undefined): string =>
    s === undefined ? '' : s.nameTh !== '' ? s.nameTh : s.nameEn;

/** Category of a typed line when none is given. */
export function defaultCategory(kind: SupplierBillKind): CostCategory {
    switch (kind) {
        case 'material': return 'material';
        case 'subcontract': return 'subcontract';
        case 'labour': return 'labour';
        default: return 'other';
    }
}

/** Counterparty type of a bill's fin_events. */
export const counterpartyOf = (kind: SupplierBillKind): FinCounterpartyType =>
    kind === 'labour' ? 'worker' : kind === 'subcontract' ? 'subcontractor' : 'supplier';

export interface BillTotals {
    subtotal: number;
    discount: number;
    vat: number;
    total: number;
    whtAmount: number;
    payable: number;
}

/**
 * subtotal = Σ line amounts; base = subtotal − discount; vat = given, else round2(base × vatRate); total = base + vat;
 * wht = given, else round2(base × whtRate) (before VAT); payable = total − wht − retention.
 */
export function billTotals(input: {
    amounts: readonly number[]; discount: number; vatRate: number; vat?: number; whtRate: number; wht?: number; retention: number;
}): Result<BillTotals, DomainError> {
    const subtotal = sumMoney(input.amounts);
    const discount = round2(input.discount);
    if (discount > subtotal) {
        return err(DomainError.unprocessable('The discount is more than the subtotal', { reason: 'discount_exceeds_subtotal' }));
    }
    const base = round2(subtotal - discount);
    const vat = input.vat === undefined ? vatOf(base, input.vatRate) : round2(input.vat);
    const total = round2(base + vat);
    const whtAmount = input.wht === undefined ? whtOf(base, input.whtRate) : round2(input.wht);
    return ok({ subtotal, discount, vat, total, whtAmount, payable: round2(total - whtAmount - round2(input.retention)) });
}

export const whtRateOf = (preset: SupplierWhtPreset): number => SUPPLIER_WHT_PRESET_RATE[preset];

/** Loads a bill by id and authorizes on its workspace (another tenant's id → 404). */
@Injectable()
export class PayablesAccess {
    constructor(private readonly access: ModuleAccess, private readonly repo: PayablesRepository) {}

    async bill(userId: UserId, billId: string, permission: typeof READ | typeof MANAGE): Promise<Result<{ grant: WorkspaceGrant; bill: BillRecord }, DomainError>> {
        if (!isUuid(billId)) return err(billNotFound());
        const bill = await this.repo.find(billId.toLowerCase());
        if (bill === undefined) return err(billNotFound());
        const grant = await this.access.inWorkspace(userId, bill.workspaceId, MODULE, permission);
        if (!grant.ok) return grant.error.code === 'not_found' ? err(billNotFound()) : grant;
        return ok({ grant: grant.value, bill });
    }

    /** A project of the workspace that is not archived (writes), with `payables.manage`. */
    async project(userId: UserId, workspaceId: WorkspaceId, projectId: string): Promise<Result<ProjectId, DomainError>> {
        if (!isUuid(projectId)) return err(DomainError.notFound('Project'));
        const grant = await this.access.toProject(userId, projectId.toLowerCase() as ProjectId, MODULE, { permissions: [MANAGE], write: true });
        if (!grant.ok) return grant;
        if (grant.value.workspaceId !== workspaceId) return err(DomainError.notFound('Project'));
        return ok(grant.value.projectId);
    }
}

/** A bill line before ids / sort are set. */
export type DraftBillLine = Omit<BillLineRecord, 'id' | 'billId' | 'workspaceId' | 'sort' | 'match' | 'billedQty'>;

@Injectable()
export class BillLines {
    constructor(
        private readonly costCodes: CostCodeLookup,
        private readonly orders: PurchaseOrders,
        private readonly ids: IdGenerator,
    ) {}

    /** Typed / PO lines → drafts. PO lines default description, unit, price and cost code to the PO line's. */
    async fromInput(
        workspaceId: WorkspaceId, projectId: ProjectId | null, kind: SupplierBillKind, inputs: readonly SupplierBillLineInput[],
        orderLines: readonly PurchaseOrderLineInfo[],
    ): Promise<Result<DraftBillLine[], DomainError>> {
        const byId = new Map(orderLines.map(l => [l.id, l]));
        const out: DraftBillLine[] = [];
        for (const l of inputs) {
            const orderLineId = l.orderLineId?.toLowerCase() ?? null;
            const po = orderLineId === null ? undefined : byId.get(orderLineId);
            if (orderLineId !== null && po === undefined) {
                return err(DomainError.unprocessable('The line is not a line of the purchase order', { reason: 'unknown_order_line', orderLineId }));
            }
            const qty = roundQty(l.qty);
            const unitPrice = roundQty(l.unitPrice ?? po?.unitPrice ?? 0);
            out.push({
                orderLineId, costCodeId: l.costCodeId === undefined ? po?.costCodeId ?? null : l.costCodeId?.toLowerCase() ?? null,
                category: l.category ?? (po === undefined ? defaultCategory(kind) : 'material'),
                desc: l.desc !== undefined && l.desc !== '' ? l.desc : po === undefined ? '' : po.descTh !== '' ? po.descTh : po.descEn,
                unit: l.unit !== undefined && l.unit !== '' ? l.unit : po?.unit ?? '',
                qty, unitPrice, amount: orderLineAmount(qty, unitPrice),
            });
        }
        const checked = await this.checkCostCodes(workspaceId, projectId, out);
        return checked.ok ? ok(out) : checked;
    }

    /** not_found `CostCode` when a line names a cost code that is not of the bill's project (or the bill has none). */
    async checkCostCodes(workspaceId: WorkspaceId, projectId: ProjectId | null, lines: readonly Pick<DraftBillLine, 'costCodeId'>[]): Promise<Result<void, DomainError>> {
        const wanted = [...new Set(lines.flatMap(l => (l.costCodeId === null ? [] : [l.costCodeId])))];
        if (wanted.length === 0) return okVoid();
        if (projectId === null) return err(DomainError.notFound('CostCode'));
        const found = await this.costCodes.findMany(workspaceId, projectId, wanted);
        return found.length < wanted.length ? err(DomainError.notFound('CostCode')) : okVoid();
    }

    /** Numbers the lines in order (match `no_po`, nothing billed yet). */
    build(workspaceId: WorkspaceId, billId: string, lines: readonly DraftBillLine[]): BillLineRecord[] {
        return lines.map((l, i) => ({ ...l, id: this.ids.newId(), billId, workspaceId, match: 'no_po' as const, billedQty: 0, sort: i + 1 }));
    }

    /** The PO lines with what was received / billed so far ([] without a PO). */
    orderLines(workspaceId: WorkspaceId, orderId: string | null): Promise<PurchaseOrderLineInfo[]> {
        return orderId === null ? Promise.resolve([]) : this.orders.linesWithReceived(workspaceId, orderId);
    }

    /**
     * 3-way match of the lines against the PO lines (as received / billed now): each line's `match`, the bill's status
     * (`not_applicable` without a PO; `exceptions` when a line exceeds the received quantity or differs in price).
     */
    match(orderId: string | null, lines: readonly BillLineRecord[], orderLines: readonly PurchaseOrderLineInfo[]): {
        lines: BillLineRecord[]; status: BillMatchStatus; billable: (number | null)[];
    } {
        const results = threeWayMatch(
            orderLines.map(l => ({ id: l.id, unitPrice: l.unitPrice, receivedQty: l.receivedQty, billedQty: l.billedQty })),
            lines.map(l => ({ orderLineId: l.orderLineId, qty: l.qty, unitPrice: l.unitPrice })),
        );
        const matched = lines.map((l, i) => ({ ...l, match: results[i]?.status ?? 'no_po' }));
        const exceptions = matched.some(l => l.match === 'qty_exceeds_received' || l.match === 'price_differs');
        const status: BillMatchStatus = orderId === null ? 'not_applicable' : exceptions ? 'exceptions' : 'matched';
        return { lines: matched, status, billable: results.map(r => r.billableQty) };
    }

    /** 409 `duplicate_supplier_invoice` when another live bill of the supplier has this invoice number. */
    async uniqueInvoice(repo: PayablesRepository, bill: Pick<BillRecord, 'workspaceId' | 'supplierId' | 'supplierInvoiceNo' | 'id'>): Promise<Result<void, DomainError>> {
        if (bill.supplierId === null || bill.supplierInvoiceNo === '') return okVoid();
        const other = await repo.findByInvoiceNo(bill.workspaceId, bill.supplierId, bill.supplierInvoiceNo, bill.id);
        if (other === undefined) return okVoid();
        return err(DomainError.conflict('The supplier already has a bill with this invoice number', {
            reason: 'duplicate_supplier_invoice', billId: other.id, number: other.number,
        }));
    }
}

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

export function billSummaryDto(b: BillRecord, supplierName: string): SupplierBillSummaryDto {
    return {
        id: b.id, workspaceId: b.workspaceId, projectId: b.projectId, supplierId: b.supplierId, supplierName, kind: b.kind, number: b.number,
        status: b.status, billDate: b.billDate, supplierInvoiceNo: b.supplierInvoiceNo, supplierInvoiceDate: b.supplierInvoiceDate,
        taxInvoiceNo: b.taxInvoiceNo, taxInvoiceDate: b.taxInvoiceDate, inputVatClaimable: b.inputVatClaimable, dueDate: b.dueDate,
        orderId: b.orderId, scClaimId: b.scClaimId, payPeriodId: b.payPeriodId, vatRate: b.vatRate, subtotal: b.subtotal,
        discount: b.discount, vat: b.vat, total: b.total, whtPreset: b.whtPreset, whtRate: b.whtRate, whtAmount: b.whtAmount,
        retentionAmount: b.retentionAmount, payable: b.payable, paidAmount: b.paidAmount, matchStatus: b.matchStatus, note: b.note,
        createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString(),
    };
}

@Injectable()
export class BillViews {
    constructor(
        private readonly repo: PayablesRepository,
        private readonly suppliers: SupplierLookup,
        private readonly orders: PurchaseOrders,
        private readonly lines: BillLines,
    ) {}

    async summaries(workspaceId: WorkspaceId, bills: readonly BillRecord[]): Promise<SupplierBillSummaryDto[]> {
        const ids = [...new Set(bills.flatMap(b => (b.supplierId === null ? [] : [b.supplierId])))];
        const names = new Map((ids.length === 0 ? [] : await this.suppliers.findMany(workspaceId, ids)).map(s => [s.id, supplierDisplayName(s)]));
        return bills.map(b => billSummaryDto(b, b.supplierId === null ? '' : names.get(b.supplierId) ?? ''));
    }

    async detail(b: BillRecord, role: Role): Promise<SupplierBillDto> {
        const ws = b.workspaceId;
        const [summary] = await this.summaries(ws, [b]);
        const lines = await this.repo.linesOf(ws, b.id);
        const orderLines = await this.lines.orderLines(ws, b.orderId);
        const po = new Map(orderLines.map(l => [l.id, l]));
        // A draft is matched against the PO as it is now; a posted bill shows the PO before its own quantities.
        const billable: (number | null)[] = b.status === 'draft' || b.status === 'pending_approval'
            ? this.lines.match(b.orderId, lines, orderLines).billable
            : lines.map(l => {
                const o = l.orderLineId === null ? undefined : po.get(l.orderLineId);
                return o === undefined ? null : roundQty(o.receivedQty - o.billedQty + l.billedQty);
            });
        const order = b.orderId === null ? undefined : await this.orders.find(ws, b.orderId);
        const manage = can(role, MANAGE);
        return {
            ...(summary ?? billSummaryDto(b, '')),
            lines: lines.map((l, i) => ({
                id: l.id, orderLineId: l.orderLineId, costCodeId: l.costCodeId, category: l.category, desc: l.desc, unit: l.unit, qty: l.qty,
                unitPrice: l.unitPrice, amount: l.amount, match: l.match, billedQty: l.billedQty,
                orderUnitPrice: l.orderLineId === null ? null : po.get(l.orderLineId)?.unitPrice ?? null, billableQty: billable[i] ?? null,
            })),
            fileIds: [...b.fileIds],
            orderNumber: order?.number ?? null,
            approvedBy: b.approvedBy,
            approvedAt: iso(b.approvedAt),
            voidedAt: iso(b.voidedAt),
            voidReason: b.voidReason,
            createdBy: b.createdBy,
            canEdit: manage && b.status === 'draft',
            canApprove: manage && b.status === 'draft',
            canVoid: manage && (b.status === 'draft' || b.status === 'pending_approval' || b.status === 'approved'),
        };
    }
}

/** Posting a bill (approved) and reversing it (void). Both run inside the caller's transaction, the bill locked. */
@Injectable()
export class BillPosting {
    constructor(
        private readonly repo: PayablesRepository,
        private readonly lines: BillLines,
        private readonly orders: PurchaseOrders,
        private readonly suppliers: SupplierLookup,
        private readonly numbering: DocumentNumbering,
        private readonly ledger: CostLedger,
        private readonly events: FinancialEvents,
        private readonly approvals: Approvals,
        private readonly audit: AuditLog,
        private readonly clock: Clock,
    ) {}

    /**
     * Draft / pending → approved: PO quantities billed (up to what was received; the rest stays an exception), number
     * `AP`, cost ledger `actual` for price differences against the PO and for lines without a PO (bills of a project,
     * not subcontract / labour: those costs were posted by their own modules), fin_events `ap.bill_posted`.
     */
    async post(b: BillRecord, by: UserId): Promise<Result<BillRecord, DomainError>> {
        const ws = b.workspaceId;
        const now = this.clock.now();
        const stored = await this.repo.linesOf(ws, b.id);
        const orderLines = await this.lines.orderLines(ws, b.orderId);
        const { lines, status } = this.lines.match(b.orderId, stored, orderLines);
        const po = new Map(orderLines.map(l => [l.id, l]));

        // Quantities counted on the PO lines: never past what was received (an excess stays an exception).
        const billedSoFar = new Map(orderLines.map(l => [l.id, l.billedQty]));
        const posted = lines.map(l => {
            const o = l.orderLineId === null ? undefined : po.get(l.orderLineId);
            if (o === undefined) return { ...l, billedQty: 0 };
            const before = billedSoFar.get(o.id) ?? 0;
            const qty = Math.max(0, Math.min(l.qty, roundQty(o.receivedQty - before)));
            billedSoFar.set(o.id, roundQty(before + qty));
            return { ...l, billedQty: roundQty(qty) };
        });
        const marks = posted.flatMap(l => (l.orderLineId !== null && l.billedQty > 0 ? [{ orderLineId: l.orderLineId, qty: l.billedQty }] : []));
        if (marks.length > 0) {
            const marked = await this.orders.markBilled(ws, marks);
            if (!marked.ok) return marked;
        }

        const issued = await this.numbering.issue({
            workspaceId: ws, docType: 'supplier_bill', issueDate: b.billDate, subjectType: BILL_SOURCE, subjectId: b.id, projectId: b.projectId,
            issuedBy: by,
        });
        if (!issued.ok) return issued;

        if (b.projectId !== null && b.kind !== 'subcontract' && b.kind !== 'labour') {
            const nets = lineNetAmounts(posted.map(l => l.amount), b.discount);
            const rows: CostLedgerEntryInput[] = [];
            for (const [i, l] of posted.entries()) {
                const net = nets[i] ?? l.amount;
                const o = l.orderLineId === null ? undefined : po.get(l.orderLineId);
                // With a PO, the goods receipt already moved the PO value of the received quantity to actual.
                const covered = o === undefined || o.qty <= 0 ? 0 : round2((o.netAmount * l.billedQty) / o.qty);
                const amount = round2(net - covered);
                if (amount === 0) continue;
                rows.push({
                    projectId: b.projectId, costCodeId: l.costCodeId, entryDate: b.billDate, kind: 'actual', category: l.category, amount,
                    qty: o === undefined ? l.qty : null, sourceType: BILL_SOURCE, sourceId: b.id, sourceLineId: l.id, note: l.desc, by,
                });
            }
            if (rows.length > 0) {
                const ledgered = await this.ledger.post(ws, rows);
                if (!ledgered.ok) return ledgered;
            }
        }

        const supplier = b.supplierId === null ? undefined : await this.suppliers.find(ws, b.supplierId);
        const event = await this.events.post(ws, {
            projectId: b.projectId, eventDate: b.billDate, eventType: 'ap.bill_posted', direction: 'none', counterpartyType: counterpartyOf(b.kind),
            counterpartyId: b.supplierId, counterpartyName: supplierDisplayName(supplier), counterpartyTaxId: supplier?.taxId ?? '',
            counterpartyBranch: supplier?.branchCode ?? '', docType: BILL_SOURCE, docNumber: issued.value.number,
            docDate: b.supplierInvoiceDate ?? b.billDate, sourceType: BILL_SOURCE, sourceId: b.id, net: round2(b.subtotal - b.discount), vat: b.vat,
            wht: b.whtAmount, retention: b.retentionAmount, cash: 0,
            data: {
                kind: b.kind, inputVatClaimable: b.inputVatClaimable, taxInvoiceDate: b.taxInvoiceDate, taxInvoiceNo: b.taxInvoiceNo,
                supplierInvoiceNo: b.supplierInvoiceNo, payable: b.payable, dueDate: b.dueDate, whtPreset: b.whtPreset, whtRate: b.whtRate,
                orderId: b.orderId, scClaimId: b.scClaimId, payPeriodId: b.payPeriodId,
            },
            by,
        });
        if (!event.ok) return event;

        await this.repo.saveLines(posted);
        const next: BillRecord = {
            ...b, status: 'approved', number: issued.value.number, matchStatus: status, approvedBy: by, approvedAt: now, updatedAt: now,
        };
        await this.repo.save(next);
        await this.audit.record({
            workspaceId: ws, projectId: b.projectId, actor: by, entityType: BILL_SOURCE, entityId: b.id, action: 'approved',
            data: { status: [b.status, 'approved'], number: issued.value.number, total: b.total, payable: b.payable, matchStatus: status },
        });
        return ok(next);
    }

    /**
     * Void: draft → voided; pending → its approval request withdrawn, voided; approved → fin_events and cost reversed,
     * PO quantities given back, number voided. Scheduled / paid → 409 `invalid_transition`.
     */
    async void(b: BillRecord, reason: string, by: UserId): Promise<Result<BillRecord, DomainError>> {
        const can = requireBillTransition(b.status, 'voided');
        if (!can.ok) return can;
        const ws = b.workspaceId;
        const now = this.clock.now();
        const today = bangkokToday(now);
        if (b.status === 'pending_approval') await this.approvals.cancel(ws, APPROVAL_SUBJECT, b.id, by);
        if (b.status === 'approved') {
            const events = await this.events.bySource(ws, BILL_SOURCE, b.id);
            for (const e of events.filter(x => x.reversesId === null && !events.some(y => y.reversesId === x.id))) {
                const reversed = await this.events.reverse(ws, e.id, { by, date: today, note: reason });
                if (!reversed.ok) return reversed;
            }
            const unposted = await this.ledger.reverseSource(ws, BILL_SOURCE, b.id, { by, date: today, note: reason });
            if (!unposted.ok) return unposted;
            const lines = await this.repo.linesOf(ws, b.id);
            const back = lines.flatMap(l => (l.orderLineId !== null && l.billedQty > 0 ? [{ orderLineId: l.orderLineId, qty: -l.billedQty }] : []));
            if (back.length > 0) {
                const undone = await this.orders.markBilled(ws, back);
                if (!undone.ok) return undone;
                await this.repo.saveLines(lines.map(l => ({ ...l, billedQty: 0 })));
            }
            if (b.number !== null) {
                const voided = await this.numbering.void({ workspaceId: ws, docType: 'supplier_bill', subjectId: b.id, reason, by });
                if (!voided.ok) return voided;
            }
        }
        const next: BillRecord = { ...b, status: 'voided', voidedAt: now, voidReason: reason, updatedAt: now };
        await this.repo.save(next);
        await this.audit.record({
            workspaceId: ws, projectId: b.projectId, actor: by, entityType: BILL_SOURCE, entityId: b.id, action: 'void',
            data: { status: [b.status, 'voided'], number: b.number, reason },
        });
        return ok(next);
    }
}
