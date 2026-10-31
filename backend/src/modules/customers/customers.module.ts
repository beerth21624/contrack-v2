// ─── Customer register (ERP foundation, docs/erp/02-domain-model.md §1.7) ───
// Provides CustomerLookup (src/shared/application/ports.ts) to the document modules. Routes gated by `project-hub`.
// Needs ModuleAccess (platform), AuditLog (audit).
import { Global, Module } from '@nestjs/common';
import { CustomerLookup } from '../../shared/application/ports';
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
export class CustomersModule {}
