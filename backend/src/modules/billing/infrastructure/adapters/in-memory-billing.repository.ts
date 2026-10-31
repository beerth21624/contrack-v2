import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import {
    type AdvanceEntryRecord, BillingRepository, type ClaimLineRecord, type ClaimRecord, type InvoiceRecord, type ReceiptAllocationRecord,
    type ReceiptRecord, type RetentionEntryRecord,
} from '../../application/ports/billing.repository';

const RECEIVABLE = (i: InvoiceRecord): boolean =>
    (i.kind === 'invoice' || i.kind === 'advance_invoice') && (i.status === 'issued' || i.status === 'partially_paid');
const byIssue = (a: InvoiceRecord, b: InvoiceRecord): number => a.issueDate.localeCompare(b.issueDate) || a.createdAt.getTime() - b.createdAt.getTime();

const clone = <T>(v: T): T => structuredClone(v);
const OPEN = new Set(['draft', 'pending_approval', 'submitted']);
const byCreated = (a: { createdAt: Date }, b: { createdAt: Date }): number => a.createdAt.getTime() - b.createdAt.getTime();

/** Memory adapter (tests / trying without a database); mimics the unique keys of `ar_*`. */
export class InMemoryBillingRepository extends BillingRepository {
    private readonly claims = new Map<string, ClaimRecord>();
    private readonly lines = new Map<string, ClaimLineRecord[]>();
    private readonly invoices = new Map<string, InvoiceRecord>();
    private readonly retention = new Map<string, RetentionEntryRecord>();
    private readonly advance = new Map<string, AdvanceEntryRecord>();
    private readonly receipts = new Map<string, ReceiptRecord>();
    private readonly allocations: ReceiptAllocationRecord[] = [];

    findClaim(claimId: string): Promise<ClaimRecord | undefined> {
        const c = this.claims.get(claimId);
        return Promise.resolve(c === undefined ? undefined : clone(c));
    }

    lockClaim(workspaceId: WorkspaceId, claimId: string): Promise<ClaimRecord | undefined> {
        const c = this.claims.get(claimId);
        return Promise.resolve(c?.workspaceId === workspaceId ? clone(c) : undefined);
    }

    claimsOfContract(workspaceId: WorkspaceId, contractId: string): Promise<ClaimRecord[]> {
        return Promise.resolve([...this.claims.values()]
            .filter(c => c.workspaceId === workspaceId && c.contractId === contractId)
            .sort((a, b) => a.claimNo - b.claimNo)
            .map(clone));
    }

    claimsOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<ClaimRecord[]> {
        const ids = new Set<string>(projectIds);
        return Promise.resolve([...this.claims.values()].filter(c => c.workspaceId === workspaceId && ids.has(c.projectId)).map(clone));
    }

    insertClaim(c: ClaimRecord): Promise<void> {
        const clash = [...this.claims.values()].some(o => o.id === c.id
            || (o.contractId === c.contractId && o.claimNo === c.claimNo)
            || (o.contractId === c.contractId && OPEN.has(o.status) && OPEN.has(c.status)));
        if (clash) return Promise.reject(new Error(`duplicate claim ${c.id} (contract ${c.contractId}, no ${c.claimNo})`));
        this.claims.set(c.id, clone(c));
        return Promise.resolve();
    }

    saveClaim(c: ClaimRecord): Promise<void> {
        if (this.claims.get(c.id)?.workspaceId === c.workspaceId) this.claims.set(c.id, clone(c));
        return Promise.resolve();
    }

    linesOf(workspaceId: WorkspaceId, claimIds: readonly string[]): Promise<ClaimLineRecord[]> {
        return Promise.resolve(claimIds.flatMap(id => (this.lines.get(id) ?? []).filter(l => l.workspaceId === workspaceId)).map(clone));
    }

    replaceLines(_workspaceId: WorkspaceId, claimId: string, lines: readonly ClaimLineRecord[]): Promise<void> {
        this.lines.set(claimId, lines.map(clone));
        return Promise.resolve();
    }

    findInvoice(invoiceId: string): Promise<InvoiceRecord | undefined> {
        const i = this.invoices.get(invoiceId);
        return Promise.resolve(i === undefined ? undefined : clone(i));
    }

    lockInvoice(workspaceId: WorkspaceId, invoiceId: string): Promise<InvoiceRecord | undefined> {
        const i = this.invoices.get(invoiceId);
        return Promise.resolve(i?.workspaceId === workspaceId ? clone(i) : undefined);
    }

    invoicesOfProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<InvoiceRecord[]> {
        return Promise.resolve([...this.invoices.values()]
            .filter(i => i.workspaceId === workspaceId && i.projectId === projectId)
            .sort((a, b) => byCreated(b, a))
            .map(clone));
    }

    invoicesOfContract(workspaceId: WorkspaceId, contractId: string): Promise<InvoiceRecord[]> {
        return Promise.resolve([...this.invoices.values()]
            .filter(i => i.workspaceId === workspaceId && i.contractId === contractId)
            .sort((a, b) => byCreated(b, a))
            .map(clone));
    }

    invoicesOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<InvoiceRecord[]> {
        const ids = new Set<string>(projectIds);
        return Promise.resolve([...this.invoices.values()]
            .filter(i => i.workspaceId === workspaceId && i.projectId !== null && ids.has(i.projectId)).map(clone));
    }

    insertInvoice(i: InvoiceRecord): Promise<void> {
        const clash = [...this.invoices.values()].some(o => o.id === i.id
            || (i.number !== null && o.workspaceId === i.workspaceId && o.number === i.number));
        if (clash) return Promise.reject(new Error(`duplicate invoice ${i.id}`));
        this.invoices.set(i.id, clone(i));
        return Promise.resolve();
    }

    saveInvoice(i: InvoiceRecord): Promise<void> {
        if (this.invoices.get(i.id)?.workspaceId === i.workspaceId) this.invoices.set(i.id, clone(i));
        return Promise.resolve();
    }

    relatedInvoices(workspaceId: WorkspaceId, invoiceId: string): Promise<InvoiceRecord[]> {
        return Promise.resolve([...this.invoices.values()]
            .filter(i => i.workspaceId === workspaceId && i.relatedInvoiceId === invoiceId).sort(byCreated).map(clone));
    }

    invoicesOfCustomer(workspaceId: WorkspaceId, customerId: string): Promise<InvoiceRecord[]> {
        return Promise.resolve([...this.invoices.values()]
            .filter(i => i.workspaceId === workspaceId && i.customerId === customerId).sort(byIssue).map(clone));
    }

