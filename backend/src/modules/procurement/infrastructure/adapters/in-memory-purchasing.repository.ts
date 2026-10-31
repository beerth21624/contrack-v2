import { PURCHASE_ORDER_ISSUED_STATUSES, type PurchaseOrderStatus } from '@contrack/contract';
import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import {
    type GoodsReceiptLineRecord, GoodsReceiptRepository, type GoodsReceiptRecord, ORDERED_STATUSES, type PriceHistoryRow,
    type PurchaseOrderLineRecord, PurchaseOrderRepository, type PurchaseOrderRecord, orderHeldQty,
} from '../../application/ports/procurement.repository';

const clone = <T>(v: T): T => structuredClone(v);

const newestFirst = (a: { createdAt: Date; id: string }, b: { createdAt: Date; id: string }): number =>
    b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1);

/** Memory adapter of purchase orders; mimics the unique (workspace, number). */
export class InMemoryPurchaseOrderRepository extends PurchaseOrderRepository {
    private readonly orders = new Map<string, PurchaseOrderRecord>();
    private readonly lines = new Map<string, PurchaseOrderLineRecord[]>();

    find(orderId: string): Promise<PurchaseOrderRecord | undefined> {
        const r = this.orders.get(orderId);
        return Promise.resolve(r === undefined ? undefined : clone(r));
    }

    lock(workspaceId: WorkspaceId, orderId: string): Promise<PurchaseOrderRecord | undefined> {
        const r = this.orders.get(orderId);
        return Promise.resolve(r?.workspaceId === workspaceId ? clone(r) : undefined);
    }

    listByProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<PurchaseOrderRecord[]> {
        const ids = new Set<string>(projectIds);
        return Promise.resolve([...this.orders.values()]
            .filter(r => r.workspaceId === workspaceId && ids.has(r.projectId)).sort(newestFirst).map(clone));
    }

    listByWorkspace(workspaceId: WorkspaceId, statuses?: readonly PurchaseOrderStatus[]): Promise<PurchaseOrderRecord[]> {
        return Promise.resolve([...this.orders.values()]
            .filter(r => r.workspaceId === workspaceId && (statuses === undefined || statuses.length === 0 || statuses.includes(r.status)))
            .sort(newestFirst).map(clone));
    }

    private clash(r: PurchaseOrderRecord): boolean {
        return r.number !== null && [...this.orders.values()].some(o => o.id !== r.id && o.workspaceId === r.workspaceId && o.number === r.number);
    }

    insert(r: PurchaseOrderRecord): Promise<void> {
        if (this.orders.has(r.id) || this.clash(r)) return Promise.reject(new Error(`duplicate purchase order ${r.id}`));
        this.orders.set(r.id, clone(r));
        return Promise.resolve();
    }

    save(r: PurchaseOrderRecord): Promise<void> {
        if (this.clash(r)) return Promise.reject(new Error(`duplicate purchase order number ${r.number}`));
        if (this.orders.get(r.id)?.workspaceId === r.workspaceId) this.orders.set(r.id, clone(r));
        return Promise.resolve();
    }

    private owned(workspaceId: WorkspaceId, orderId: string): boolean {
        return this.orders.get(orderId)?.workspaceId === workspaceId;
    }

    linesOf(workspaceId: WorkspaceId, orderId: string): Promise<PurchaseOrderLineRecord[]> {
        return Promise.resolve(this.owned(workspaceId, orderId) ? (this.lines.get(orderId) ?? []).sort((a, b) => a.sort - b.sort).map(clone) : []);
    }

    linesByIds(workspaceId: WorkspaceId, lineIds: readonly string[]): Promise<PurchaseOrderLineRecord[]> {
        const ids = new Set(lineIds);
        return Promise.resolve([...this.lines.values()].flat().filter(l => l.workspaceId === workspaceId && ids.has(l.id)).map(clone));
    }

    replaceLines(workspaceId: WorkspaceId, orderId: string, lines: readonly PurchaseOrderLineRecord[]): Promise<void> {
        if (this.owned(workspaceId, orderId)) this.lines.set(orderId, lines.map(clone));
        return Promise.resolve();
    }

    saveLineProgress(workspaceId: WorkspaceId, lines: readonly Pick<PurchaseOrderLineRecord, 'id' | 'receivedQty' | 'billedQty'>[]): Promise<void> {
        const byId = new Map(lines.map(l => [l.id, l]));
        for (const list of this.lines.values()) {
            for (const l of list) {
                const p = byId.get(l.id);
                if (p === undefined || l.workspaceId !== workspaceId) continue;
                l.receivedQty = p.receivedQty;
                l.billedQty = p.billedQty;
            }
        }
        return Promise.resolve();
    }

    lineCounts(workspaceId: WorkspaceId, orderIds: readonly string[]): Promise<Map<string, number>> {
        return Promise.resolve(new Map(orderIds.map(id => [id, this.owned(workspaceId, id) ? (this.lines.get(id) ?? []).length : 0])));
    }

