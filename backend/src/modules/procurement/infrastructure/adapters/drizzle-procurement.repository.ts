import type { RfqStatus } from '@contrack/contract';
import { and, asc, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import {
    pcRequestLines, pcRequests, pcRfqLines, pcRfqQuotes, pcRfqSuppliers, pcRfqs,
} from '../../../../shared/infrastructure/database/schema-procurement';
import {
    type PurchaseRequestLineRecord, PurchaseRequestRepository, type PurchaseRequestRecord, REQUESTED_STATUSES, type RfqCounts,
    type RfqLineRecord, type RfqQuoteRecord, type RfqRecord, RfqRepository, type RfqSupplierRecord, heldQty,
} from '../../application/ports/procurement.repository';

type RequestRow = typeof pcRequests.$inferSelect;
type RfqRow = typeof pcRfqs.$inferSelect;

const toRequest = (r: RequestRow): PurchaseRequestRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    requestedBy: asUserId(r.requestedBy),
    createdBy: asUserId(r.createdBy),
});

const toRequestLine = (r: typeof pcRequestLines.$inferSelect): PurchaseRequestLineRecord => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) });

const toRfq = (r: RfqRow): RfqRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    createdBy: asUserId(r.createdBy),
});

/** Postgres adapter of purchase requests; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzlePurchaseRequestRepository extends PurchaseRequestRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(requestId: string): Promise<PurchaseRequestRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(pcRequests).where(eq(pcRequests.id, requestId)).limit(1);
        return row === undefined ? undefined : toRequest(row);
    }

    async lock(workspaceId: WorkspaceId, requestId: string): Promise<PurchaseRequestRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(pcRequests)
            .where(and(eq(pcRequests.workspaceId, workspaceId), eq(pcRequests.id, requestId))).limit(1).for('update');
        return row === undefined ? undefined : toRequest(row);
    }

    async listByProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<PurchaseRequestRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(pcRequests)
            .where(and(eq(pcRequests.workspaceId, workspaceId), inArray(pcRequests.projectId, [...projectIds])))
            .orderBy(desc(pcRequests.createdAt), desc(pcRequests.id));
        return rows.map(toRequest);
    }

    async findMany(workspaceId: WorkspaceId, requestIds: readonly string[]): Promise<PurchaseRequestRecord[]> {
        if (requestIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(pcRequests)
            .where(and(eq(pcRequests.workspaceId, workspaceId), inArray(pcRequests.id, [...requestIds])));
        return rows.map(toRequest);
    }

    async insert(r: PurchaseRequestRecord): Promise<void> {
        await this.ctx.executor.insert(pcRequests).values({ ...r });
    }

    async save(r: PurchaseRequestRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = r;
        await this.ctx.executor.update(pcRequests).set(rest).where(and(eq(pcRequests.workspaceId, workspaceId), eq(pcRequests.id, id)));
    }

    async linesOf(workspaceId: WorkspaceId, requestId: string): Promise<PurchaseRequestLineRecord[]> {
        const rows = await this.ctx.executor.select().from(pcRequestLines)
            .where(and(eq(pcRequestLines.workspaceId, workspaceId), eq(pcRequestLines.requestId, requestId)))
            .orderBy(asc(pcRequestLines.sort));
        return rows.map(toRequestLine);
    }

    async linesByIds(workspaceId: WorkspaceId, lineIds: readonly string[]): Promise<PurchaseRequestLineRecord[]> {
        if (lineIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(pcRequestLines)
            .where(and(eq(pcRequestLines.workspaceId, workspaceId), inArray(pcRequestLines.id, [...lineIds])));
        return rows.map(toRequestLine);
    }

    async replaceLines(workspaceId: WorkspaceId, requestId: string, lines: readonly PurchaseRequestLineRecord[]): Promise<void> {
        await this.ctx.executor.delete(pcRequestLines)
            .where(and(eq(pcRequestLines.workspaceId, workspaceId), eq(pcRequestLines.requestId, requestId)));
        if (lines.length > 0) await this.ctx.executor.insert(pcRequestLines).values(lines.map(l => ({ ...l })));
    }

    async lineCounts(workspaceId: WorkspaceId, requestIds: readonly string[]): Promise<Map<string, number>> {
        const out = new Map<string, number>(requestIds.map(id => [id, 0]));
        if (requestIds.length === 0) return out;
        const rows = await this.ctx.executor.select({ id: pcRequestLines.requestId, n: count() }).from(pcRequestLines)
            .where(and(eq(pcRequestLines.workspaceId, workspaceId), inArray(pcRequestLines.requestId, [...requestIds])))
            .groupBy(pcRequestLines.requestId);
        for (const r of rows) out.set(r.id, r.n);
        return out;
    }

    async requestedQty(
        workspaceId: WorkspaceId, projectId: ProjectId, costCodeIds: readonly string[], exceptRequestId: string | null,
    ): Promise<Map<string, number>> {
        const out = new Map<string, number>();
        if (costCodeIds.length === 0) return out;
        const rows = await this.ctx.executor
            .select({ costCodeId: pcRequestLines.costCodeId, qty: pcRequestLines.qty, orderedQty: pcRequestLines.orderedQty, status: pcRequests.status })
            .from(pcRequestLines)
            .innerJoin(pcRequests, eq(pcRequests.id, pcRequestLines.requestId))
            .where(and(
                eq(pcRequests.workspaceId, workspaceId),
                eq(pcRequests.projectId, projectId),
                inArray(pcRequests.status, [...REQUESTED_STATUSES]),
                inArray(pcRequestLines.costCodeId, [...costCodeIds]),
                ...(exceptRequestId === null ? [] : [ne(pcRequests.id, exceptRequestId)]),
            ));
        for (const r of rows) {
            if (r.costCodeId === null) continue;
            out.set(r.costCodeId, (out.get(r.costCodeId) ?? 0) + heldQty(r.status, r));
        }
        return out;
    }

    async addOrderedQty(workspaceId: WorkspaceId, deltas: readonly { lineId: string; qty: number }[]): Promise<void> {
        for (const d of deltas) {
            await this.ctx.executor.update(pcRequestLines)
                .set({ orderedQty: sql`round(${pcRequestLines.orderedQty} + ${d.qty}, 4)` })
                .where(and(eq(pcRequestLines.workspaceId, workspaceId), eq(pcRequestLines.id, d.lineId)));
        }
    }

    deleteByProject(): Promise<void> {
        return Promise.resolve();
    }
}

/** Postgres adapter of RFQs. */
export class DrizzleRfqRepository extends RfqRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(rfqId: string): Promise<RfqRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(pcRfqs).where(eq(pcRfqs.id, rfqId)).limit(1);
        return row === undefined ? undefined : toRfq(row);
    }

    async lock(workspaceId: WorkspaceId, rfqId: string): Promise<RfqRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(pcRfqs)
            .where(and(eq(pcRfqs.workspaceId, workspaceId), eq(pcRfqs.id, rfqId))).limit(1).for('update');
        return row === undefined ? undefined : toRfq(row);
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<RfqRecord[]> {
        const rows = await this.ctx.executor.select().from(pcRfqs)
            .where(and(eq(pcRfqs.workspaceId, workspaceId), eq(pcRfqs.projectId, projectId)))
            .orderBy(desc(pcRfqs.createdAt), desc(pcRfqs.id));
        return rows.map(toRfq);
    }

    async withRequest(workspaceId: WorkspaceId, requestId: string, statuses: readonly RfqStatus[]): Promise<RfqRecord[]> {
        if (statuses.length === 0) return [];
        const rows = await this.ctx.executor.select().from(pcRfqs)
            .where(and(
                eq(pcRfqs.workspaceId, workspaceId),
                inArray(pcRfqs.status, [...statuses]),
                sql`${pcRfqs.requestIds} @> ${JSON.stringify([requestId])}::jsonb`,
            ));
        return rows.map(toRfq);
    }

    async insert(r: RfqRecord): Promise<void> {
        await this.ctx.executor.insert(pcRfqs).values({ ...r });
    }

    async save(r: RfqRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = r;
        await this.ctx.executor.update(pcRfqs).set(rest).where(and(eq(pcRfqs.workspaceId, workspaceId), eq(pcRfqs.id, id)));
    }

    async linesOf(workspaceId: WorkspaceId, rfqId: string): Promise<RfqLineRecord[]> {
        const rows = await this.ctx.executor.select().from(pcRfqLines)
            .where(and(eq(pcRfqLines.workspaceId, workspaceId), eq(pcRfqLines.rfqId, rfqId)))
            .orderBy(asc(pcRfqLines.sort));
        return rows.map(r => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) }));
    }

    async replaceLines(workspaceId: WorkspaceId, rfqId: string, lines: readonly RfqLineRecord[]): Promise<void> {
        await this.ctx.executor.delete(pcRfqLines).where(and(eq(pcRfqLines.workspaceId, workspaceId), eq(pcRfqLines.rfqId, rfqId)));
        if (lines.length > 0) await this.ctx.executor.insert(pcRfqLines).values(lines.map(l => ({ ...l })));
    }

    async suppliersOf(workspaceId: WorkspaceId, rfqId: string): Promise<RfqSupplierRecord[]> {
        const rows = await this.ctx.executor.select().from(pcRfqSuppliers)
            .where(and(eq(pcRfqSuppliers.workspaceId, workspaceId), eq(pcRfqSuppliers.rfqId, rfqId)))
            .orderBy(asc(pcRfqSuppliers.invitedAt), asc(pcRfqSuppliers.supplierId));
        return rows.map(r => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) }));
    }

    async replaceSuppliers(workspaceId: WorkspaceId, rfqId: string, rows: readonly RfqSupplierRecord[]): Promise<void> {
        await this.ctx.executor.delete(pcRfqSuppliers).where(and(eq(pcRfqSuppliers.workspaceId, workspaceId), eq(pcRfqSuppliers.rfqId, rfqId)));
        if (rows.length > 0) await this.ctx.executor.insert(pcRfqSuppliers).values(rows.map(r => ({ ...r })));
    }

    async quotesOf(workspaceId: WorkspaceId, rfqId: string): Promise<RfqQuoteRecord[]> {
        const rows = await this.ctx.executor.select().from(pcRfqQuotes)
            .where(and(eq(pcRfqQuotes.workspaceId, workspaceId), eq(pcRfqQuotes.rfqId, rfqId)))
            .orderBy(asc(pcRfqQuotes.createdAt));
        return rows.map(r => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId), createdBy: asUserId(r.createdBy) }));
    }

    async upsertQuote(q: RfqQuoteRecord): Promise<void> {
        const { id: _id, rfqId: _r, supplierId: _s, workspaceId: _w, createdAt: _c, createdBy: _b, ...rest } = q;
        await this.ctx.executor.insert(pcRfqQuotes).values({ ...q })
            .onConflictDoUpdate({ target: [pcRfqQuotes.rfqId, pcRfqQuotes.supplierId], set: rest });
    }

    async deleteQuote(workspaceId: WorkspaceId, rfqId: string, supplierId: string): Promise<void> {
        await this.ctx.executor.delete(pcRfqQuotes).where(and(
            eq(pcRfqQuotes.workspaceId, workspaceId), eq(pcRfqQuotes.rfqId, rfqId), eq(pcRfqQuotes.supplierId, supplierId),
        ));
    }

    async counts(workspaceId: WorkspaceId, rfqIds: readonly string[]): Promise<Map<string, RfqCounts>> {
        const out = new Map<string, RfqCounts>(rfqIds.map(id => [id, { lines: 0, suppliers: 0, quotes: 0 }]));
        if (rfqIds.length === 0) return out;
        const ids = [...rfqIds];
        const lines = await this.ctx.executor.select({ id: pcRfqLines.rfqId, n: count() }).from(pcRfqLines)
            .where(and(eq(pcRfqLines.workspaceId, workspaceId), inArray(pcRfqLines.rfqId, ids))).groupBy(pcRfqLines.rfqId);
        const suppliers = await this.ctx.executor.select({ id: pcRfqSuppliers.rfqId, n: count() }).from(pcRfqSuppliers)
            .where(and(eq(pcRfqSuppliers.workspaceId, workspaceId), inArray(pcRfqSuppliers.rfqId, ids))).groupBy(pcRfqSuppliers.rfqId);
        const quotes = await this.ctx.executor.select({ id: pcRfqQuotes.rfqId, n: count() }).from(pcRfqQuotes)
            .where(and(eq(pcRfqQuotes.workspaceId, workspaceId), inArray(pcRfqQuotes.rfqId, ids))).groupBy(pcRfqQuotes.rfqId);
        for (const r of lines) { const c = out.get(r.id); if (c !== undefined) c.lines = r.n; }
        for (const r of suppliers) { const c = out.get(r.id); if (c !== undefined) c.suppliers = r.n; }
        for (const r of quotes) { const c = out.get(r.id); if (c !== undefined) c.quotes = r.n; }
        return out;
    }

    deleteByProject(): Promise<void> {
        return Promise.resolve();
    }
}
