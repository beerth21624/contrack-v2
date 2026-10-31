import { Injectable } from '@nestjs/common';
import type {
    CreateSupplierRequest, ImportScSuppliersDto, PatchSupplierRequest, SupplierDto, SupplierListQuery,
} from '@contrack/contract';
import { ModuleAccess } from '../../../../shared/application/module-access';
import { AuditLog, Clock, IdGenerator, ScVendorDirectory, type Supplier, UnitOfWork } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { localThaiPhone, supplierWhtRate } from '../../domain/supplier';
import { SupplierRepository } from '../ports/supplier.repository';

export const toSupplierDto = (s: Supplier): SupplierDto => ({
    id: s.id,
    workspaceId: s.workspaceId,
    kind: s.kind,
    nameTh: s.nameTh,
    nameEn: s.nameEn,
    taxId: s.taxId,
    branchCode: s.branchCode,
    isJuristic: s.isJuristic,
    vatRegistered: s.vatRegistered,
    addressTh: s.addressTh,
    addressEn: s.addressEn,
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    lineId: s.lineId,
    creditTermDays: s.creditTermDays,
    defaultWhtPreset: s.defaultWhtPreset,
    whtRate: supplierWhtRate(s),
    bankAccounts: s.bankAccounts,
    trades: s.trades,
    scVendorListEntryId: s.scVendorListEntryId,
    vendorWorkspaceId: s.vendorWorkspaceId,
    rating: s.rating,
    ratingCount: s.ratingCount,
    note: s.note,
    archivedAt: s.archivedAt === null ? null : s.archivedAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
});

const duplicate = (): DomainError =>
    DomainError.conflict('Another active supplier has this tax id and branch', { reason: 'duplicate_supplier' });

export const supplierArchived = (): DomainError =>
    DomainError.conflict('The supplier is archived; restore it to edit', { reason: 'supplier_archived' });

/** Field names whose value changed (contact values stay out of the audit trail). */
function changedFields(before: Supplier, after: Supplier): string[] {
    const keys = ['kind', 'nameTh', 'nameEn', 'taxId', 'branchCode', 'isJuristic', 'vatRegistered', 'addressTh', 'addressEn', 'contactName',
        'phone', 'email', 'lineId', 'creditTermDays', 'defaultWhtPreset', 'note'] as const;
    const out: string[] = keys.filter(k => before[k] !== after[k]);
    if (JSON.stringify(before.bankAccounts) !== JSON.stringify(after.bankAccounts)) out.push('bankAccounts');
    if (JSON.stringify(before.trades) !== JSON.stringify(after.trades)) out.push('trades');
    return out;
}

/** Loads a supplier by id and authorizes the caller on its workspace (a stranger or unknown id → not_found). */
@Injectable()
export class SupplierAccess {
    constructor(private readonly access: ModuleAccess, private readonly repo: SupplierRepository) {}

    async load(userId: UserId, supplierId: string, ...permissions: ('suppliers.read' | 'suppliers.manage')[]): Promise<Result<Supplier, DomainError>> {
        if (!isUuid(supplierId)) return err(DomainError.notFound('Supplier'));
        const supplier = await this.repo.findById(supplierId.toLowerCase());
        if (supplier === undefined) return err(DomainError.notFound('Supplier'));
        const grant = await this.access.inWorkspace(userId, supplier.workspaceId, 'procurement', ...permissions);
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('Supplier')) : grant;
        return ok(supplier);
    }
}

/** GET /workspaces/:workspaceId/suppliers?q=&kind=&trade=&archived= — `suppliers.read`. */
@Injectable()
export class ListSuppliersUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: SupplierRepository) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: SupplierListQuery): Promise<Result<SupplierDto[], DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, 'procurement', 'suppliers.read');
        if (!grant.ok) return grant;
        const rows = await this.repo.list(workspaceId, { q: query.q, kind: query.kind, trade: query.trade, archived: query.archived, limit: query.limit });
        return ok(rows.map(toSupplierDto));
    }
}

/** GET /suppliers/:supplierId — `suppliers.read`. */
@Injectable()
export class GetSupplierUseCase {
    constructor(private readonly suppliers: SupplierAccess) {}

    async execute(userId: UserId, supplierId: string): Promise<Result<SupplierDto, DomainError>> {
        const loaded = await this.suppliers.load(userId, supplierId, 'suppliers.read');
        return loaded.ok ? ok(toSupplierDto(loaded.value)) : loaded;
    }
}

/** POST /workspaces/:workspaceId/suppliers — `suppliers.manage`; same tax id + branch as an active supplier → 409 `duplicate_supplier`. */
@Injectable()
export class CreateSupplierUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: SupplierRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; workspaceId: WorkspaceId; body: CreateSupplierRequest }): Promise<Result<SupplierDto, DomainError>> {
        const grant = await this.access.inWorkspace(input.userId, input.workspaceId, 'procurement', 'suppliers.manage');
        if (!grant.ok) return grant;
        const now = this.clock.now();
        const supplier: Supplier = {
            ...input.body, trades: [...new Set(input.body.trades)], id: this.ids.newId(), workspaceId: input.workspaceId,
            scVendorListEntryId: null, vendorWorkspaceId: null, rating: null, ratingCount: 0,
            archivedAt: null, createdBy: input.userId, createdAt: now, updatedAt: now,
        };
        return this.uow.run(async () => {
            if (supplier.taxId !== '' && (await this.repo.findActiveByTax(input.workspaceId, supplier.taxId, supplier.branchCode)) !== undefined) {
                return err(duplicate());
            }
            await this.repo.save(supplier);
            await this.audit.record({
                workspaceId: input.workspaceId, projectId: null, actor: input.userId,
                entityType: 'supplier', entityId: supplier.id, action: 'create_supplier', data: { kind: supplier.kind },
            });
            return ok(toSupplierDto(supplier));
        });
    }
}