    orderedQty(
        workspaceId: WorkspaceId, projectId: ProjectId, costCodeIds: readonly string[], exceptOrderId: string | null, withoutRequestOnly: boolean,
    ): Promise<Map<string, number>> {
        const codes = new Set(costCodeIds);
        const out = new Map<string, number>();
        for (const o of this.orders.values()) {
            if (o.workspaceId !== workspaceId || o.projectId !== projectId || o.id === exceptOrderId || !ORDERED_STATUSES.includes(o.status)) continue;
            for (const l of this.lines.get(o.id) ?? []) {
                if (l.costCodeId === null || !codes.has(l.costCodeId)) continue;
                if (withoutRequestOnly && l.requestLineId !== null) continue;
                out.set(l.costCodeId, (out.get(l.costCodeId) ?? 0) + orderHeldQty(o.status, l));
            }
        }
        return Promise.resolve(out);
    }

    priceHistory(workspaceId: WorkspaceId, supplierId: string, q: string, limit: number): Promise<PriceHistoryRow[]> {
        const needle = q.trim().toLowerCase();
        const rows: (PriceHistoryRow & { sort: number; createdAt: Date })[] = [];
        for (const o of this.orders.values()) {
            if (o.workspaceId !== workspaceId || o.supplierId !== supplierId || !PURCHASE_ORDER_ISSUED_STATUSES.includes(o.status)) continue;
            for (const l of this.lines.get(o.id) ?? []) {
                if (needle !== '' && !l.descTh.toLowerCase().includes(needle) && !l.descEn.toLowerCase().includes(needle)) continue;
                rows.push({
                    orderId: o.id, orderNumber: o.number, projectId: o.projectId, orderDate: o.orderDate, issuedAt: o.issuedAt, descTh: l.descTh,
                    descEn: l.descEn, unit: l.unit, qty: l.qty, unitPrice: l.unitPrice, costCodeId: l.costCodeId, sort: l.sort,
                    createdAt: o.issuedAt ?? o.createdAt,
                });
            }
        }
        return Promise.resolve(rows
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.orderId < b.orderId ? 1 : a.orderId > b.orderId ? -1 : a.sort - b.sort))
            .slice(0, limit)
            .map(({ sort: _s, createdAt: _c, ...r }) => clone(r)));
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const r of [...this.orders.values()]) {
            if (r.workspaceId !== workspaceId || r.projectId !== projectId) continue;
            this.orders.delete(r.id);
            this.lines.delete(r.id);
        }
        return Promise.resolve();
    }
}

/** Memory adapter of goods receipts. */
export class InMemoryGoodsReceiptRepository extends GoodsReceiptRepository {
    private readonly receipts = new Map<string, GoodsReceiptRecord>();
    private readonly lines = new Map<string, GoodsReceiptLineRecord[]>();

    find(receiptId: string): Promise<GoodsReceiptRecord | undefined> {
        const r = this.receipts.get(receiptId);
        return Promise.resolve(r === undefined ? undefined : clone(r));
    }

    lock(workspaceId: WorkspaceId, receiptId: string): Promise<GoodsReceiptRecord | undefined> {
        const r = this.receipts.get(receiptId);
        return Promise.resolve(r?.workspaceId === workspaceId ? clone(r) : undefined);
    }

    listByOrder(workspaceId: WorkspaceId, orderId: string): Promise<GoodsReceiptRecord[]> {
        return Promise.resolve([...this.receipts.values()]
            .filter(r => r.workspaceId === workspaceId && r.orderId === orderId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1)).map(clone));
    }

    private clash(r: GoodsReceiptRecord): boolean {
        return r.number !== null && [...this.receipts.values()].some(o => o.id !== r.id && o.workspaceId === r.workspaceId && o.number === r.number);
    }

    insert(r: GoodsReceiptRecord): Promise<void> {
        if (this.receipts.has(r.id) || this.clash(r)) return Promise.reject(new Error(`duplicate goods receipt ${r.id}`));
        this.receipts.set(r.id, clone(r));
        return Promise.resolve();
    }

    save(r: GoodsReceiptRecord): Promise<void> {
        if (this.clash(r)) return Promise.reject(new Error(`duplicate goods receipt number ${r.number}`));
        if (this.receipts.get(r.id)?.workspaceId === r.workspaceId) this.receipts.set(r.id, clone(r));
        return Promise.resolve();
    }

    linesOf(workspaceId: WorkspaceId, receiptId: string): Promise<GoodsReceiptLineRecord[]> {
        if (this.receipts.get(receiptId)?.workspaceId !== workspaceId) return Promise.resolve([]);
        return Promise.resolve((this.lines.get(receiptId) ?? []).sort((a, b) => a.sort - b.sort).map(clone));
    }

    replaceLines(workspaceId: WorkspaceId, receiptId: string, lines: readonly GoodsReceiptLineRecord[]): Promise<void> {
        if (this.receipts.get(receiptId)?.workspaceId === workspaceId) this.lines.set(receiptId, lines.map(clone));
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const r of [...this.receipts.values()]) {
            if (r.workspaceId !== workspaceId || r.projectId !== projectId) continue;
            this.receipts.delete(r.id);
            this.lines.delete(r.id);
        }
        return Promise.resolve();
    }
}
