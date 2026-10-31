import type { Customer } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';

export interface CustomerListFilter {
    q?: string;
    kind?: Customer['kind'];
    archived: boolean;
    limit: number;
}

/** The customer register. Every method filters by `workspaceId` except `findById` (the route carries only the id). */
export abstract class CustomerRepository {
    abstract findById(customerId: string): Promise<Customer | undefined>;
    abstract findMany(workspaceId: WorkspaceId, customerIds: readonly string[]): Promise<Customer[]>;
    /** Newest name first by Thai/English name; `q` matches names, tax id, contact, phone and email (case-insensitive). */
    abstract list(workspaceId: WorkspaceId, filter: CustomerListFilter): Promise<Customer[]>;
    /** The active customer with this tax id + branch (not `exceptId`). */
    abstract findActiveByTax(workspaceId: WorkspaceId, taxId: string, branchCode: string, exceptId?: string): Promise<Customer | undefined>;
    abstract save(customer: Customer): Promise<void>;
}