/** PATCH /suppliers/:supplierId — `suppliers.manage`; an archived supplier is read-only (409 `supplier_archived`). */
@Injectable()
export class PatchSupplierUseCase {
    constructor(
        private readonly suppliers: SupplierAccess,
        private readonly repo: SupplierRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; supplierId: string; body: PatchSupplierRequest }): Promise<Result<SupplierDto, DomainError>> {
        const loaded = await this.suppliers.load(input.userId, input.supplierId, 'suppliers.manage');
        if (!loaded.ok) return loaded;
        const before = loaded.value;
        if (before.archivedAt !== null) return err(supplierArchived());
        const after: Supplier = {
            ...before, ...input.body, trades: [...new Set(input.body.trades ?? before.trades)], updatedAt: this.clock.now(),
        };
        if (after.nameTh === '' && after.nameEn === '') return err(DomainError.validation('A Thai or English name is required'));
        return this.uow.run(async () => {
            if (after.taxId !== '' && (await this.repo.findActiveByTax(after.workspaceId, after.taxId, after.branchCode, after.id)) !== undefined) {
                return err(duplicate());
            }
            await this.repo.save(after);
            await this.audit.record({
                workspaceId: after.workspaceId, projectId: null, actor: input.userId,
                entityType: 'supplier', entityId: after.id, action: 'update_supplier', data: { changed: changedFields(before, after) },
            });
            return ok(toSupplierDto(after));
        });
    }
}

/** POST /suppliers/:supplierId/archive|restore — `suppliers.manage`; restoring onto a taken tax id + branch → 409 `duplicate_supplier`. */
@Injectable()
export class SetSupplierArchivedUseCase {
    constructor(
        private readonly suppliers: SupplierAccess,
        private readonly repo: SupplierRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; supplierId: string; archived: boolean }): Promise<Result<SupplierDto, DomainError>> {
        const loaded = await this.suppliers.load(input.userId, input.supplierId, 'suppliers.manage');
        if (!loaded.ok) return loaded;
        const before = loaded.value;
        if ((before.archivedAt !== null) === input.archived) return ok(toSupplierDto(before));
        const now = this.clock.now();
        const after: Supplier = { ...before, archivedAt: input.archived ? now : null, updatedAt: now };
        return this.uow.run(async () => {
            if (!input.archived && after.taxId !== ''
                && (await this.repo.findActiveByTax(after.workspaceId, after.taxId, after.branchCode, after.id)) !== undefined) {
                return err(duplicate());
            }
            await this.repo.save(after);
            await this.audit.record({
                workspaceId: after.workspaceId, projectId: null, actor: input.userId,
                entityType: 'supplier', entityId: after.id, action: input.archived ? 'archive' : 'restore', data: {},
            });
            return ok(toSupplierDto(after));
        });
    }
}

/**
 * POST /workspaces/:workspaceId/suppliers/import-sc — `suppliers.manage`. One `subcontractor` supplier per visible entry of
 * the subcontracting vendor list not linked yet (`sc_vendor_list_entry_id`, archived suppliers count as linked), so a
 * second run creates nothing. Subcontracting not active → `ScVendorDirectory` lists nothing → 0 created.
 */
@Injectable()
export class ImportScSuppliersUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: SupplierRepository,
        private readonly directory: ScVendorDirectory,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; workspaceId: WorkspaceId }): Promise<Result<ImportScSuppliersDto, DomainError>> {
        const grant = await this.access.inWorkspace(input.userId, input.workspaceId, 'procurement', 'suppliers.manage');
        if (!grant.ok) return grant;
        const entries = await this.directory.listEntries(input.workspaceId);
        if (entries.length === 0) return ok({ created: 0, skipped: 0, suppliers: [] });
        return this.uow.run(async () => {
            const linked = await this.repo.linkedScEntryIds(input.workspaceId);
            const now = this.clock.now();
            const made: Supplier[] = [];
            for (const e of entries) {
                if (linked.has(e.id)) continue;
                const supplier: Supplier = {
                    id: this.ids.newId(), workspaceId: input.workspaceId, kind: 'subcontractor',
                    nameTh: e.displayName.slice(0, 200), nameEn: '', taxId: '', branchCode: '',
                    // A crew of the vendor list is usually a person without a VAT registration.
                    isJuristic: false, vatRegistered: false,
                    addressTh: e.province.slice(0, 500), addressEn: '', contactName: '', phone: localThaiPhone(e.phone).slice(0, 40), email: '',
                    lineId: e.lineId.slice(0, 80), creditTermDays: 30, defaultWhtPreset: 'service', bankAccounts: [], trades: [...new Set(e.trades)],
                    scVendorListEntryId: e.id, vendorWorkspaceId: e.vendorWorkspaceId, rating: null, ratingCount: 0,
                    note: e.privateNote.slice(0, 2000), archivedAt: null, createdBy: input.userId, createdAt: now, updatedAt: now,
                };
                if (supplier.nameTh === '') continue;
                await this.repo.save(supplier);
                await this.audit.record({
                    workspaceId: input.workspaceId, projectId: null, actor: input.userId,
                    entityType: 'supplier', entityId: supplier.id, action: 'import_sc', data: { scVendorListEntryId: e.id },
                });
                linked.add(e.id);
                made.push(supplier);
            }
            return ok({ created: made.length, skipped: entries.length - made.length, suppliers: made.map(toSupplierDto) });
        });
    }
}
