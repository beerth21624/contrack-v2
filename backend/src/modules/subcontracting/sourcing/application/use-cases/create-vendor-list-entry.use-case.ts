import { Injectable } from '@nestjs/common';
import type { CreateVendorListEntryRequest, VendorListEntryDto } from '@contrack/contract';
import { Clock, IdGenerator, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import { asVendorListEntryId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { ScAccess } from '../../../shared/sc-access';
import { VendorListEntry } from '../../domain/entities/vendor-list-entry.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { Phone } from '../../domain/value-objects/phone.value-object';
import { VendorListRepository } from '../ports/sourcing.repositories';
import { SourcingViews } from '../services/sourcing-views.service';
import { VendorLinker } from '../services/vendor-linker.service';

export interface CreateVendorListEntryInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    body: CreateVendorListEntryRequest;
}

/**
 * `sc.vendors.manage`. Same phone already in the list → conflict. A crew that already signed up with this phone is
 * linked right away.
 */
@Injectable()
export class CreateVendorListEntryUseCase {
    constructor(
        private readonly access: ScAccess,
        private readonly entries: VendorListRepository,
        private readonly linker: VendorLinker,
        private readonly views: SourcingViews,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: CreateVendorListEntryInput): Promise<Result<VendorListEntryDto, DomainError>> {
        const role = await this.access.buyer(input.actorId, input.workspaceId, ['sc.vendors.manage']);
        if (!role.ok) return role;
        const phone = Phone.create(input.body.phone);
        if (!phone.ok) return phone;
        const created = await this.uow.run(async (): Promise<Result<VendorListEntry, DomainError>> => {
            if (await this.entries.findByPhone(input.workspaceId, phone.value.value) !== undefined) return err(SourcingErrors.duplicatePhone());
            const now = this.clock.now();
            const entry = VendorListEntry.create({
                id: asVendorListEntryId(this.ids.newId()), buyerWorkspaceId: input.workspaceId,
                vendorWorkspaceId: await this.linker.vendorOfPhone(phone.value.value), displayName: input.body.displayName,
                phone: phone.value, lineId: input.body.lineId, trades: input.body.trades, province: input.body.province,
                privateNote: input.body.privateNote, createdBy: input.actorId, now,
            });
            await this.entries.insert(entry);
            await this.activity.record({
                buyerWorkspaceId: input.workspaceId, vendorWorkspaceId: entry.vendorWorkspaceId, entity: 'vendor', entityId: entry.id,
                action: 'vendor_list.created', actorUserId: input.actorId, at: now,
            });
            return ok(entry);
        });
        if (!created.ok) return created;
        const [dto] = await this.views.vendorListEntries(input.workspaceId, [created.value]);
        if (dto === undefined) throw new Error('vendor-list entry vanished');
        return ok(dto);
    }
}
