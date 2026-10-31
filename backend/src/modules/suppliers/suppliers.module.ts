// ─── Supplier register (module `procurement`, WP-37, docs/erp/02-domain-model.md §7.1) ───
// Provides SupplierLookup (src/shared/application/ports.ts) to procurement / payables. Routes gated by `procurement`.
// Needs ModuleAccess (platform), AuditLog (audit), ScVendorDirectory (subcontracting). Registers the supplier SearchSources entry.
// Price history is not here: procurement owns pc_order_lines (WP-39).
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { SearchSources, SupplierLookup } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { SupplierRepository } from './application/ports/supplier.repository';
import { ListSupplierRatingsUseCase, RateSupplierUseCase } from './application/use-cases/supplier-ratings.use-cases';
import {
    CreateSupplierUseCase, GetSupplierUseCase, ImportScSuppliersUseCase, ListSuppliersUseCase, PatchSupplierUseCase, SetSupplierArchivedUseCase,
    SupplierAccess,
} from './application/use-cases/suppliers.use-cases';
import { DrizzleSupplierRepository } from './infrastructure/adapters/drizzle-supplier.repository';
import { InMemorySupplierRepository } from './infrastructure/adapters/in-memory-supplier.repository';
import { RepositorySupplierLookup } from './infrastructure/adapters/supplier-lookup.adapter';
import { SuppliersController } from './presentation/suppliers.controller';

@Global()
@Module({
    controllers: [SuppliersController],
    providers: [
        persistence(SupplierRepository, () => new InMemorySupplierRepository(), ctx => new DrizzleSupplierRepository(ctx)),
        RepositorySupplierLookup,
        { provide: SupplierLookup, useExisting: RepositorySupplierLookup },
        SupplierAccess,
        ListSuppliersUseCase,
        GetSupplierUseCase,
        CreateSupplierUseCase,
        PatchSupplierUseCase,
        SetSupplierArchivedUseCase,
        ImportScSuppliersUseCase,
        RateSupplierUseCase,
        ListSupplierRatingsUseCase,
    ],
    exports: [SupplierLookup],
})
export class SuppliersModule implements OnModuleInit {
    constructor(private readonly search: SearchSources, private readonly repo: SupplierRepository) {}

    onModuleInit(): void {
        this.search.register('procurement', 'suppliers.read', async ctx => {
            const found = await this.repo.list(ctx.workspaceId, { q: ctx.q, archived: false, limit: ctx.limit });
            return found.map(s => ({
                type: 'supplier' as const,
                id: s.id,
                title: s.nameTh !== '' ? s.nameTh : s.nameEn,
                subtitle: [s.nameTh !== '' ? s.nameEn : '', s.taxId, s.phone].filter(v => v !== '').join(' · '),
                href: `/suppliers/${s.id}`,
                docType: null,
            }));
        });
    }
}