    openInvoices(workspaceId: WorkspaceId): Promise<InvoiceRecord[]> {
        return Promise.resolve([...this.invoices.values()]
            .filter(i => i.workspaceId === workspaceId && RECEIVABLE(i))
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || byCreated(a, b)).map(clone));
    }

    openInvoicesDueBetween(from: string, to: string, limit: number): Promise<InvoiceRecord[]> {
        return Promise.resolve([...this.invoices.values()]
            .filter(i => RECEIVABLE(i) && i.dueDate >= from && i.dueDate <= to)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, limit).map(clone));
    }

    findReceipt(receiptId: string): Promise<ReceiptRecord | undefined> {
        const r = this.receipts.get(receiptId);
        return Promise.resolve(r === undefined ? undefined : clone(r));
    }

    lockReceipt(workspaceId: WorkspaceId, receiptId: string): Promise<ReceiptRecord | undefined> {
        const r = this.receipts.get(receiptId);
        return Promise.resolve(r?.workspaceId === workspaceId ? clone(r) : undefined);
    }

    insertReceipt(r: ReceiptRecord): Promise<void> {
        const clash = [...this.receipts.values()].some(o => o.id === r.id || (o.workspaceId === r.workspaceId && o.number === r.number));
        if (clash) return Promise.reject(new Error(`duplicate receipt ${r.id}`));
        this.receipts.set(r.id, clone(r));
        return Promise.resolve();
    }

    saveReceipt(r: ReceiptRecord): Promise<void> {
        if (this.receipts.get(r.id)?.workspaceId === r.workspaceId) this.receipts.set(r.id, clone(r));
        return Promise.resolve();
    }

    receiptsOfCustomer(workspaceId: WorkspaceId, customerId: string): Promise<ReceiptRecord[]> {
        return Promise.resolve([...this.receipts.values()]
            .filter(r => r.workspaceId === workspaceId && r.customerId === customerId)
            .sort((a, b) => a.receiptDate.localeCompare(b.receiptDate) || byCreated(a, b)).map(clone));
    }

    insertAllocations(rows: readonly ReceiptAllocationRecord[]): Promise<void> {
        for (const r of rows) {
            if (this.allocations.some(o => o.receiptId === r.receiptId && o.invoiceId === r.invoiceId)) {
                return Promise.reject(new Error(`duplicate allocation ${r.receiptId}/${r.invoiceId}`));
            }
        }
        this.allocations.push(...rows.map(clone));
        return Promise.resolve();
    }

    allocationsOf(workspaceId: WorkspaceId, receiptIds: readonly string[]): Promise<ReceiptAllocationRecord[]> {
        const ids = new Set(receiptIds);
        return Promise.resolve(this.allocations.filter(a => a.workspaceId === workspaceId && ids.has(a.receiptId)).map(clone));
    }

    retentionEntries(workspaceId: WorkspaceId, contractId: string): Promise<RetentionEntryRecord[]> {
        return Promise.resolve([...this.retention.values()]
            .filter(e => e.workspaceId === workspaceId && e.contractId === contractId)
            .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || byCreated(a, b))
            .map(clone));
    }

    insertRetentionEntry(e: RetentionEntryRecord): Promise<void> {
        const clash = [...this.retention.values()].some(o => o.id === e.id
            || (e.kind === 'withheld' && o.kind === 'withheld' && e.claimId !== null && o.claimId === e.claimId));
        if (clash) return Promise.reject(new Error(`duplicate retention entry ${e.id}`));
        this.retention.set(e.id, clone(e));
        return Promise.resolve();
    }

    deleteRetentionEntriesOfInvoice(workspaceId: WorkspaceId, invoiceId: string): Promise<void> {
        for (const [id, e] of [...this.retention.entries()]) if (e.workspaceId === workspaceId && e.invoiceId === invoiceId) this.retention.delete(id);
        return Promise.resolve();
    }

    advanceEntries(workspaceId: WorkspaceId, contractId: string): Promise<AdvanceEntryRecord[]> {
        return Promise.resolve([...this.advance.values()]
            .filter(e => e.workspaceId === workspaceId && e.contractId === contractId)
            .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || byCreated(a, b))
            .map(clone));
    }

    insertAdvanceEntry(e: AdvanceEntryRecord): Promise<void> {
        if (this.advance.has(e.id)) return Promise.reject(new Error(`duplicate advance entry ${e.id}`));
        this.advance.set(e.id, clone(e));
        return Promise.resolve();
    }

    deleteAdvanceEntriesOfInvoice(workspaceId: WorkspaceId, invoiceId: string): Promise<void> {
        for (const [id, e] of [...this.advance.entries()]) if (e.workspaceId === workspaceId && e.invoiceId === invoiceId) this.advance.delete(id);
        return Promise.resolve();
    }

    deleteAdvanceEntriesOfReceipt(workspaceId: WorkspaceId, receiptId: string): Promise<void> {
        for (const [id, e] of [...this.advance.entries()]) if (e.workspaceId === workspaceId && e.receiptId === receiptId) this.advance.delete(id);
        return Promise.resolve();
    }

    retentionEntriesOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<RetentionEntryRecord[]> {
        const ids = new Set<string>(projectIds);
        return Promise.resolve([...this.retention.values()].filter(e => e.workspaceId === workspaceId && ids.has(e.projectId)).map(clone));
    }

    advanceEntriesOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<AdvanceEntryRecord[]> {
        const ids = new Set<string>(projectIds);
        return Promise.resolve([...this.advance.values()].filter(e => e.workspaceId === workspaceId && ids.has(e.projectId)).map(clone));
    }

    contractsWithRetention(limit: number): Promise<{ workspaceId: WorkspaceId; contractId: string }[]> {
        const seen = new Map<string, { workspaceId: WorkspaceId; contractId: string }>();
        for (const e of this.retention.values()) if (e.kind === 'withheld') seen.set(e.contractId, { workspaceId: e.workspaceId, contractId: e.contractId });
        return Promise.resolve([...seen.values()].slice(0, limit));
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const c of [...this.claims.values()]) {
            if (c.workspaceId === workspaceId && c.projectId === projectId) {
                this.claims.delete(c.id);
                this.lines.delete(c.id);
            }
        }
        for (const r of [...this.receipts.values()]) {
            if (r.workspaceId === workspaceId && r.projectId === projectId) this.receipts.delete(r.id);
        }
        const invoiceIds = new Set([...this.invoices.values()].filter(i => i.workspaceId === workspaceId && i.projectId === projectId).map(i => i.id));
        for (let k = this.allocations.length - 1; k >= 0; k--) {
            const a = this.allocations[k];
            if (a !== undefined && (invoiceIds.has(a.invoiceId) || !this.receipts.has(a.receiptId))) this.allocations.splice(k, 1);
        }
        for (const map of [this.invoices, this.retention, this.advance] as Map<string, { workspaceId: WorkspaceId; projectId: ProjectId | null }>[]) {
            for (const [id, row] of [...map.entries()]) if (row.workspaceId === workspaceId && row.projectId === projectId) map.delete(id);
        }
        return Promise.resolve();
    }
}
