// ─── Shared parts of the purchase order / goods receipt use cases (WP-39, docs/erp/02-domain-model.md §7.2) ───
// PO lines (from purchase request lines or typed), totals, the budget check of a PO, issuing (number `PO`, supplier
// snapshot, cost commitments per line, purchase requests marked ordered, RFQ closed), the purchase requests' ordered
// status, and the notices sent after a commit.
import { Injectable, Logger } from '@nestjs/common';
import {
    type BudgetWarning, type PurchaseOrderLineInput, type PurchaseRequestStatus,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { THAI_VAT_RATE, round2, roundQty } from '@contrack/domain/money';
import { type BudgetCheckCode, budgetWarnings, materialBudgetOf } from '@contrack/domain/procurement/budget-check';
import { lineNetAmounts, orderLineAmount, orderTotals } from '@contrack/domain/procurement/order-totals';
import {
    AuditLog, Clock, type CostCode, CostCodeLookup, CostLedger, type CostLedgerEntryInput, DocumentNumbering, IdGenerator, Notifier,
    ProjectCatalog, type Supplier, SupplierLookup, WorkspaceDirectory,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../shared/domain/ids';
import { type Permission, can } from '../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../shared/domain/result';
import {
    type PurchaseOrderLineRecord, PurchaseOrderRepository, type PurchaseOrderRecord, type PurchaseRequestLineRecord,
    PurchaseRequestRepository, RfqRepository,
} from './ports/procurement.repository';
import { PurchaseRequestLines } from './procurement.service';

/** Request statuses a PO line may still order from when the PO is made / issued. */
const ORDER_FROM_STATUSES: readonly PurchaseRequestStatus[] = ['approved', 'partially_ordered', 'ordered'];

/** A PO line before it is stored. */
export type DraftOrderLine = Pick<
    PurchaseOrderLineRecord, 'costCodeId' | 'requestLineId' | 'descTh' | 'descEn' | 'unit' | 'qty' | 'unitPrice' | 'amount'
>;

export const supplierName = (s: Pick<Supplier, 'nameTh' | 'nameEn'> | undefined): string => (s === undefined ? '' : s.nameTh !== '' ? s.nameTh : s.nameEn);

/** Of the workspace (404 `Supplier`) and not archived (409 `supplier_archived`). */
export async function orderableSupplier(lookup: SupplierLookup, workspaceId: WorkspaceId, supplierId: string): Promise<Result<Supplier, DomainError>> {
    const s = await lookup.find(workspaceId, supplierId.toLowerCase());
    if (s === undefined) return err(DomainError.notFound('Supplier'));
    if (s.archivedAt !== null) return err(DomainError.conflict('The supplier is archived', { reason: 'supplier_archived', supplierId: s.id }));
    return ok(s);
}

export const discountExceedsSubtotal = (): DomainError =>
    DomainError.unprocessable('The discount is more than the subtotal', { reason: 'discount_exceeds_subtotal' });

@Injectable()
export class PurchaseOrderLines {
    constructor(
        private readonly orders: PurchaseOrderRepository,
        private readonly requests: PurchaseRequestRepository,
        private readonly prLines: PurchaseRequestLines,
        private readonly costCodes: CostCodeLookup,
        private readonly ledger: CostLedger,
        private readonly ids: IdGenerator,
    ) {}

    /**
     * Purchase request lines by id, of approved requests of the project: not_found `PurchaseRequestLine`, 409
     * `request_not_approved`.
     */
    async requestLines(workspaceId: WorkspaceId, projectId: ProjectId, ids: readonly string[]): Promise<Result<Map<string, PurchaseRequestLineRecord>, DomainError>> {
        const wanted = [...new Set(ids.map(id => id.toLowerCase()))];
        if (wanted.length === 0) return ok(new Map());
        const found = new Map((await this.requests.linesByIds(workspaceId, wanted)).map(l => [l.id, l]));
        if (found.size < wanted.length) return err(DomainError.notFound('PurchaseRequestLine'));
        const requests = await this.requests.findMany(workspaceId, [...new Set([...found.values()].map(l => l.requestId))]);
        for (const r of requests) {
            if (r.projectId !== projectId) return err(DomainError.notFound('PurchaseRequestLine'));
            if (!ORDER_FROM_STATUSES.includes(r.status)) {
                return err(DomainError.conflict('The purchase request is not approved', { reason: 'request_not_approved', requestId: r.id, status: r.status }));
            }
        }
        return ok(found);
    }

    /** Lines from purchase request lines (quantity not ordered yet; 422 `nothing_remaining`), then typed lines. */
    async build(
        workspaceId: WorkspaceId, projectId: ProjectId, requestLineIds: readonly string[], typed: readonly PurchaseOrderLineInput[],
    ): Promise<Result<DraftOrderLine[], DomainError>> {
        const picked = [...new Set(requestLineIds.map(id => id.toLowerCase()))];
        const typedRequestIds = typed.flatMap(l => (l.requestLineId === undefined || l.requestLineId === null ? [] : [l.requestLineId]));
        const prLines = await this.requestLines(workspaceId, projectId, [...picked, ...typedRequestIds]);
        if (!prLines.ok) return prLines;
        const codeIds = typed.flatMap(l => (l.costCodeId === undefined || l.costCodeId === null ? [] : [l.costCodeId]));
        const codes = await this.prLines.codes(workspaceId, projectId, codeIds);
        if (!codes.ok) return codes;

        const out: DraftOrderLine[] = [];
        for (const id of picked) {
            const l = prLines.value.get(id);
            if (l === undefined) continue;
            const qty = roundQty(l.qty - l.orderedQty);
            if (qty <= 0) return err(DomainError.unprocessable('Nothing remains to order on the line', { reason: 'nothing_remaining', requestLineId: l.id }));
            const unitPrice = roundQty(l.estUnitPrice);
            out.push({
                costCodeId: l.costCodeId, requestLineId: l.id, descTh: l.descTh, descEn: l.descEn, unit: l.unit, qty, unitPrice,
                amount: orderLineAmount(qty, unitPrice),
            });
        }
        for (const t of typed) {
            const pr = t.requestLineId === undefined || t.requestLineId === null ? undefined : prLines.value.get(t.requestLineId.toLowerCase());
            const codeId = t.costCodeId === undefined ? pr?.costCodeId ?? null : t.costCodeId === null ? null : t.costCodeId.toLowerCase();
            const code: CostCode | undefined = codeId === null ? undefined : codes.value.get(codeId);
            const qty = roundQty(t.qty);
            const unitPrice = roundQty(t.unitPrice ?? pr?.estUnitPrice ?? code?.baselineMatUnit ?? 0);
            out.push({
                costCodeId: codeId,
                requestLineId: pr?.id ?? null,
                descTh: t.descTh !== undefined && t.descTh !== '' ? t.descTh : pr?.descTh ?? code?.descTh ?? '',
                descEn: t.descEn !== undefined && t.descEn !== '' ? t.descEn : pr?.descEn ?? code?.descEn ?? '',
                unit: t.unit !== undefined && t.unit !== '' ? t.unit : pr?.unit ?? code?.unit ?? '',
                qty, unitPrice, amount: orderLineAmount(qty, unitPrice),
            });
        }
        return ok(out);
    }

    /** Numbers the lines in order; nothing received / billed yet. */
    store(workspaceId: WorkspaceId, orderId: string, lines: readonly DraftOrderLine[]): PurchaseOrderLineRecord[] {
        return lines.map((l, i) => ({ ...l, id: this.ids.newId(), orderId, workspaceId, receivedQty: 0, billedQty: 0, sort: i + 1 }));
    }

    /** Totals of the lines with the header's discount / VAT rate (422 `discount_exceeds_subtotal`). */
    totals(lines: readonly Pick<DraftOrderLine, 'amount'>[], discount: number, vatRate: number): Result<ReturnType<typeof orderTotals>, DomainError> {
        const t = orderTotals(lines.map(l => l.amount), discount, vatRate);
        if (t.discount > t.subtotal) return err(discountExceedsSubtotal());
        return ok(t);
    }

    /** Budget warnings of a PO against its cost codes, the ledger and the project's other POs. */
    async warnings(workspaceId: WorkspaceId, projectId: ProjectId, orderId: string, lines: readonly DraftOrderLine[], discount: number): Promise<BudgetWarning[]> {
        const codeIds = [...new Set(lines.flatMap(l => (l.costCodeId === null ? [] : [l.costCodeId])))];
        if (codeIds.length === 0) return [];
        const codes = await this.costCodes.findMany(workspaceId, projectId, codeIds);
        const ledger = new Map((await this.ledger.totalsByCostCode(workspaceId, projectId)).map(t => [t.costCodeId, t]));
        const prior = await this.orders.orderedQty(workspaceId, projectId, codeIds, orderId, false);
        const check = new Map<string, BudgetCheckCode>(codes.map(c => [c.id, {
            costCodeId: c.id, code: c.code, baselineQty: c.baselineQty, voQty: c.voQty, baselineMatUnit: c.baselineMatUnit,
            materialBudget: materialBudgetOf(c), committedOpen: ledger.get(c.id)?.committedOpen ?? 0, actual: ledger.get(c.id)?.actual ?? 0,
            priorQty: prior.get(c.id) ?? 0,
        }]));
        const nets = lineNetAmounts(lines.map(l => l.amount), discount);
        return budgetWarnings(lines.map((l, i) => ({ costCodeId: l.costCodeId, qty: l.qty, unitPrice: l.unitPrice, amount: nets[i] ?? l.amount })), check);
    }
}

@Injectable()
export class PurchaseOrderWorkflow {
    private readonly logger = new Logger('PurchaseOrderWorkflow');

    constructor(
        private readonly orders: PurchaseOrderRepository,
        private readonly requests: PurchaseRequestRepository,
        private readonly rfqs: RfqRepository,
        private readonly lines: PurchaseOrderLines,
        private readonly suppliers: SupplierLookup,
        private readonly numbering: DocumentNumbering,
        private readonly ledger: CostLedger,
        private readonly audit: AuditLog,
        private readonly notifier: Notifier,
        private readonly directory: WorkspaceDirectory,
        private readonly catalog: ProjectCatalog,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    /** A new draft PO (inside the caller's transaction); returns its id. */
    async createDraft(input: {
        workspaceId: WorkspaceId; projectId: ProjectId; supplier: Supplier; rfqId: string | null; by: UserId; lines: readonly DraftOrderLine[];
        orderDate?: string | null; deliveryDate?: string | null; deliveryAddress?: string; language?: 'th' | 'en'; vatRate?: number;
        discount?: number; whtPreset?: Supplier['defaultWhtPreset']; paymentTermDays?: number | null; terms?: string;
    }): Promise<Result<string, DomainError>> {
        const { workspaceId: ws, projectId, supplier } = input;
        const id = this.ids.newId();
        const stored = this.lines.store(ws, id, input.lines);
        const vatRate = input.vatRate ?? (supplier.vatRegistered ? THAI_VAT_RATE : 0);
        const totals = this.lines.totals(stored, input.discount ?? 0, vatRate);
        if (!totals.ok) return totals;
        const now = this.clock.now();
        const order: PurchaseOrderRecord = {
            id, workspaceId: ws, projectId, supplierId: supplier.id, rfqId: input.rfqId, number: null, status: 'draft',
            orderDate: input.orderDate ?? null, deliveryDate: input.deliveryDate ?? null, deliveryAddress: input.deliveryAddress ?? '',
            language: input.language ?? 'th', supplierSnapshot: null, vatRate, ...totals.value,
            whtPreset: input.whtPreset ?? supplier.defaultWhtPreset,
            paymentTermDays: input.paymentTermDays !== undefined ? input.paymentTermDays : supplier.creditTermDays,
            terms: input.terms ?? '', budgetWarnings: await this.lines.warnings(ws, projectId, id, stored, totals.value.discount),
            overrideReason: '', issuedBy: null, issuedAt: null, createdBy: input.by, createdAt: now, updatedAt: now,
        };
        await this.orders.insert(order);
        await this.orders.replaceLines(ws, id, stored);
        await this.audit.record({
            workspaceId: ws, projectId, actor: input.by, entityType: 'purchase_order', entityId: id, action: 'create',
            data: { supplierId: supplier.id, rfqId: input.rfqId, lines: stored.length, total: order.total },
        });
        return ok(id);
    }

    /**
     * draft / pending_approval → issued inside the caller's transaction (row locked): number `PO`, supplier snapshot,
     * one cost commitment per line (amount after the discount), purchase request lines ordered, RFQ closed.
     */
    async issueLocked(o: PurchaseOrderRecord, by: UserId): Promise<Result<PurchaseOrderRecord, DomainError>> {
        const ws = o.workspaceId;
        const lines = await this.orders.linesOf(ws, o.id);
        const requestLineIds = lines.flatMap(l => (l.requestLineId === null ? [] : [l.requestLineId]));
        const pr = await this.lines.requestLines(ws, o.projectId, requestLineIds);
        if (!pr.ok) return pr;
        const now = this.clock.now();
        const orderDate = o.orderDate ?? bangkokToday(now);
        const issued = await this.numbering.issue({
            workspaceId: ws, docType: 'purchase_order', issueDate: orderDate, subjectType: 'purchase_order', subjectId: o.id,
            projectId: o.projectId, issuedBy: by,
        });
        if (!issued.ok) return issued;
        const snapshot = await this.suppliers.snapshot(ws, o.supplierId, o.language);
        if (snapshot === undefined) return err(DomainError.notFound('Supplier'));

        const nets = lineNetAmounts(lines.map(l => l.amount), o.discount);
        const entries: CostLedgerEntryInput[] = lines.flatMap((l, i) => {
            const amount = nets[i] ?? 0;
            return amount === 0 ? [] : [{
                projectId: o.projectId, costCodeId: l.costCodeId, entryDate: orderDate, kind: 'commit' as const, category: 'material' as const,
                amount, qty: l.qty, sourceType: 'purchase_order', sourceId: o.id, sourceLineId: l.id, by,
            }];
        });
        if (entries.length > 0) {
            const posted = await this.ledger.post(ws, entries);
            if (!posted.ok) return posted;
        }
        const deltas = lines.flatMap(l => (l.requestLineId === null ? [] : [{ lineId: l.requestLineId, qty: l.qty }]));
        if (deltas.length > 0) {
            await this.requests.addOrderedQty(ws, deltas);
            await this.refreshRequests(ws, [...new Set([...pr.value.values()].map(l => l.requestId))], by);
        }
        if (o.rfqId !== null) {
            const rfq = await this.rfqs.lock(ws, o.rfqId);
            if (rfq?.status === 'awarded') {
                await this.rfqs.save({ ...rfq, status: 'closed', updatedAt: now });
                await this.audit.record({
                    workspaceId: ws, projectId: rfq.projectId, actor: by, entityType: 'rfq', entityId: rfq.id, action: 'close',
                    data: { status: ['awarded', 'closed'], orderId: o.id },
                });
            }
        }
        const next: PurchaseOrderRecord = {
            ...o, status: 'issued', number: issued.value.number, orderDate, supplierSnapshot: snapshot, issuedBy: by, issuedAt: now, updatedAt: now,
        };
        await this.orders.save(next);
        await this.audit.record({
            workspaceId: ws, projectId: o.projectId, actor: by, entityType: 'purchase_order', entityId: o.id, action: 'issue',
            data: {
                status: [o.status, 'issued'], number: issued.value.number, total: o.total, committed: round2(nets.reduce((s, v) => s + v, 0)),
                warnings: o.budgetWarnings.length, ...(o.budgetWarnings.length > 0 ? { overrideReason: o.overrideReason } : {}),
            },
        });
        return ok(next);
    }

    /** Sets each request's status from its lines' ordered quantity (approved / partially_ordered / ordered). */
    async refreshRequests(workspaceId: WorkspaceId, requestIds: readonly string[], by: UserId): Promise<void> {
        for (const id of requestIds) {
            const r = await this.requests.lock(workspaceId, id);
            if (r === undefined || !ORDER_FROM_STATUSES.includes(r.status)) continue;
            const lines = await this.requests.linesOf(workspaceId, r.id);
            const all = lines.length > 0 && lines.every(l => roundQty(l.orderedQty) >= roundQty(l.qty));
            const any = lines.some(l => l.orderedQty > 0);
            const status: PurchaseRequestStatus = all ? 'ordered' : any ? 'partially_ordered' : 'approved';
            if (status === r.status) continue;
            await this.requests.save({ ...r, status, updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId, projectId: r.projectId, actor: by, entityType: 'purchase_request', entityId: r.id, action: 'status_change',
                data: { status: [r.status, status] },
            });
        }
    }

    /** Undoes what issuing did to the purchase requests (a cancelled PO). */
    async unorder(workspaceId: WorkspaceId, lines: readonly PurchaseOrderLineRecord[], by: UserId): Promise<void> {
        const deltas = lines.flatMap(l => (l.requestLineId === null ? [] : [{ lineId: l.requestLineId, qty: -l.qty }]));
        if (deltas.length === 0) return;
        await this.requests.addOrderedQty(workspaceId, deltas);
        const prLines = await this.requests.linesByIds(workspaceId, deltas.map(d => d.lineId));
        await this.refreshRequests(workspaceId, [...new Set(prLines.map(l => l.requestId))], by);
    }

    async projectName(workspaceId: WorkspaceId, projectId: ProjectId): Promise<string> {
        return (await this.catalog.find(workspaceId, projectId))?.name ?? '';
    }

    private async recipients(workspaceId: WorkspaceId, permission: Permission, except: UserId | null): Promise<UserId[]> {
        return (await this.directory.members(workspaceId)).filter(m => can(m.role, permission) && m.userId !== except).map(m => m.userId);
    }

    /** `purchase_order.issued` to the members who receive goods (the issuer excluded). Never throws. */
    async notifyIssued(workspaceId: WorkspaceId, orderId: string, except: UserId | null): Promise<void> {
        try {
            const o = await this.orders.find(orderId);
            if (o?.workspaceId !== workspaceId || o.number === null) return;
            const toUserIds = await this.recipients(workspaceId, 'procurement.receive', except);
            if (toUserIds.length === 0) return;
            await this.notifier.notify({
                template: 'purchase_order.issued', toUserIds,
                payload: {
                    docNumber: o.number, supplierName: o.supplierSnapshot?.name ?? '', amount: o.total,
                    projectName: await this.projectName(workspaceId, o.projectId), href: `/p/${o.projectId}/procurement/orders/${o.id}`,
                },
            });
        } catch (e) {
            this.logger.error(`purchase order notice not sent: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    /** `goods.short_delivery` to the members who manage purchasing (the receiver excluded). Never throws. */
    async notifyShort(workspaceId: WorkspaceId, orderId: string, except: UserId | null): Promise<void> {
        try {
            const o = await this.orders.find(orderId);
            if (o?.workspaceId !== workspaceId) return;
            const toUserIds = await this.recipients(workspaceId, 'procurement.manage', except);
            if (toUserIds.length === 0) return;
            await this.notifier.notify({
                template: 'goods.short_delivery', toUserIds,
                payload: {
                    docNumber: o.number ?? '', supplierName: o.supplierSnapshot?.name ?? '',
                    projectName: await this.projectName(workspaceId, o.projectId), href: `/p/${o.projectId}/procurement/orders/${o.id}`,
                },
            });
        } catch (e) {
            this.logger.error(`short delivery notice not sent: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
