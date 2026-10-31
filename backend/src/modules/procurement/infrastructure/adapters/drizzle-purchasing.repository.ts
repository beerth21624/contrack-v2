import { PURCHASE_ORDER_ISSUED_STATUSES, type PurchaseOrderStatus } from '@contrack/contract';
import { and, asc, count, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { pcOrderLines, pcOrders, pcReceiptLines, pcReceipts } from '../../../../shared/infrastructure/database/schema-procurement';
import {
    type GoodsReceiptLineRecord, GoodsReceiptRepository, type GoodsReceiptRecord, ORDERED_STATUSES, type PriceHistoryRow,
    type PurchaseOrderLineRecord, PurchaseOrderRepository, type PurchaseOrderRecord, orderHeldQty,
} from '../../application/ports/procurement.repository';

const escapeLike = (s: string): string => s.replace(/[\\%_]/g, m => `\\${m}`);

const toOrder = (r: typeof pcOrders.$inferSelect): PurchaseOrderRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    issuedBy: r.issuedBy === null ? null : asUserId(r.issuedBy),
    createdBy: asUserId(r.createdBy),
});

const toOrderLine = (r: typeof pcOrderLines.$inferSelect): PurchaseOrderLineRecord => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) });

const toReceipt = (r: typeof pcReceipts.$inferSelect): GoodsReceiptRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    receivedBy: asUserId(r.receivedBy),
    createdBy: asUserId(r.createdBy),
});

