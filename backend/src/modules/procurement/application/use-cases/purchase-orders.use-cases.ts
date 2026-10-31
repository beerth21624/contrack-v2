// ─── Purchase order use cases (docs/erp/04-implementation-plan.md WP-39, docs/erp/02-domain-model.md §7.2) ───
// Read `procurement.read`; create / edit / issue / cancel / close `procurement.manage`. Issuing: budget check (warnings
// need an override reason) → approval `purchase_order.issue` (with warnings the amount is null, so the threshold never
// skips it; only the solo / self-approve rules do) → number `PO` → cost commitments → `purchase_order.issued`.
import { Injectable } from '@nestjs/common';
import {
    type CreatePurchaseOrderRequest, type IssuePurchaseOrderRequest, type PatchPurchaseOrderRequest, type PurchaseOrderDto,
    type PurchaseOrderListQuery, type PurchaseOrderSummaryDto, type SupplierPriceHistoryItem,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { THAI_VAT_RATE, round2 } from '@contrack/domain/money';
import { type ProjectGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    Approvals, AuditLog, Clock, CostLedger, type CostLedgerEntryInput, DocumentNumbering, SupplierLookup, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../../shared/domain/result';
import { requireStatus } from '../../domain/procurement-state';
import { GoodsReceiptRepository, PurchaseOrderRepository, type PurchaseOrderRecord } from '../ports/procurement.repository';
import { MODULE, ProcurementAccess, transact } from '../procurement.service';
import { PurchasingViews } from '../purchasing-views';
import { type DraftOrderLine, PurchaseOrderLines, PurchaseOrderWorkflow, orderableSupplier, supplierName } from '../purchasing.service';
import { overrideReasonRequired } from './purchase-requests.use-cases';

const READ = ['procurement.read' as const];
const MANAGE = ['procurement.manage' as const];

/** Most rows of a price history answer. */
const PRICE_HISTORY_LIMIT = 200;

async function fresh(repo: PurchaseOrderRepository, views: PurchasingViews, grant: ProjectGrant, id: string): Promise<Result<PurchaseOrderDto, DomainError>> {
    const o = await repo.find(id);
    return o === undefined ? err(DomainError.notFound('PurchaseOrder')) : ok(await views.order(o, grant));
}

// ── reads ──

/** GET /projects/:projectId/purchase-orders — `procurement.read`, newest first. */
@Injectable()
export class ListProjectPurchaseOrdersUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: PurchaseOrderRepository, private readonly views: PurchasingViews) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<PurchaseOrderSummaryDto[], DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: READ, write: false });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        return ok(await this.views.summaries(ws, await this.repo.listByProjects(ws, [projectId])));
    }
}

/** GET /workspaces/:workspaceId/purchase-orders?status= — `procurement.read`, every project, newest first. */
@Injectable()
export class ListWorkspacePurchaseOrdersUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: PurchaseOrderRepository, private readonly views: PurchasingViews) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: PurchaseOrderListQuery): Promise<Result<PurchaseOrderSummaryDto[], DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, 'procurement.read');
        if (!grant.ok) return grant;
        return ok(await this.views.summaries(workspaceId, await this.repo.listByWorkspace(workspaceId, query.status)));
    }
}

/** GET /purchase-orders/:orderId — `procurement.read`. */
@Injectable()
export class GetPurchaseOrderUseCase {
    constructor(private readonly access: ProcurementAccess, private readonly views: PurchasingViews) {}

    async execute(userId: UserId, orderId: string): Promise<Result<PurchaseOrderDto, DomainError>> {
        const loaded = await this.access.order(userId, orderId, READ, false);
        if (!loaded.ok) return loaded;
        return ok(await this.views.order(loaded.value.doc, loaded.value.grant));
    }
}

/** GET /suppliers/:supplierId/price-history?q= — `procurement.read` in the supplier's workspace. */
@Injectable()
export class SupplierPriceHistoryUseCase {
    constructor(private readonly access: ModuleAccess, private readonly suppliers: SupplierLookup, private readonly repo: PurchaseOrderRepository) {}

    async execute(userId: UserId, supplierId: string, q: string | undefined): Promise<Result<SupplierPriceHistoryItem[], DomainError>> {
        if (!isUuid(supplierId)) return err(DomainError.notFound('Supplier'));
        const id = supplierId.toLowerCase();
        const ws = await this.suppliers.locate(id);
        if (ws === undefined) return err(DomainError.notFound('Supplier'));
        const grant = await this.access.inWorkspace(userId, ws, MODULE, 'procurement.read');
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('Supplier')) : grant;
        const rows = await this.repo.priceHistory(ws, id, q ?? '', PRICE_HISTORY_LIMIT);
        return ok(rows.map(r => ({ ...r, issuedAt: r.issuedAt?.toISOString() ?? null })));
    }
}

