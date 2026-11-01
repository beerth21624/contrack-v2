import type { SupplierBillStatus } from '@contrack/contract';
import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import {
    type BillLineRecord, type BillListFilter, type BillRecord, PayablesRepository,
} from '../../application/ports/payables.repository';

const clone = <T>(v: T): T => structuredClone(v);
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Memory adapter (tests / trying without a database); mimics the partial unique keys (number, supplier invoice no,
 * pay period, subcontract claim — not voided).
 */
export class InMemoryPayablesRepository extends PayablesRepository {
    private readonly bills = new Map<string, BillRecord>();
    private readonly lines = new Map<string, BillLineRecord>();

    private live(): BillRecord[] {
        return [...this.bills.values()].filter(b => b.status !== 'voided');
    }

    private assertUnique(b: BillRecord): void {
        const others = [...this.bills.values()].filter(x => x.id !== b.id);
        const clash = (what: string): never => {
            throw new Error(`duplicate key value violates unique constraint "ap_bills_${what}_key"`);
        };
        if (b.number !== null && others.some(x => x.workspaceId === b.workspaceId && x.number === b.number)) clash('workspace_number');
        if (b.status === 'voided') return;
        const live = others.filter(x => x.status !== 'voided');
        if (b.supplierInvoiceNo !== '' && live.some(x => x.workspaceId === b.workspaceId && x.supplierId === b.supplierId
            && x.supplierInvoiceNo === b.supplierInvoiceNo)) clash('supplier_invoice');
        if (b.payPeriodId !== null && live.some(x => x.payPeriodId === b.payPeriodId)) clash('pay_period');
        if (b.scClaimId !== null && live.some(x => x.scClaimId === b.scClaimId)) clash('sc_claim');
    }

    lockWorkspace(): Promise<void> {
        return Promise.resolve();
    }

    find(billId: string): Promise<BillRecord | undefined> {
        const b = this.bills.get(billId);
        return Promise.resolve(b === undefined ? undefined : clone(b));
    }

    lock(workspaceId: WorkspaceId, billId: string): Promise<BillRecord | undefined> {
        const b = this.bills.get(billId);
        return Promise.resolve(b?.workspaceId === workspaceId ? clone(b) : undefined);
    }

    list(workspaceId: WorkspaceId, filter: BillListFilter): Promise<BillRecord[]> {
        const rows = [...this.bills.values()].filter(b => b.workspaceId === workspaceId
            && (filter.statuses === undefined || filter.statuses.includes(b.status))
            && (filter.kind === undefined || b.kind === filter.kind)
            && (filter.supplierId === undefined || b.supplierId === filter.supplierId)
            && (filter.projectId === undefined || b.projectId === filter.projectId)
            && (filter.dueTo === undefined || b.dueDate <= filter.dueTo));
        return Promise.resolve(rows
            .sort((a, b) => cmp(b.billDate, a.billDate) || b.createdAt.getTime() - a.createdAt.getTime() || cmp(b.id, a.id))
            .map(clone));
    }

    insert(bill: BillRecord, lines: readonly BillLineRecord[]): Promise<void> {
        if (this.bills.has(bill.id)) throw new Error('duplicate key value violates unique constraint "ap_bills_pkey"');
        this.assertUnique(bill);
        this.bills.set(bill.id, clone(bill));
        for (const l of lines) this.lines.set(l.id, clone(l));
        return Promise.resolve();
    }

    save(bill: BillRecord): Promise<void> {
        const old = this.bills.get(bill.id);
        if (old?.workspaceId !== bill.workspaceId) return Promise.resolve();
        this.assertUnique(bill);
        this.bills.set(bill.id, clone({ ...bill, createdAt: old.createdAt, createdBy: old.createdBy }));
        return Promise.resolve();
    }

    linesOf(workspaceId: WorkspaceId, billId: string): Promise<BillLineRecord[]> {
        return Promise.resolve([...this.lines.values()]
            .filter(l => l.workspaceId === workspaceId && l.billId === billId)
            .sort((a, b) => a.sort - b.sort || cmp(a.id, b.id))
            .map(clone));
    }

    replaceLines(workspaceId: WorkspaceId, billId: string, lines: readonly BillLineRecord[]): Promise<void> {
        for (const [id, l] of this.lines) if (l.workspaceId === workspaceId && l.billId === billId) this.lines.delete(id);
        for (const l of lines) this.lines.set(l.id, clone(l));
        return Promise.resolve();
    }

    saveLines(lines: readonly BillLineRecord[]): Promise<void> {
        for (const l of lines) {
            const old = this.lines.get(l.id);
            if (old?.workspaceId === l.workspaceId) this.lines.set(l.id, clone({ ...l, billId: old.billId }));
        }
        return Promise.resolve();
    }

    findByInvoiceNo(workspaceId: WorkspaceId, supplierId: string, invoiceNo: string, exceptId?: string): Promise<BillRecord | undefined> {
        const b = this.live().find(x => x.workspaceId === workspaceId && x.supplierId === supplierId && x.supplierInvoiceNo === invoiceNo
            && x.id !== exceptId);
        return Promise.resolve(b === undefined ? undefined : clone(b));
    }

    findByPayPeriod(workspaceId: WorkspaceId, periodId: string): Promise<BillRecord | undefined> {
        const b = this.live().find(x => x.workspaceId === workspaceId && x.payPeriodId === periodId);
        return Promise.resolve(b === undefined ? undefined : clone(b));
    }

    billedClaims(workspaceId: WorkspaceId, claimIds: readonly string[]): Promise<Set<string>> {
        const wanted = new Set(claimIds);
        return Promise.resolve(new Set(this.live()
            .flatMap(x => (x.workspaceId === workspaceId && x.scClaimId !== null && wanted.has(x.scClaimId) ? [x.scClaimId] : []))));
    }

    dueOn(date: string, statuses: readonly SupplierBillStatus[], limit: number): Promise<BillRecord[]> {
        return Promise.resolve([...this.bills.values()]
            .filter(b => b.dueDate === date && statuses.includes(b.status))
            .sort((a, b) => cmp(a.workspaceId, b.workspaceId) || cmp(a.id, b.id))
            .slice(0, limit)
            .map(clone));
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const [id, b] of this.bills) {
            if (b.workspaceId !== workspaceId || b.projectId !== projectId) continue;
            this.bills.delete(id);
            for (const [lineId, l] of this.lines) if (l.billId === id) this.lines.delete(lineId);
        }
        return Promise.resolve();
    }
}
