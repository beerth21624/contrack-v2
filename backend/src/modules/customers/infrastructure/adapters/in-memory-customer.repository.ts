import type { Customer } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { CustomerRepository, type CustomerListFilter } from '../../application/ports/customer.repository';
import { matchesCustomerQuery } from '../../domain/customer';

/** Memory adapter (tests / trying without a database); stores copies. */
export class InMemoryCustomerRepository extends CustomerRepository {
    private readonly rows = new Map<string, Customer>();

    findById(customerId: string): Promise<Customer | undefined> {
        const row = this.rows.get(customerId);
        return Promise.resolve(row === undefined ? undefined : structuredClone(row));
    }

    findMany(workspaceId: WorkspaceId, ids: readonly string[]): Promise<Customer[]> {
        const out: Customer[] = [];
        for (const id of ids) {
            const row = this.rows.get(id);
            if (row?.workspaceId === workspaceId) out.push(structuredClone(row));
        }
        return Promise.resolve(out);
    }

    list(workspaceId: WorkspaceId, f: CustomerListFilter): Promise<Customer[]> {
        const rows = [...this.rows.values()]
            .filter(c => c.workspaceId === workspaceId && (c.archivedAt !== null) === f.archived)
            .filter(c => f.kind === undefined || c.kind === f.kind)
            .filter(c => f.q === undefined || f.q === '' || matchesCustomerQuery(c, f.q))
            .sort((a, b) => (a.nameTh || a.nameEn).localeCompare(b.nameTh || b.nameEn, 'th'))
            .slice(0, f.limit);
        return Promise.resolve(structuredClone(rows));
    }

    findActiveByTax(workspaceId: WorkspaceId, taxId: string, branchCode: string, exceptId?: string): Promise<Customer | undefined> {
        const hit = [...this.rows.values()].find(c => c.workspaceId === workspaceId && c.archivedAt === null && c.taxId === taxId
            && c.branchCode === branchCode && c.id !== exceptId);
        return Promise.resolve(hit === undefined ? undefined : structuredClone(hit));
    }

    save(customer: Customer): Promise<void> {
        this.rows.set(customer.id, structuredClone(customer));
        return Promise.resolve();
    }
}
