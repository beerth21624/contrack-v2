import { Injectable } from '@nestjs/common';
import type { BuyerPackageDto } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, ok } from '../../../../../shared/domain/result';
import type { PackageId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { WorkPackageRepository } from '../ports/sourcing.repositories';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingViews } from '../services/sourcing-views.service';

/** `sc.packages.manage`, draft only; a file that is not attached → not_found. */
@Injectable()
export class RemovePackageFileUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly views: SourcingViews,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorId: UserId; packageId: PackageId; fileId: string }): Promise<Result<BuyerPackageDto, DomainError>> {
        const found = await this.access.buyerPackage(input.actorId, input.packageId, ['sc.packages.manage']);
        if (!found.ok) return found;
        const { pkg, prices } = found.value;
        const now = this.clock.now();
        const removed = pkg.removeFile(input.fileId, now);
        if (!removed.ok) return removed;
        await this.uow.run(async () => {
            await this.packages.update(pkg);
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.file_removed',
                actorUserId: input.actorId, data: { fileId: input.fileId }, at: now,
            });
        });
        return ok(await this.views.buyerPackage(pkg, prices));
    }
}
