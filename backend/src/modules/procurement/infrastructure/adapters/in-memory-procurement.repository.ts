import type { RfqStatus } from '@contrack/contract';
import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import {
    type PurchaseRequestLineRecord, PurchaseRequestRepository, type PurchaseRequestRecord, REQUESTED_STATUSES, type RfqCounts,
    type RfqLineRecord, type RfqQuoteRecord, type RfqRecord, RfqRepository, type RfqSupplierRecord, heldQty,
} from '../../application/ports/procurement.repository';

const clone = <T>(v: T): T => structuredClone(v);

const newestFirst = (a: { createdAt: Date; id: string }, b: { createdAt: Date; id: string }): number =>
    b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1);

/** Memory adapter (tests / trying without a database); mimics the unique (workspace, number). */
export class InMemoryPurchaseRequestRepository extends PurchaseRequestRepository {
    private readonly requests = new Map<string, PurchaseRequestRecord>();
    private readonly lines = new Map<string, PurchaseRequestLineRecord[]>();

    find(requestId: string): Promise<PurchaseRequestRecord | undefined> {
        const r = this.requests.get(requestId);
        return Promise.resolve(r === undefined ? undefined : clone(r));
    }

    lock(workspaceId: WorkspaceId, requestId: string): Promise<PurchaseRequestRecord | undefined> {
        const r = this.requests.get(requestId);
        return Promise.resolve(r?.workspaceId === workspaceId ? clone(r) : undefined);
    }

    listByProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<PurchaseRequestRecord[]> {
        const ids = new Set<string>(projectIds);
        return Promise.resolve([...this.requests.values()]
            .filter(r => r.workspaceId === workspaceId && ids.has(r.projectId)).sort(newestFirst).map(clone));
    }

    findMany(workspaceId: WorkspaceId, requestIds: readonly string[]): Promise<PurchaseRequestRecord[]> {
        return Promise.resolve(requestIds.flatMap(id => {
            const r = this.requests.get(id);
            return r?.workspaceId === workspaceId ? [clone(r)] : [];
        }));
    }

    private clash(r: PurchaseRequestRecord): boolean {
        return r.number !== null && [...this.requests.values()].some(o => o.id !== r.id && o.workspaceId === r.workspaceId && o.number === r.number);
    }

    insert(r: PurchaseRequestRecord): Promise<void> {
        if (this.requests.has(r.id) || this.clash(r)) return Promise.reject(new Error(`duplicate purchase request ${r.id}`));
        this.requests.set(r.id, clone(r));
        return Promise.resolve();
    }

    save(r: PurchaseRequestRecord): Promise<void> {
        if (this.clash(r)) return Promise.reject(new Error(`duplicate purchase request number ${r.number}`));
        if (this.requests.get(r.id)?.workspaceId === r.workspaceId) this.requests.set(r.id, clone(r));
        return Promise.resolve();
    }

    linesOf(workspaceId: WorkspaceId, requestId: string): Promise<PurchaseRequestLineRecord[]> {
        return Promise.resolve((this.lines.get(requestId) ?? []).filter(l => l.workspaceId === workspaceId).sort((a, b) => a.sort - b.sort).map(clone));
    }

    linesByIds(workspaceId: WorkspaceId, lineIds: readonly string[]): Promise<PurchaseRequestLineRecord[]> {
        const ids = new Set(lineIds);
        return Promise.resolve([...this.lines.values()].flat().filter(l => l.workspaceId === workspaceId && ids.has(l.id)).map(clone));
    }

    replaceLines(workspaceId: WorkspaceId, requestId: string, lines: readonly PurchaseRequestLineRecord[]): Promise<void> {
        if (this.requests.get(requestId)?.workspaceId === workspaceId) this.lines.set(requestId, lines.map(clone));
        return Promise.resolve();
    }

    lineCounts(workspaceId: WorkspaceId, requestIds: readonly string[]): Promise<Map<string, number>> {
        return Promise.resolve(new Map(requestIds.map(id => [id, this.requests.get(id)?.workspaceId === workspaceId ? (this.lines.get(id) ?? []).length : 0])));
    }

    requestedQty(
        workspaceId: WorkspaceId, projectId: ProjectId, costCodeIds: readonly string[], exceptRequestId: string | null,
    ): Promise<Map<string, number>> {
        const codes = new Set(costCodeIds);
        const out = new Map<string, number>();
        for (const r of this.requests.values()) {
            if (r.workspaceId !== workspaceId || r.projectId !== projectId || r.id === exceptRequestId || !REQUESTED_STATUSES.includes(r.status)) continue;
            for (const l of this.lines.get(r.id) ?? []) {
                if (l.costCodeId === null || !codes.has(l.costCodeId)) continue;
                out.set(l.costCodeId, (out.get(l.costCodeId) ?? 0) + heldQty(r.status, l));
            }
        }
        return Promise.resolve(out);
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const r of [...this.requests.values()]) {
            if (r.workspaceId !== workspaceId || r.projectId !== projectId) continue;
            this.requests.delete(r.id);
            this.lines.delete(r.id);
        }
        return Promise.resolve();
    }
}

/** Memory adapter of RFQs. */
export class InMemoryRfqRepository extends RfqRepository {
    private readonly rfqs = new Map<string, RfqRecord>();
    private readonly lines = new Map<string, RfqLineRecord[]>();
    private readonly suppliers = new Map<string, RfqSupplierRecord[]>();
    private readonly quotes = new Map<string, RfqQuoteRecord[]>();

