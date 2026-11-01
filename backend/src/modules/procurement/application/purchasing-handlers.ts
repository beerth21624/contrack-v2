// ─── What purchase orders plug into the core registries and ports (wired in ProcurementModule.onModuleInit) ───
// ApprovalHandlers('purchase_order.issue'), HubRollups (openPurchaseOrders), PortalSources (POs waiting for goods) and
// the PurchaseOrders port read by payables (WP-49).
import { Injectable } from '@nestjs/common';
import { PURCHASE_ORDER_RECEIVABLE_STATUSES, type ProjectRollup } from '@contrack/contract';
import { roundQty } from '@contrack/domain/money';
import { lineNetAmounts } from '@contrack/domain/procurement/order-totals';
import {
    type ApprovalDecidedEvent, AuditLog, Clock, ModuleFlags, type PortalContext, type PortalTaskItem, type PurchaseOrderInfo,
    type PurchaseOrderLineInfo, PurchaseOrders, SupplierLookup, UnitOfWork,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import { type ProjectId, type WorkspaceId, isUuid } from '../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../shared/domain/result';
import { PurchaseOrderRepository } from './ports/procurement.repository';
import { MODULE, transact } from './procurement.service';
import { PurchaseOrderWorkflow, supplierName } from './purchasing.service';

@Injectable()
export class PurchasingHandlers {
    constructor(
        private readonly orders: PurchaseOrderRepository,
        private readonly workflow: PurchaseOrderWorkflow,
        private readonly suppliers: SupplierLookup,
        private readonly flags: ModuleFlags,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    /**
     * Approval of `purchase_order.issue` (subject id = the PO id): approved → issued (number, commitments; the notice
     * goes out from inside the decision, which never fails it), rejected → back to draft.
     */
    async onPurchaseOrderDecided(e: ApprovalDecidedEvent): Promise<Result<void, DomainError>> {
        if (!(await this.flags.isEnabled(e.workspaceId, MODULE))) return okVoid();
        const done = await transact(this.uow, async (): Promise<Result<boolean, DomainError>> => {
            const o = await this.orders.lock(e.workspaceId, e.subjectId.toLowerCase());
            // Cancelled meanwhile: nothing to apply.
            if (o?.status !== 'pending_approval') return ok(false);
            if (e.decision === 'approved') {
                const issued = await this.workflow.issueLocked(o, e.decidedBy);
                return issued.ok ? ok(true) : issued;
            }
            await this.orders.save({ ...o, status: 'draft', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: e.workspaceId, projectId: o.projectId, actor: e.decidedBy, entityType: 'purchase_order', entityId: o.id,
                action: 'approval_rejected', data: { status: ['pending_approval', 'draft'], note: e.note },
            });
            return ok(false);
        });
        if (!done.ok) return done;
        if (done.value) await this.workflow.notifyIssued(e.workspaceId, e.subjectId.toLowerCase(), e.decidedBy);
        return okVoid();
    }

    /** POs still waiting for goods per project. */
    async rollup(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, Partial<ProjectRollup>>> {
        const out = new Map<ProjectId, Partial<ProjectRollup>>();
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return out;
        for (const id of projectIds) out.set(id, { openPurchaseOrders: 0 });
        for (const o of await this.orders.listByProjects(workspaceId, projectIds)) {
            if (!PURCHASE_ORDER_RECEIVABLE_STATUSES.includes(o.status)) continue;
            const r = out.get(o.projectId);
            if (r !== undefined) r.openPurchaseOrders = (r.openPurchaseOrders ?? 0) + 1;
        }
        return out;
    }

    /** Issued POs waiting for (more) goods, of the workspace's live projects. */
    async portalToReceive(ctx: PortalContext): Promise<PortalTaskItem[]> {
        if (!(await this.flags.isEnabled(ctx.workspaceId, MODULE))) return [];
        const list = (await this.orders.listByProjects(ctx.workspaceId, [...ctx.projects.keys()]))
            .filter(o => PURCHASE_ORDER_RECEIVABLE_STATUSES.includes(o.status));
        const missing = [...new Set(list.filter(o => o.supplierSnapshot === null).map(o => o.supplierId))];
        const names = new Map((missing.length === 0 ? [] : await this.suppliers.findMany(ctx.workspaceId, missing)).map(s => [s.id, supplierName(s)]));
        return list.map(o => ({
            kind: 'purchase_order_to_receive' as const,
            params: { number: o.number ?? '', supplierName: o.supplierSnapshot?.name ?? names.get(o.supplierId) ?? '' },
            href: `/p/${o.projectId}/procurement/orders/${o.id}`,
            dueDate: o.deliveryDate,
            amount: o.total,
            projectId: o.projectId,
        }));
    }
}

/** The PurchaseOrders port (payables, WP-49). */
@Injectable()
export class ProcurementPurchaseOrders extends PurchaseOrders {
    constructor(private readonly orders: PurchaseOrderRepository) {
        super();
    }

    async find(workspaceId: WorkspaceId, orderId: string): Promise<PurchaseOrderInfo | undefined> {
        const o = await this.orders.lock(workspaceId, orderId.toLowerCase());
        if (o === undefined) return undefined;
        return {
            id: o.id, workspaceId: o.workspaceId, projectId: o.projectId, supplierId: o.supplierId, number: o.number, status: o.status,
            language: o.language, supplierSnapshot: o.supplierSnapshot === null ? null : structuredClone(o.supplierSnapshot), vatRate: o.vatRate,
            subtotal: o.subtotal, discount: o.discount, vat: o.vat, total: o.total, whtPreset: o.whtPreset, paymentTermDays: o.paymentTermDays,
        };
    }

    async locate(orderId: string): Promise<WorkspaceId | undefined> {
        if (!isUuid(orderId)) return undefined;
        return (await this.orders.find(orderId.toLowerCase()))?.workspaceId;
    }

    async linesWithReceived(workspaceId: WorkspaceId, orderId: string): Promise<PurchaseOrderLineInfo[]> {
        const o = await this.orders.find(orderId.toLowerCase());
        if (o?.workspaceId !== workspaceId) return [];
        const lines = await this.orders.linesOf(workspaceId, o.id);
        const nets = lineNetAmounts(lines.map(l => l.amount), o.discount);
        return lines.map((l, i) => ({
            id: l.id, orderId: l.orderId, costCodeId: l.costCodeId, descTh: l.descTh, descEn: l.descEn, unit: l.unit, qty: l.qty,
            unitPrice: l.unitPrice, amount: l.amount, netAmount: nets[i] ?? l.amount, receivedQty: l.receivedQty, billedQty: l.billedQty,
        }));
    }

    async markBilled(workspaceId: WorkspaceId, lines: readonly { orderLineId: string; qty: number }[]): Promise<Result<void, DomainError>> {
        const adding = new Map<string, number>();
        for (const l of lines) {
            const id = l.orderLineId.toLowerCase();
            adding.set(id, roundQty((adding.get(id) ?? 0) + l.qty));
        }
        if (adding.size === 0) return okVoid();
        const found = await this.orders.linesByIds(workspaceId, [...adding.keys()]);
        if (found.length < adding.size) return err(DomainError.notFound('PurchaseOrderLine'));
        const next = found.map(l => ({ id: l.id, receivedQty: l.receivedQty, billedQty: roundQty(l.billedQty + (adding.get(l.id) ?? 0)) }));
        const bad = next.find(l => l.billedQty < 0 || l.billedQty > roundQty(l.receivedQty));
        if (bad !== undefined) {
            return err(DomainError.unprocessable('More would be billed than was received', { reason: 'qty_exceeds_received', orderLineId: bad.id }));
        }
        await this.orders.saveLineProgress(workspaceId, next);
        return okVoid();
    }
}
