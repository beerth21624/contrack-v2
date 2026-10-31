import { Injectable } from '@nestjs/common';
import type { CreateCustomerRequest, CustomerDto, CustomerListQuery, PatchCustomerRequest } from '@contrack/contract';
import { ModuleAccess } from '../../../../shared/application/module-access';
import { AuditLog, Clock, type Customer, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { effectiveWhtRate } from '../../domain/customer';
import { CustomerRepository } from '../ports/customer.repository';

export const toCustomerDto = (c: Customer): CustomerDto => ({
    id: c.id,
    workspaceId: c.workspaceId,
    kind: c.kind,
    nameTh: c.nameTh,
    nameEn: c.nameEn,
    taxId: c.taxId,
    branchCode: c.branchCode,
    addressTh: c.addressTh,
    addressEn: c.addressEn,
    contactName: c.contactName,
    phone: c.phone,
    email: c.email,
    lineId: c.lineId,
    defaultWhtRate: c.defaultWhtRate,
    effectiveWhtRate: effectiveWhtRate(c),
    defaultDocLanguage: c.defaultDocLanguage,
    paymentTermDays: c.paymentTermDays,
    note: c.note,
    archivedAt: c.archivedAt === null ? null : c.archivedAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
});

const duplicate = (): DomainError =>
    DomainError.conflict('Another active customer has this tax id and branch', { reason: 'duplicate_customer' });

/** Field names whose value changed (values themselves stay out of the audit trail's `changed` list for contact data). */
function changedFields(before: Customer, after: Customer): string[] {
    const keys = ['kind', 'nameTh', 'nameEn', 'taxId', 'branchCode', 'addressTh', 'addressEn', 'contactName', 'phone', 'email', 'lineId',
        'defaultWhtRate', 'defaultDocLanguage', 'paymentTermDays', 'note'] as const;
    return keys.filter(k => before[k] !== after[k]);
}

/** Loads a customer by id and authorizes the caller on its workspace (a stranger or unknown id → not_found). */
@Injectable()
export class CustomerAccess {
    constructor(private readonly access: ModuleAccess, private readonly repo: CustomerRepository) {}

    async load(userId: UserId, customerId: string, ...permissions: ('customers.read' | 'customers.manage')[]): Promise<Result<Customer, DomainError>> {
        if (!isUuid(customerId)) return err(DomainError.notFound('Customer'));
        const customer = await this.repo.findById(customerId.toLowerCase());
        if (customer === undefined) return err(DomainError.notFound('Customer'));
        const grant = await this.access.inWorkspace(userId, customer.workspaceId, 'project-hub', ...permissions);
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('Customer')) : grant;
        return ok(customer);
    }
}

/** GET /workspaces/:workspaceId/customers?q=&kind=&archived= — `customers.read`. */
@Injectable()
export class ListCustomersUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: CustomerRepository) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: CustomerListQuery): Promise<Result<CustomerDto[], DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, 'project-hub', 'customers.read');
        if (!grant.ok) return grant;
        const rows = await this.repo.list(workspaceId, { q: query.q, kind: query.kind, archived: query.archived, limit: query.limit });
        return ok(rows.map(toCustomerDto));
    }
}

/** GET /customers/:customerId — `customers.read`. */
@Injectable()
export class GetCustomerUseCase {
    constructor(private readonly customers: CustomerAccess) {}

    async execute(userId: UserId, customerId: string): Promise<Result<CustomerDto, DomainError>> {
        const loaded = await this.customers.load(userId, customerId, 'customers.read');
        return loaded.ok ? ok(toCustomerDto(loaded.value)) : loaded;
    }
}

/** POST /workspaces/:workspaceId/customers — `customers.manage`; same tax id + branch as an active customer → 409 `duplicate_customer`. */
@Injectable()
export class CreateCustomerUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: CustomerRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; workspaceId: WorkspaceId; body: CreateCustomerRequest }): Promise<Result<CustomerDto, DomainError>> {
        const grant = await this.access.inWorkspace(input.userId, input.workspaceId, 'project-hub', 'customers.manage');
        if (!grant.ok) return grant;
        const now = this.clock.now();
        const customer: Customer = {
            ...input.body, id: this.ids.newId(), workspaceId: input.workspaceId, archivedAt: null, createdBy: input.userId, createdAt: now, updatedAt: now,
        };
        return this.uow.run(async () => {
            if (customer.taxId !== '' && (await this.repo.findActiveByTax(input.workspaceId, customer.taxId, customer.branchCode)) !== undefined) {
                return err(duplicate());
            }
            await this.repo.save(customer);
            await this.audit.record({
                workspaceId: input.workspaceId, projectId: null, actor: input.userId,
                entityType: 'customer', entityId: customer.id, action: 'create', data: { kind: customer.kind },
            });
            return ok(toCustomerDto(customer));
        });
    }
}

/** PATCH /customers/:customerId — `customers.manage`; an archived customer is read-only (409 `customer_archived`). */
@Injectable()
export class PatchCustomerUseCase {
    constructor(
        private readonly customers: CustomerAccess,
        private readonly repo: CustomerRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; customerId: string; body: PatchCustomerRequest }): Promise<Result<CustomerDto, DomainError>> {
        const loaded = await this.customers.load(input.userId, input.customerId, 'customers.manage');
        if (!loaded.ok) return loaded;
        const before = loaded.value;
        if (before.archivedAt !== null) return err(DomainError.conflict('The customer is archived; restore it to edit', { reason: 'customer_archived' }));
        const after: Customer = { ...before, ...input.body, updatedAt: this.clock.now() };
        if (after.nameTh === '' && after.nameEn === '') return err(DomainError.validation('A Thai or English name is required'));
        return this.uow.run(async () => {
            if (after.taxId !== '' && (await this.repo.findActiveByTax(after.workspaceId, after.taxId, after.branchCode, after.id)) !== undefined) {
                return err(duplicate());
            }
            await this.repo.save(after);
            await this.audit.record({
                workspaceId: after.workspaceId, projectId: null, actor: input.userId,
                entityType: 'customer', entityId: after.id, action: 'update', data: { changed: changedFields(before, after) },
            });
            return ok(toCustomerDto(after));
        });
    }
}

/** POST /customers/:customerId/archive|restore — `customers.manage`; restoring onto a taken tax id + branch → 409 `duplicate_customer`. */
@Injectable()
export class SetCustomerArchivedUseCase {
    constructor(
        private readonly customers: CustomerAccess,
        private readonly repo: CustomerRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; customerId: string; archived: boolean }): Promise<Result<CustomerDto, DomainError>> {
        const loaded = await this.customers.load(input.userId, input.customerId, 'customers.manage');
        if (!loaded.ok) return loaded;
        const before = loaded.value;
        if ((before.archivedAt !== null) === input.archived) return ok(toCustomerDto(before));
        const now = this.clock.now();
        const after: Customer = { ...before, archivedAt: input.archived ? now : null, updatedAt: now };
        return this.uow.run(async () => {
            if (!input.archived && after.taxId !== ''
                && (await this.repo.findActiveByTax(after.workspaceId, after.taxId, after.branchCode, after.id)) !== undefined) {
                return err(duplicate());
            }
            await this.repo.save(after);
            await this.audit.record({
                workspaceId: after.workspaceId, projectId: null, actor: input.userId,
                entityType: 'customer', entityId: after.id, action: input.archived ? 'archive' : 'restore', data: {},
            });
            return ok(toCustomerDto(after));
        });
    }
}