// ── writes ──

/** POST /projects/:projectId/purchase-orders — `procurement.manage`: a draft (empty, from PR lines and / or typed lines). */
@Injectable()
export class CreatePurchaseOrderUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: PurchaseOrderRepository,
        private readonly lines: PurchaseOrderLines,
        private readonly workflow: PurchaseOrderWorkflow,
        private readonly suppliers: SupplierLookup,
        private readonly views: PurchasingViews,
        private readonly uow: UnitOfWork,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: CreatePurchaseOrderRequest }): Promise<Result<PurchaseOrderDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: MANAGE, write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const supplier = await orderableSupplier(this.suppliers, ws, body.supplierId);
        if (!supplier.ok) return supplier;
        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            const lines = await this.lines.build(ws, projectId, body.requestLineIds ?? [], body.lines ?? []);
            if (!lines.ok) return lines;
            return this.workflow.createDraft({
                workspaceId: ws, projectId, supplier: supplier.value, rfqId: null, by: userId, lines: lines.value,
                orderDate: body.orderDate, deliveryDate: body.deliveryDate, deliveryAddress: body.deliveryAddress, language: body.language,
                vatRate: body.vatRate, discount: body.discount, whtPreset: body.whtPreset, paymentTermDays: body.paymentTermDays, terms: body.terms,
            });
        });
        if (!created.ok) return created;
        return fresh(this.repo, this.views, grant.value, created.value);
    }
}

/** PATCH /purchase-orders/:orderId — `procurement.manage`, draft only; `lines` replaces every line. */
@Injectable()
export class PatchPurchaseOrderUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: PurchaseOrderRepository,
        private readonly lines: PurchaseOrderLines,
        private readonly suppliers: SupplierLookup,
        private readonly views: PurchasingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; orderId: string; body: PatchPurchaseOrderRequest }): Promise<Result<PurchaseOrderDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.order(userId, input.orderId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const o = await this.repo.lock(ws, doc.id);
            if (o === undefined) return err(DomainError.notFound('PurchaseOrder'));
            const draft = requireStatus(o.status, ['draft']);
            if (!draft.ok) return draft;
            const supplierChanged = body.supplierId !== undefined && body.supplierId.toLowerCase() !== o.supplierId;
            const supplier = supplierChanged && body.supplierId !== undefined ? await orderableSupplier(this.suppliers, ws, body.supplierId) : undefined;
            if (supplier !== undefined && !supplier.ok) return supplier;
            let stored = await this.repo.linesOf(ws, o.id);
            if (body.lines !== undefined) {
                const built = await this.lines.build(ws, o.projectId, [], body.lines);
                if (!built.ok) return built;
                stored = this.lines.store(ws, o.id, built.value);
            }
            const vatRate = body.vatRate ?? (supplier?.ok === true ? (supplier.value.vatRegistered ? THAI_VAT_RATE : 0) : o.vatRate);
            const totals = this.lines.totals(stored, body.discount ?? o.discount, vatRate);
            if (!totals.ok) return totals;
            if (body.lines !== undefined) await this.repo.replaceLines(ws, o.id, stored);
            const next: PurchaseOrderRecord = {
                ...o,
                supplierId: supplier?.ok === true ? supplier.value.id : o.supplierId,
                orderDate: body.orderDate !== undefined ? body.orderDate : o.orderDate,
                deliveryDate: body.deliveryDate !== undefined ? body.deliveryDate : o.deliveryDate,
                deliveryAddress: body.deliveryAddress ?? o.deliveryAddress,
                language: body.language ?? o.language,
                vatRate, ...totals.value,
                whtPreset: body.whtPreset ?? (supplier?.ok === true ? supplier.value.defaultWhtPreset : o.whtPreset),
                paymentTermDays: body.paymentTermDays !== undefined ? body.paymentTermDays : supplier?.ok === true ? supplier.value.creditTermDays : o.paymentTermDays,
                terms: body.terms ?? o.terms,
                overrideReason: body.overrideReason ?? o.overrideReason,
                budgetWarnings: await this.lines.warnings(ws, o.projectId, o.id, stored, totals.value.discount),
                updatedAt: this.clock.now(),
            };
            await this.repo.save(next);
            const data: Record<string, unknown> = {};
            for (const key of [
                'supplierId', 'orderDate', 'deliveryDate', 'deliveryAddress', 'language', 'vatRate', 'discount', 'total', 'whtPreset',
                'paymentTermDays', 'terms', 'overrideReason',
            ] as const) {
                if (next[key] !== o[key]) data[key] = [o[key], next[key]];
            }
            if (body.lines !== undefined) data.lines = stored.length;
            await this.audit.record({ workspaceId: ws, projectId: o.projectId, actor: userId, entityType: 'purchase_order', entityId: o.id, action: 'update', data });
            return okVoid();
        });
        if (!saved.ok) return saved;
        return fresh(this.repo, this.views, grant, doc.id);
    }
}

