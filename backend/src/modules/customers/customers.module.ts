// ─── Customer register (ERP foundation, docs/erp/02-domain-model.md §1.7) ───
// Provides CustomerLookup (src/shared/application/ports.ts) to the document modules. Routes gated by `project-hub`.
// Needs ModuleAccess (platform), AuditLog (audit). Registers the SearchSources entry for customers (WP-35).
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { CustomerLookup, SearchSources } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { CustomerRepository } from './application/ports/customer.repository';
import {
    CreateCustomerUseCase, CustomerAccess, GetCustomerUseCase, ListCustomersUseCase, PatchCustomerUseCase, SetCustomerArchivedUseCase,
} from './application/use-cases/customers.use-cases';
import { RepositoryCustomerLookup } from './infrastructure/adapters/customer-lookup.adapter';
import { DrizzleCustomerRepository } from './infrastructure/adapters/drizzle-customer.repository';
import { InMemoryCustomerRepository } from './infrastructure/adapters/in-memory-customer.repository';
import { CustomersController } from './presentation/customers.controller';

@Global()
@Module({
    controllers: [CustomersController],
    providers: [
        persistence(CustomerRepository, () => new InMemoryCustomerRepository(), ctx => new DrizzleCustomerRepository(ctx)),
        RepositoryCustomerLookup,
        { provide: CustomerLookup, useExisting: RepositoryCustomerLookup },
        CustomerAccess,
        ListCustomersUseCase,
        GetCustomerUseCase,
        CreateCustomerUseCase,
        PatchCustomerUseCase,
        SetCustomerArchivedUseCase,
    ],
    exports: [CustomerLookup],
})
export class CustomersModule implements OnModuleInit {
    constructor(private readonly search: SearchSources, private readonly repo: CustomerRepository) {}

    onModuleInit(): void {
        this.search.register('project-hub', 'customers.read', async ctx => {
            const found = await this.repo.list(ctx.workspaceId, { q: ctx.q, archived: false, limit: ctx.limit });
            return found.map(c => ({
                type: 'customer' as const,
                id: c.id,
                title: c.nameTh !== '' ? c.nameTh : c.nameEn,
                subtitle: [c.nameTh !== '' ? c.nameEn : '', c.taxId, c.phone].filter(s => s !== '').join(' · '),
                href: `/customers/${c.id}`,
                docType: null,
            }));
        });
    }
}
