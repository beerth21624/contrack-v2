// ─── Goods receipt use cases (docs/erp/04-implementation-plan.md WP-39, docs/erp/02-domain-model.md §7.2) ───
// Read `procurement.read`; create / confirm / cancel `procurement.receive`. Confirming numbers the receipt `GR`, moves
// the value received from committed to actual per PO line (commit_release − / actual +, same cost code), adds the
// received quantities to the PO (→ partially_received / received) and sends `goods.short_delivery` when something
// was rejected or marked damaged / short.
import { Injectable } from '@nestjs/common';
import {
    type CreateGoodsReceiptRequest, type GoodsReceiptDto, type GoodsReceiptPhoto, PURCHASE_ORDER_RECEIVABLE_STATUSES,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { round2, roundQty, sumMoney } from '@contrack/domain/money';
import { lineNetAmounts, receiptValue } from '@contrack/domain/procurement/order-totals';
import {
    AuditLog, Clock, CostLedger, type CostLedgerEntryInput, DocumentNumbering, FileService, IdGenerator, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../../shared/domain/result';
import { requireStatus } from '../../domain/procurement-state';
import {
    type GoodsReceiptLineRecord, GoodsReceiptRepository, type GoodsReceiptRecord, type PurchaseOrderLineRecord, PurchaseOrderRepository,
} from '../ports/procurement.repository';
import { ProcurementAccess, transact } from '../procurement.service';
import { PurchasingViews } from '../purchasing-views';
import { PurchaseOrderWorkflow } from '../purchasing.service';

const READ = ['procurement.read' as const];
const RECEIVE = ['procurement.receive' as const];

const overReceived = (l: PurchaseOrderLineRecord, qty: number): DomainError =>
    DomainError.unprocessable('More would be received than was ordered', {
        reason: 'over_received', orderLineId: l.id, ordered: l.qty, received: l.receivedQty, qty,
    });

/** 422 `over_received` when a line would get more than ordered (receipt lines of one PO line add up). */
function checkQuantities(orderLines: ReadonlyMap<string, PurchaseOrderLineRecord>, lines: readonly Pick<GoodsReceiptLineRecord, 'orderLineId' | 'qtyReceived'>[]): Result<void, DomainError> {
    const adding = new Map<string, number>();
    for (const l of lines) adding.set(l.orderLineId, roundQty((adding.get(l.orderLineId) ?? 0) + l.qtyReceived));
    for (const [id, qty] of adding) {
        const ol = orderLines.get(id);
        if (ol === undefined) return err(DomainError.unprocessable('The line is not on this purchase order', { reason: 'unknown_order_line', orderLineId: id }));
        if (roundQty(ol.receivedQty + qty) > roundQty(ol.qty)) return err(overReceived(ol, qty));
    }
    return okVoid();
}

const isShort = (lines: readonly GoodsReceiptLineRecord[]): boolean => lines.some(l => l.qtyRejected > 0 || l.condition !== 'ok');

/** GET /purchase-orders/:orderId/receipts — `procurement.read`, oldest first. */
@Injectable()
export class ListGoodsReceiptsUseCase {
    constructor(private readonly access: ProcurementAccess, private readonly views: PurchasingViews) {}

    async execute(userId: UserId, orderId: string): Promise<Result<GoodsReceiptDto[], DomainError>> {
        const loaded = await this.access.order(userId, orderId, READ, false);
        if (!loaded.ok) return loaded;
        return ok(await this.views.receiptsOf(loaded.value.doc.workspaceId, loaded.value.doc.id));
    }
}

/** POST /purchase-orders/:orderId/receipts — `procurement.receive`, PO issued / partially received: a draft receipt. */
@Injectable()
export class CreateGoodsReceiptUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly orders: PurchaseOrderRepository,
        private readonly repo: GoodsReceiptRepository,
        private readonly files: FileService,
        private readonly views: PurchasingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; orderId: string; body: CreateGoodsReceiptRequest }): Promise<Result<GoodsReceiptDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.order(userId, input.orderId, RECEIVE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const photos: GoodsReceiptPhoto[] = (body.photos ?? []).map(p => ({
            fileId: p.fileId.toLowerCase(), takenAt: p.takenAt ?? null, caption: p.caption ?? '',
        }));
        if (photos.length > 0) {
            const mine = await this.files.assertUploadedBy([...new Set(photos.map(p => p.fileId))], userId);
            if (!mine.ok) return mine;
        }
        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            const o = await this.orders.lock(ws, doc.id);
            if (o === undefined) return err(DomainError.notFound('PurchaseOrder'));
            const open = requireStatus(o.status, PURCHASE_ORDER_RECEIVABLE_STATUSES);
            if (!open.ok) return open;
            const orderLines = new Map((await this.orders.linesOf(ws, o.id)).map(l => [l.id, l]));
            const id = this.ids.newId();
            const lines: GoodsReceiptLineRecord[] = body.lines.map((l, i) => {
                const qtyRejected = roundQty(l.qtyRejected ?? 0);
                return {
                    id: this.ids.newId(), receiptId: id, workspaceId: ws, orderLineId: l.orderLineId.toLowerCase(), qtyReceived: roundQty(l.qtyReceived),
                    qtyRejected, condition: l.condition ?? (qtyRejected > 0 ? 'damaged' : 'ok'), note: l.note ?? '', sort: i + 1,
                };
            });
            if (lines.every(l => l.qtyReceived === 0 && l.qtyRejected === 0)) {
                return err(DomainError.unprocessable('Enter a quantity received or rejected', { reason: 'nothing_received' }));
            }
            const checked = checkQuantities(orderLines, lines);
            if (!checked.ok) return checked;
            const now = this.clock.now();
            const r: GoodsReceiptRecord = {
                id, workspaceId: ws, projectId: o.projectId, orderId: o.id, number: null, status: 'draft',
                receivedDate: body.receivedDate ?? bangkokToday(now), receivedBy: userId, deliveryNoteNo: body.deliveryNoteNo ?? '', photos,
                note: body.note ?? '', amount: 0, confirmedAt: null, createdBy: userId, createdAt: now, updatedAt: now,
            };
            await this.repo.insert(r);
            await this.repo.replaceLines(ws, id, lines);
            await this.audit.record({
                workspaceId: ws, projectId: o.projectId, actor: userId, entityType: 'goods_receipt', entityId: id, action: 'create',
                data: { orderId: o.id, lines: lines.length, photos: photos.length },
            });
            return ok(id);
        });
        if (!created.ok) return created;
        const r = await this.repo.find(created.value);
        return r === undefined ? err(DomainError.notFound('GoodsReceipt')) : ok(await this.views.receipt(r));
    }
}