/** POST /purchase-orders/:orderId/issue — `procurement.manage`, draft only. */
@Injectable()
export class IssuePurchaseOrderUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: PurchaseOrderRepository,
        private readonly lines: PurchaseOrderLines,
        private readonly workflow: PurchaseOrderWorkflow,
        private readonly suppliers: SupplierLookup,
        private readonly approvals: Approvals,
        private readonly views: PurchasingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; orderId: string; body: IssuePurchaseOrderRequest }): Promise<Result<PurchaseOrderDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.order(userId, input.orderId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;

        const done = await transact(this.uow, async (): Promise<Result<{ pendingRequestId: string | null; issued: boolean }, DomainError>> => {
            const o = await this.repo.lock(ws, doc.id);
            if (o === undefined) return err(DomainError.notFound('PurchaseOrder'));
            const draft = requireStatus(o.status, ['draft']);
            if (!draft.ok) return draft;
            const lines = await this.repo.linesOf(ws, o.id);
            if (lines.length === 0) return err(DomainError.unprocessable('The purchase order has no lines', { reason: 'no_lines' }));
            if (lines.some(l => l.qty <= 0)) {
                return err(DomainError.unprocessable('Every line needs a quantity above 0', { reason: 'quantity_not_positive' }));
            }
            const supplier = await orderableSupplier(this.suppliers, ws, o.supplierId);
            if (!supplier.ok) return supplier;
            const requestLineIds = lines.flatMap(l => (l.requestLineId === null ? [] : [l.requestLineId]));
            const pr = await this.lines.requestLines(ws, o.projectId, requestLineIds);
            if (!pr.ok) return pr;
            const drafts: DraftOrderLine[] = lines;
            const warnings = await this.lines.warnings(ws, o.projectId, o.id, drafts, o.discount);
            const overrideReason = (body.overrideReason ?? o.overrideReason).trim();
            if (warnings.length > 0 && overrideReason === '') return err(overrideReasonRequired(warnings));

            const ticket = await this.approvals.request({
                workspaceId: ws, subject: 'purchase_order.issue', subjectId: o.id, projectId: o.projectId,
                amount: warnings.length > 0 ? null : round2(o.subtotal - o.discount),
                title: supplierName(supplier.value), requestedBy: userId, requesterRole: grant.role,
            });
            if (!ticket.ok) return ticket;
            const now = this.clock.now();
            const checked: PurchaseOrderRecord = {
                ...o, budgetWarnings: warnings, overrideReason: warnings.length > 0 ? overrideReason : o.overrideReason, updatedAt: now,
            };
            if (ticket.value.status === 'approved') {
                const issued = await this.workflow.issueLocked(checked, userId);
                if (!issued.ok) return issued;
                return ok({ pendingRequestId: null, issued: true });
            }
            await this.repo.save({ ...checked, status: 'pending_approval' });
            await this.audit.record({
                workspaceId: ws, projectId: o.projectId, actor: userId, entityType: 'purchase_order', entityId: o.id, action: 'submit',
                data: {
                    status: ['draft', 'pending_approval'], total: o.total, warnings: warnings.length,
                    ...(warnings.length > 0 ? { overrideReason } : {}), approvalRequestId: ticket.value.requestId,
                },
            });
            return ok({ pendingRequestId: ticket.value.requestId, issued: false });
        });
        if (!done.ok) return done;
        if (done.value.pendingRequestId !== null) await this.approvals.notifyRequested(done.value.pendingRequestId);
        if (done.value.issued) await this.workflow.notifyIssued(ws, doc.id, userId);
        return fresh(this.repo, this.views, grant, doc.id);
    }
}

/**
 * POST /purchase-orders/:orderId/cancel — `procurement.manage`: a draft, one waiting for approval (the request
 * cancelled), or an issued one with nothing received (409 `goods_received`): its commitments reversed, the purchase
 * requests un-ordered, its number voided and its draft receipts cancelled.
 */
