import { Injectable } from '@nestjs/common';
import type { DocLanguage, SupplierSnapshot } from '@contrack/contract';
import { type Supplier, SupplierLookup } from '../../../../shared/application/ports';
import { type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import { SupplierRepository } from '../../application/ports/supplier.repository';
import { supplierSnapshot } from '../../domain/supplier';

/** `SupplierLookup` over the repository (for procurement / payables). */
@Injectable()
export class RepositorySupplierLookup extends SupplierLookup {
    constructor(private readonly repo: SupplierRepository) {
        super();
    }

    async find(workspaceId: WorkspaceId, supplierId: string): Promise<Supplier | undefined> {
        if (!isUuid(supplierId)) return undefined;
        const s = await this.repo.findById(supplierId.toLowerCase());
        return s?.workspaceId === workspaceId ? s : undefined;
    }

    findMany(workspaceId: WorkspaceId, supplierIds: readonly string[]): Promise<Supplier[]> {
        return this.repo.findMany(workspaceId, supplierIds.filter(isUuid).map(id => id.toLowerCase()));
    }

    async locate(supplierId: string): Promise<WorkspaceId | undefined> {
        if (!isUuid(supplierId)) return undefined;
        return (await this.repo.findById(supplierId.toLowerCase()))?.workspaceId;
    }

    async snapshot(workspaceId: WorkspaceId, supplierId: string, language: DocLanguage): Promise<SupplierSnapshot | undefined> {
        const s = await this.find(workspaceId, supplierId);
        return s === undefined ? undefined : supplierSnapshot(s, language);
    }
}
