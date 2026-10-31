import { Injectable } from '@nestjs/common';
import { type Customer, type CustomerSnapshot, CustomerLookup } from '../../../../shared/application/ports';
import type { DocLanguage } from '@contrack/contract';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { isUuid } from '../../../../shared/domain/ids';
import { CustomerRepository } from '../../application/ports/customer.repository';
import { customerSnapshot } from '../../domain/customer';

/** `CustomerLookup` over the repository (for the document modules). */
@Injectable()
export class RepositoryCustomerLookup extends CustomerLookup {
    constructor(private readonly repo: CustomerRepository) {
        super();
    }

    async find(workspaceId: WorkspaceId, customerId: string): Promise<Customer | undefined> {
        if (!isUuid(customerId)) return undefined;
        const c = await this.repo.findById(customerId);
        return c?.workspaceId === workspaceId ? c : undefined;
    }

    findMany(workspaceId: WorkspaceId, customerIds: readonly string[]): Promise<Customer[]> {
        return this.repo.findMany(workspaceId, customerIds.filter(isUuid));
    }

    async snapshot(workspaceId: WorkspaceId, customerId: string, language: DocLanguage): Promise<CustomerSnapshot | undefined> {
        const c = await this.find(workspaceId, customerId);
        return c === undefined ? undefined : customerSnapshot(c, language);
    }
}
