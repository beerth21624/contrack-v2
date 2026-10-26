import { Injectable } from '@nestjs/common';
import type { ImportVendorListRequest, ImportVendorListResponse } from '@contrack/contract';
import { Clock, IdGenerator, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, ok } from '../../../../../shared/domain/result';
import { asVendorListEntryId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { ScAccess } from '../../../shared/sc-access';
import { VendorListEntry } from '../../domain/entities/vendor-list-entry.entity';
import { Phone } from '../../domain/value-objects/phone.value-object';
import { VendorListRepository } from '../ports/sourcing.repositories';
import { VendorLinker } from '../services/vendor-linker.service';

export interface ImportVendorListInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    body: ImportVendorListRequest;
}

/**
 * `sc.vendors.manage`. Rows with a bad phone are reported as invalid, rows whose phone is already in the list (or
 * earlier in the same import) as duplicates; the rest are created in one transaction.
 */
@Injectable()
export class ImportVendorListUseCase {
    constructor(
        private readonly access: ScAccess,
        private readonly entries: VendorListRepository,
        private readonly linker: VendorLinker,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: ImportVendorListInput): Promise<Result<ImportVendorListResponse, DomainError>> {
        const role = await this.access.buyer(input.actorId, input.workspaceId, ['sc.vendors.manage']);
        if (!role.ok) return role;
        return ok(await this.uow.run(async () => {
            const now = this.clock.now();
            const known = new Set((await this.entries.list(input.workspaceId)).map(e => e.phone));
            const res: ImportVendorListResponse = { created: 0, duplicates: [], invalid: [] };
            for (const [row, r] of input.body.rows.entries()) {
                const phone = Phone.create(r.phone);
                if (!phone.ok) {
                    res.invalid.push({ row, reason: 'เบอร์โทรไม่ถูกต้อง' });
                    continue;
                }
                if (known.has(phone.value.value)) {
                    res.duplicates.push(row);
                    continue;
                }
                known.add(phone.value.value);
                const entry = VendorListEntry.create({
                    id: asVendorListEntryId(this.ids.newId()), buyerWorkspaceId: input.workspaceId,
                    vendorWorkspaceId: await this.linker.vendorOfPhone(phone.value.value), displayName: r.displayName,
                    phone: phone.value, lineId: r.lineId, trades: r.trades, province: r.province, privateNote: '',
                    createdBy: input.actorId, now,
                });
                await this.entries.insert(entry);
                res.created += 1;
            }
            if (res.created > 0) {
                await this.activity.record({
                    buyerWorkspaceId: input.workspaceId, entity: 'vendor', entityId: input.workspaceId, action: 'vendor_list.imported',
                    actorUserId: input.actorId, data: { created: res.created }, at: now,
                });
            }
            return res;
        }));
    }
}