@Injectable()
export class CancelPurchaseOrderUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: PurchaseOrderRepository,
        private readonly receipts: GoodsReceiptRepository,
        private readonly workflow: PurchaseOrderWorkflow,
        private readonly approvals: Approvals,
        private readonly ledger: CostLedger,
        private readonly numbering: DocumentNumbering,
        private readonly views: PurchasingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; orderId: string }): Promise<Result<PurchaseOrderDto, DomainError>> {
        const { userId } = input;
        const loaded = await this.access.order(userId, input.orderId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const o = await this.repo.lock(ws, doc.id);
            if (o === undefined) return err(DomainError.notFound('PurchaseOrder'));
            const allowed = requireStatus(o.status, ['draft', 'pending_approval', 'issued']);
            if (!allowed.ok) return allowed;
            const now = this.clock.now();
            if (o.status === 'pending_approval') await this.approvals.cancel(ws, 'purchase_order.issue', o.id, userId);
            if (o.status === 'issued') {
                const receipts = await this.receipts.listByOrder(ws, o.id);
                const lines = await this.repo.linesOf(ws, o.id);
                if (receipts.some(r => r.status === 'confirmed') || lines.some(l => l.receivedQty > 0)) {
                    return err(DomainError.conflict('Goods have been received on the purchase order', { reason: 'goods_received' }));
                }
                const reversed = await this.ledger.reverseSource(ws, 'purchase_order', o.id, { by: userId, date: bangkokToday(now), note: 'cancelled' });
                if (!reversed.ok) return reversed;
                await this.workflow.unorder(ws, lines, userId);
                const voided = await this.numbering.void({ workspaceId: ws, docType: 'purchase_order', subjectId: o.id, reason: 'cancelled', by: userId });
                if (!voided.ok) return voided;
                for (const r of receipts.filter(x => x.status === 'draft')) await this.receipts.save({ ...r, status: 'cancelled', updatedAt: now });
            }
            await this.repo.save({ ...o, status: 'cancelled', updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: o.projectId, actor: userId, entityType: 'purchase_order', entityId: o.id, action: 'cancel',
                data: { status: [o.status, 'cancelled'] },
            });
            return okVoid();
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, grant, doc.id);
    }
}

/**
 * POST /purchase-orders/:orderId/close — `procurement.manage`, issued / partially received / received: releases the
 * commitment not received yet (the open amount per line becomes 0) and cancels draft receipts.
 */
@Injectable()
export class ClosePurchaseOrderUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: PurchaseOrderRepository,
        private readonly receipts: GoodsReceiptRepository,
        private readonly ledger: CostLedger,
        private readonly views: PurchasingViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; orderId: string }): Promise<Result<PurchaseOrderDto, DomainError>> {
        const { userId } = input;
        const loaded = await this.access.order(userId, input.orderId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const o = await this.repo.lock(ws, doc.id);
            if (o === undefined) return err(DomainError.notFound('PurchaseOrder'));
            const allowed = requireStatus(o.status, ['issued', 'partially_received', 'received']);
            if (!allowed.ok) return allowed;
            const now = this.clock.now();
            const today = bangkokToday(now);
            const lines = await this.repo.linesOf(ws, o.id);
            const open = await this.ledger.openCommitments(ws, lines.map(l => l.id));
            const entries: CostLedgerEntryInput[] = lines.flatMap(l => {
                const amount = round2(open.get(l.id) ?? 0);
                return amount <= 0 ? [] : [{
                    projectId: o.projectId, costCodeId: l.costCodeId, entryDate: today, kind: 'commit_release' as const, category: 'material' as const,
                    amount: -amount, sourceType: 'purchase_order', sourceId: o.id, sourceLineId: l.id, commitmentRef: l.id, note: 'closed', by: userId,
                }];
            });
            if (entries.length > 0) {
                const posted = await this.ledger.post(ws, entries);
                if (!posted.ok) return posted;
            }
            for (const r of (await this.receipts.listByOrder(ws, o.id)).filter(x => x.status === 'draft')) {
                await this.receipts.save({ ...r, status: 'cancelled', updatedAt: now });
            }
            await this.repo.save({ ...o, status: 'closed', updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: o.projectId, actor: userId, entityType: 'purchase_order', entityId: o.id, action: 'close',
                data: { status: [o.status, 'closed'], released: round2(entries.reduce((s, e) => s - e.amount, 0)) },
            });
            return okVoid();
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, grant, doc.id);
    }
}