/** Postgres adapter of purchase orders; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzlePurchaseOrderRepository extends PurchaseOrderRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(orderId: string): Promise<PurchaseOrderRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(pcOrders).where(eq(pcOrders.id, orderId)).limit(1);
        return row === undefined ? undefined : toOrder(row);
    }

    async lock(workspaceId: WorkspaceId, orderId: string): Promise<PurchaseOrderRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(pcOrders)
            .where(and(eq(pcOrders.workspaceId, workspaceId), eq(pcOrders.id, orderId))).limit(1).for('update');
        return row === undefined ? undefined : toOrder(row);
    }

    async listByProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<PurchaseOrderRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(pcOrders)
            .where(and(eq(pcOrders.workspaceId, workspaceId), inArray(pcOrders.projectId, [...projectIds])))
            .orderBy(desc(pcOrders.createdAt), desc(pcOrders.id));
        return rows.map(toOrder);
    }

    async listByWorkspace(workspaceId: WorkspaceId, statuses?: readonly PurchaseOrderStatus[]): Promise<PurchaseOrderRecord[]> {
        const rows = await this.ctx.executor.select().from(pcOrders)
            .where(and(
                eq(pcOrders.workspaceId, workspaceId),
                ...(statuses === undefined || statuses.length === 0 ? [] : [inArray(pcOrders.status, [...statuses])]),
            ))
            .orderBy(desc(pcOrders.createdAt), desc(pcOrders.id));
        return rows.map(toOrder);
    }

    async insert(r: PurchaseOrderRecord): Promise<void> {
        await this.ctx.executor.insert(pcOrders).values({ ...r });
    }

    async save(r: PurchaseOrderRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = r;
        await this.ctx.executor.update(pcOrders).set(rest).where(and(eq(pcOrders.workspaceId, workspaceId), eq(pcOrders.id, id)));
    }

    async linesOf(workspaceId: WorkspaceId, orderId: string): Promise<PurchaseOrderLineRecord[]> {
        const rows = await this.ctx.executor.select().from(pcOrderLines)
            .where(and(eq(pcOrderLines.workspaceId, workspaceId), eq(pcOrderLines.orderId, orderId)))
            .orderBy(asc(pcOrderLines.sort));
        return rows.map(toOrderLine);
    }

    async linesByIds(workspaceId: WorkspaceId, lineIds: readonly string[]): Promise<PurchaseOrderLineRecord[]> {
        if (lineIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(pcOrderLines)
            .where(and(eq(pcOrderLines.workspaceId, workspaceId), inArray(pcOrderLines.id, [...lineIds])));
        return rows.map(toOrderLine);
    }

    async replaceLines(workspaceId: WorkspaceId, orderId: string, lines: readonly PurchaseOrderLineRecord[]): Promise<void> {
        await this.ctx.executor.delete(pcOrderLines).where(and(eq(pcOrderLines.workspaceId, workspaceId), eq(pcOrderLines.orderId, orderId)));
        if (lines.length > 0) await this.ctx.executor.insert(pcOrderLines).values(lines.map(l => ({ ...l })));
    }

    async saveLineProgress(workspaceId: WorkspaceId, lines: readonly Pick<PurchaseOrderLineRecord, 'id' | 'receivedQty' | 'billedQty'>[]): Promise<void> {
        for (const l of lines) {
            await this.ctx.executor.update(pcOrderLines).set({ receivedQty: l.receivedQty, billedQty: l.billedQty })
                .where(and(eq(pcOrderLines.workspaceId, workspaceId), eq(pcOrderLines.id, l.id)));
        }
    }

    async lineCounts(workspaceId: WorkspaceId, orderIds: readonly string[]): Promise<Map<string, number>> {
        const out = new Map<string, number>(orderIds.map(id => [id, 0]));
        if (orderIds.length === 0) return out;
        const rows = await this.ctx.executor.select({ id: pcOrderLines.orderId, n: count() }).from(pcOrderLines)
            .where(and(eq(pcOrderLines.workspaceId, workspaceId), inArray(pcOrderLines.orderId, [...orderIds])))
            .groupBy(pcOrderLines.orderId);
        for (const r of rows) out.set(r.id, r.n);
        return out;
    }

    async orderedQty(
        workspaceId: WorkspaceId, projectId: ProjectId, costCodeIds: readonly string[], exceptOrderId: string | null, withoutRequestOnly: boolean,
    ): Promise<Map<string, number>> {
        const out = new Map<string, number>();
        if (costCodeIds.length === 0) return out;
        const rows = await this.ctx.executor
            .select({ costCodeId: pcOrderLines.costCodeId, qty: pcOrderLines.qty, receivedQty: pcOrderLines.receivedQty, status: pcOrders.status })
            .from(pcOrderLines)
            .innerJoin(pcOrders, eq(pcOrders.id, pcOrderLines.orderId))
            .where(and(
                eq(pcOrders.workspaceId, workspaceId),
                eq(pcOrders.projectId, projectId),
                inArray(pcOrders.status, [...ORDERED_STATUSES]),
                inArray(pcOrderLines.costCodeId, [...costCodeIds]),
                ...(exceptOrderId === null ? [] : [ne(pcOrders.id, exceptOrderId)]),
                ...(withoutRequestOnly ? [isNull(pcOrderLines.requestLineId)] : []),
            ));
        for (const r of rows) {
            if (r.costCodeId === null) continue;
            out.set(r.costCodeId, (out.get(r.costCodeId) ?? 0) + orderHeldQty(r.status, r));
        }
        return out;
    }

    async priceHistory(workspaceId: WorkspaceId, supplierId: string, q: string, limit: number): Promise<PriceHistoryRow[]> {
        const needle = q.trim();
        const like = `%${escapeLike(needle)}%`;
        const rows = await this.ctx.executor
            .select({
                orderId: pcOrders.id, orderNumber: pcOrders.number, projectId: pcOrders.projectId, orderDate: pcOrders.orderDate,
                issuedAt: pcOrders.issuedAt, descTh: pcOrderLines.descTh, descEn: pcOrderLines.descEn, unit: pcOrderLines.unit,
                qty: pcOrderLines.qty, unitPrice: pcOrderLines.unitPrice, costCodeId: pcOrderLines.costCodeId,
            })
            .from(pcOrderLines)
            .innerJoin(pcOrders, eq(pcOrders.id, pcOrderLines.orderId))
            .where(and(
                eq(pcOrders.workspaceId, workspaceId),
                eq(pcOrders.supplierId, supplierId),
                inArray(pcOrders.status, [...PURCHASE_ORDER_ISSUED_STATUSES]),
                ...(needle === '' ? [] : [or(sql`${pcOrderLines.descTh} ilike ${like}`, sql`${pcOrderLines.descEn} ilike ${like}`)]),
            ))
            .orderBy(desc(sql`coalesce(${pcOrders.issuedAt}, ${pcOrders.createdAt})`), desc(pcOrders.id), asc(pcOrderLines.sort))
            .limit(limit);
        return rows.map(r => ({ ...r, projectId: asProjectId(r.projectId) }));
    }

    deleteByProject(): Promise<void> {
        return Promise.resolve();
    }
}

/** Postgres adapter of goods receipts. */
export class DrizzleGoodsReceiptRepository extends GoodsReceiptRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(receiptId: string): Promise<GoodsReceiptRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(pcReceipts).where(eq(pcReceipts.id, receiptId)).limit(1);
        return row === undefined ? undefined : toReceipt(row);
    }

    async lock(workspaceId: WorkspaceId, receiptId: string): Promise<GoodsReceiptRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(pcReceipts)
            .where(and(eq(pcReceipts.workspaceId, workspaceId), eq(pcReceipts.id, receiptId))).limit(1).for('update');
        return row === undefined ? undefined : toReceipt(row);
    }

    async listByOrder(workspaceId: WorkspaceId, orderId: string): Promise<GoodsReceiptRecord[]> {
        const rows = await this.ctx.executor.select().from(pcReceipts)
            .where(and(eq(pcReceipts.workspaceId, workspaceId), eq(pcReceipts.orderId, orderId)))
            .orderBy(asc(pcReceipts.createdAt), asc(pcReceipts.id));
        return rows.map(toReceipt);
    }

    async insert(r: GoodsReceiptRecord): Promise<void> {
        await this.ctx.executor.insert(pcReceipts).values({ ...r });
    }

    async save(r: GoodsReceiptRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = r;
        await this.ctx.executor.update(pcReceipts).set(rest).where(and(eq(pcReceipts.workspaceId, workspaceId), eq(pcReceipts.id, id)));
    }

    async linesOf(workspaceId: WorkspaceId, receiptId: string): Promise<GoodsReceiptLineRecord[]> {
        const rows = await this.ctx.executor.select().from(pcReceiptLines)
            .where(and(eq(pcReceiptLines.workspaceId, workspaceId), eq(pcReceiptLines.receiptId, receiptId)))
            .orderBy(asc(pcReceiptLines.sort));
        return rows.map(r => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) }));
    }

    async replaceLines(workspaceId: WorkspaceId, receiptId: string, lines: readonly GoodsReceiptLineRecord[]): Promise<void> {
        await this.ctx.executor.delete(pcReceiptLines).where(and(eq(pcReceiptLines.workspaceId, workspaceId), eq(pcReceiptLines.receiptId, receiptId)));
        if (lines.length > 0) await this.ctx.executor.insert(pcReceiptLines).values(lines.map(l => ({ ...l })));
    }

    deleteByProject(): Promise<void> {
        return Promise.resolve();
    }
}