/** POST /goods-receipts/:receiptId/confirm — `procurement.receive`, draft only, PO issued / partially received. */
@Injectable()
export class ConfirmGoodsReceiptUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly orders: PurchaseOrderRepository,
        private readonly repo: GoodsReceiptRepository,
        private readonly workflow: PurchaseOrderWorkflow,
        private readonly numbering: DocumentNumbering,
        private readonly ledger: CostLedger,
        private readonly views: PurchasingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; receiptId: string }): Promise<Result<GoodsReceiptDto, DomainError>> {
        const { userId } = input;
        const loaded = await this.access.receipt(userId, input.receiptId, RECEIVE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<{ short: boolean }, DomainError>> => {
            const o = await this.orders.lock(ws, doc.orderId);
            if (o === undefined) return err(DomainError.notFound('PurchaseOrder'));
            const r = await this.repo.lock(ws, doc.id);
            if (r === undefined) return err(DomainError.notFound('GoodsReceipt'));
            const draft = requireStatus(r.status, ['draft']);
            if (!draft.ok) return draft;
            const receivable = requireStatus(o.status, PURCHASE_ORDER_RECEIVABLE_STATUSES);
            if (!receivable.ok) return receivable;
            const orderLineList = await this.orders.linesOf(ws, o.id);
            const orderLines = new Map(orderLineList.map(l => [l.id, l]));
            const lines = await this.repo.linesOf(ws, r.id);
            const checked = checkQuantities(orderLines, lines);
            if (!checked.ok) return checked;

            const issued = await this.numbering.issue({
                workspaceId: ws, docType: 'goods_receipt', issueDate: r.receivedDate, subjectType: 'goods_receipt', subjectId: r.id,
                projectId: r.projectId, issuedBy: userId,
            });
            if (!issued.ok) return issued;

            const netList = lineNetAmounts(orderLineList.map(x => x.amount), o.discount);
            const nets = new Map(orderLineList.map((l, i) => [l.id, netList[i] ?? l.amount]));
            const open = await this.ledger.openCommitments(ws, orderLineList.map(l => l.id));
            const received = new Map(orderLineList.map(l => [l.id, l.receivedQty]));
            const entries: CostLedgerEntryInput[] = [];
            const values: number[] = [];
            for (const l of lines) {
                const ol = orderLines.get(l.orderLineId);
                if (ol === undefined || l.qtyReceived <= 0) continue;
                const before = received.get(ol.id) ?? 0;
                const value = receiptValue({ net: nets.get(ol.id) ?? ol.amount, orderedQty: ol.qty, receivedBefore: before, qty: l.qtyReceived, open: open.get(ol.id) ?? 0 });
                received.set(ol.id, roundQty(before + l.qtyReceived));
                open.set(ol.id, round2((open.get(ol.id) ?? 0) - value));
                if (value <= 0) continue;
                values.push(value);
                const base = {
                    projectId: r.projectId, costCodeId: ol.costCodeId, entryDate: r.receivedDate, category: 'material' as const,
                    sourceType: 'goods_receipt', sourceId: r.id, sourceLineId: l.id, by: userId,
                };
                entries.push({ ...base, kind: 'commit_release', amount: -value, qty: -l.qtyReceived, commitmentRef: ol.id });
                entries.push({ ...base, kind: 'actual', amount: value, qty: l.qtyReceived });
            }
            if (entries.length > 0) {
                const posted = await this.ledger.post(ws, entries);
                if (!posted.ok) return posted;
            }
            await this.orders.saveLineProgress(ws, orderLineList.map(l => ({ id: l.id, receivedQty: received.get(l.id) ?? l.receivedQty, billedQty: l.billedQty })));
            const complete = orderLineList.every(l => roundQty(received.get(l.id) ?? l.receivedQty) >= roundQty(l.qty));
            const anyReceived = orderLineList.some(l => (received.get(l.id) ?? 0) > 0);
            const status = complete ? 'received' : anyReceived ? 'partially_received' : o.status;
            const now = this.clock.now();
            if (status !== o.status) {
                await this.orders.save({ ...o, status, updatedAt: now });
                await this.audit.record({
                    workspaceId: ws, projectId: o.projectId, actor: userId, entityType: 'purchase_order', entityId: o.id, action: 'receive',
                    data: { status: [o.status, status], receiptId: r.id },
                });
            }
            const amount = sumMoney(values);
            await this.repo.save({ ...r, status: 'confirmed', number: issued.value.number, amount, confirmedAt: now, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: r.projectId, actor: userId, entityType: 'goods_receipt', entityId: r.id, action: 'confirm',
                data: { status: ['draft', 'confirmed'], number: issued.value.number, amount, orderId: o.id },
            });
            return ok({ short: isShort(lines) });
        });
        if (!done.ok) return done;
        if (done.value.short) await this.workflow.notifyShort(ws, doc.orderId, userId);
        const r = await this.repo.find(doc.id);
        return r === undefined ? err(DomainError.notFound('GoodsReceipt')) : ok(await this.views.receipt(r));
    }
}

/** POST /goods-receipts/:receiptId/cancel — `procurement.receive`, draft only. */
@Injectable()
export class CancelGoodsReceiptUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: GoodsReceiptRepository,
        private readonly views: PurchasingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; receiptId: string }): Promise<Result<GoodsReceiptDto, DomainError>> {
        const loaded = await this.access.receipt(input.userId, input.receiptId, RECEIVE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.repo.lock(ws, doc.id);
            if (r === undefined) return err(DomainError.notFound('GoodsReceipt'));
            const draft = requireStatus(r.status, ['draft']);
            if (!draft.ok) return draft;
            await this.repo.save({ ...r, status: 'cancelled', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: ws, projectId: r.projectId, actor: input.userId, entityType: 'goods_receipt', entityId: r.id, action: 'cancel',
                data: { status: ['draft', 'cancelled'] },
            });
            return okVoid();
        });
        if (!done.ok) return done;
        const r = await this.repo.find(doc.id);
        return r === undefined ? err(DomainError.notFound('GoodsReceipt')) : ok(await this.views.receipt(r));
    }
}
