import { Injectable } from '@nestjs/common';
import type { UpdateVendorListEntryRequest, VendorListEntryDto } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import type { VendorListEntryId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { ScAccess } from '../../../shared/sc-access';
import type { VendorListEntry } from '../../domain/entities/vendor-list-entry.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { Phone } from '../../domain/value-objects/phone.value-object';
import { VendorListRepository } from '../ports/sourcing.repositories';
import { SourcingViews } from '../services/sourcing-views.service';

export interface UpdateVendorListEntryInput {
    actorId: UserId;
    entryId: VendorListEntryId;
    body: UpdateVendorListEntryRequest;
}

/** `sc.vendors.manage`. A phone that another entry of the list has → conflict. `hidden` hides / shows the entry. */
@Injectable()
export class UpdateVendorListEntryUseCase {
    constructor(
        private readonly access: ScAccess,
        private readonly entries: VendorListRepository,
        private readonly views: SourcingViews,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: UpdateVendorListEntryInput): Promise<Result<VendorListEntryDto, DomainError>> {
        const entry = await this.entries.findById(input.entryId);
        if (entry === undefined) return err(SourcingErrors.entryNotFound());
        const role = await this.access.buyer(input.actorId, entry.buyerWorkspaceId, ['sc.vendors.manage'], 'Vendor-list entry');
        if (!role.ok) return role;
        const { phone: rawPhone, ...rest } = input.body;
        let phone: Phone | undefined;
        if (rawPhone !== undefined) {
            const parsed = Phone.create(rawPhone);
            if (!parsed.ok) return parsed;
            phone = parsed.value;
        }
        const saved = await this.uow.run(async (): Promise<Result<VendorListEntry, DomainError>> => {
            if (phone !== undefined && phone.value !== entry.phone) {
                const other = await this.entries.findByPhone(entry.buyerWorkspaceId, phone.value);
                if (other !== undefined && other.id !== entry.id) return err(SourcingErrors.duplicatePhone());
            }
            const now = this.clock.now();
            entry.update({ ...rest, ...(phone === undefined ? {} : { phone }) }, now);
            await this.entries.update(entry);
            await this.activity.record({
                buyerWorkspaceId: entry.buyerWorkspaceId, vendorWorkspaceId: entry.vendorWorkspaceId, entity: 'vendor', entityId: entry.id,
                action: 'vendor_list.updated', actorUserId: input.actorId, data: { fields: Object.keys(input.body) }, at: now,
            });
            return ok(entry);
        });
        if (!saved.ok) return saved;
        const [dto] = await this.views.vendorListEntries(entry.buyerWorkspaceId, [saved.value]);
        if (dto === undefined) throw new Error('vendor-list entry vanished');
        return ok(dto);
    }
}