    find(rfqId: string): Promise<RfqRecord | undefined> {
        const r = this.rfqs.get(rfqId);
        return Promise.resolve(r === undefined ? undefined : clone(r));
    }

    lock(workspaceId: WorkspaceId, rfqId: string): Promise<RfqRecord | undefined> {
        const r = this.rfqs.get(rfqId);
        return Promise.resolve(r?.workspaceId === workspaceId ? clone(r) : undefined);
    }

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<RfqRecord[]> {
        return Promise.resolve([...this.rfqs.values()]
            .filter(r => r.workspaceId === workspaceId && r.projectId === projectId).sort(newestFirst).map(clone));
    }

    withRequest(workspaceId: WorkspaceId, requestId: string, statuses: readonly RfqStatus[]): Promise<RfqRecord[]> {
        return Promise.resolve([...this.rfqs.values()]
            .filter(r => r.workspaceId === workspaceId && statuses.includes(r.status) && r.requestIds.includes(requestId)).map(clone));
    }

    private clash(r: RfqRecord): boolean {
        return r.number !== null && [...this.rfqs.values()].some(o => o.id !== r.id && o.workspaceId === r.workspaceId && o.number === r.number);
    }

    insert(r: RfqRecord): Promise<void> {
        if (this.rfqs.has(r.id) || this.clash(r)) return Promise.reject(new Error(`duplicate rfq ${r.id}`));
        this.rfqs.set(r.id, clone(r));
        return Promise.resolve();
    }

    save(r: RfqRecord): Promise<void> {
        if (this.clash(r)) return Promise.reject(new Error(`duplicate rfq number ${r.number}`));
        if (this.rfqs.get(r.id)?.workspaceId === r.workspaceId) this.rfqs.set(r.id, clone(r));
        return Promise.resolve();
    }

    private owned(workspaceId: WorkspaceId, rfqId: string): boolean {
        return this.rfqs.get(rfqId)?.workspaceId === workspaceId;
    }

    linesOf(workspaceId: WorkspaceId, rfqId: string): Promise<RfqLineRecord[]> {
        return Promise.resolve(this.owned(workspaceId, rfqId) ? (this.lines.get(rfqId) ?? []).sort((a, b) => a.sort - b.sort).map(clone) : []);
    }

    replaceLines(workspaceId: WorkspaceId, rfqId: string, lines: readonly RfqLineRecord[]): Promise<void> {
        if (this.owned(workspaceId, rfqId)) this.lines.set(rfqId, lines.map(clone));
        return Promise.resolve();
    }

    suppliersOf(workspaceId: WorkspaceId, rfqId: string): Promise<RfqSupplierRecord[]> {
        return Promise.resolve(this.owned(workspaceId, rfqId)
            ? (this.suppliers.get(rfqId) ?? []).sort((a, b) => a.invitedAt.getTime() - b.invitedAt.getTime() || (a.supplierId < b.supplierId ? -1 : 1)).map(clone)
            : []);
    }

    replaceSuppliers(workspaceId: WorkspaceId, rfqId: string, rows: readonly RfqSupplierRecord[]): Promise<void> {
        if (this.owned(workspaceId, rfqId)) this.suppliers.set(rfqId, rows.map(clone));
        return Promise.resolve();
    }

    quotesOf(workspaceId: WorkspaceId, rfqId: string): Promise<RfqQuoteRecord[]> {
        return Promise.resolve(this.owned(workspaceId, rfqId)
            ? (this.quotes.get(rfqId) ?? []).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map(clone)
            : []);
    }

    upsertQuote(q: RfqQuoteRecord): Promise<void> {
        if (!this.owned(q.workspaceId, q.rfqId)) return Promise.resolve();
        const list = this.quotes.get(q.rfqId) ?? [];
        const known = list.find(o => o.supplierId === q.supplierId);
        const next = known === undefined ? clone(q) : { ...clone(q), id: known.id, createdAt: known.createdAt, createdBy: known.createdBy };
        const rest = list.filter(o => o.supplierId !== q.supplierId);
        rest.push(next);
        this.quotes.set(q.rfqId, rest);
        return Promise.resolve();
    }

    deleteQuote(workspaceId: WorkspaceId, rfqId: string, supplierId: string): Promise<void> {
        if (this.owned(workspaceId, rfqId)) this.quotes.set(rfqId, (this.quotes.get(rfqId) ?? []).filter(q => q.supplierId !== supplierId));
        return Promise.resolve();
    }

    counts(workspaceId: WorkspaceId, rfqIds: readonly string[]): Promise<Map<string, RfqCounts>> {
        return Promise.resolve(new Map(rfqIds.map(id => [id, this.owned(workspaceId, id)
            ? { lines: (this.lines.get(id) ?? []).length, suppliers: (this.suppliers.get(id) ?? []).length, quotes: (this.quotes.get(id) ?? []).length }
            : { lines: 0, suppliers: 0, quotes: 0 }])));
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const r of [...this.rfqs.values()]) {
            if (r.workspaceId !== workspaceId || r.projectId !== projectId) continue;
            this.rfqs.delete(r.id);
            this.lines.delete(r.id);
            this.suppliers.delete(r.id);
            this.quotes.delete(r.id);
        }
        return Promise.resolve();
    }
}
