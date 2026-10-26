import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../../shared/domain/result';
import type { VendorListEntryId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { ScAccess } from '../../../shared/sc-access';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { InvitationRepository, VendorListRepository } from '../ports/sourcing.repositories';

/** `sc.vendors.manage`. An entry that was ever invited stays (conflict: hide it instead). */
@Injectable()
export class DeleteVendorListEntryUseCase {
    constructor(
        private readonly access: ScAccess,
        private readonly entries: VendorListRepository,
        private readonly invitations: InvitationRepository,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorId: UserId; entryId: VendorListEntryId }): Promise<Result<undefined, DomainError>> {
        const entry = await this.entries.findById(input.entryId);
        if (entry === undefined) return err(SourcingErrors.entryNotFound());
        const role = await this.access.buyer(input.actorId, entry.buyerWorkspaceId, ['sc.vendors.manage'], 'Vendor-list entry');
        if (!role.ok) return role;
        return this.uow.run(async () => {
            if ((await this.invitations.listByEntries([entry.id])).length > 0) return err(SourcingErrors.entryInUse());
            await this.entries.delete(entry.buyerWorkspaceId, entry.id);
            await this.activity.record({
                buyerWorkspaceId: entry.buyerWorkspaceId, vendorWorkspaceId: entry.vendorWorkspaceId, entity: 'vendor', entityId: entry.id,
                action: 'vendor_list.deleted', actorUserId: input.actorId, at: this.clock.now(),
            });
            return okVoid();
        });
    }
}
