import { Injectable } from '@nestjs/common';
import type { BuyerPackageDto } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, ok } from '../../../../../shared/domain/result';
import type { PackageId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import type { WorkPackage } from '../../domain/entities/work-package.entity';
import { InvitationRepository, WorkPackageRepository } from '../ports/sourcing.repositories';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingNotices } from '../services/sourcing-notices.service';
import { SourcingViews } from '../services/sourcing-views.service';

/**
 * `sc.packages.manage`. Any time before award, with a reason; every invitee still in the running is told. Decided on
 * the locked package row, so an award that committed first wins (conflict).
 */
@Injectable()
export class CancelPackageUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly views: SourcingViews,
        private readonly notices: SourcingNotices,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorId: UserId; packageId: PackageId; reason: string }): Promise<Result<BuyerPackageDto, DomainError>> {
        const found = await this.access.buyerPackage(input.actorId, input.packageId, ['sc.packages.manage']);
        if (!found.ok) return found;
        const { prices } = found.value;
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<WorkPackage, DomainError>> => {
            const locked = await this.access.lockPackage(input.packageId);
            if (!locked.ok) return locked;
            const pkg = locked.value;
            const from = pkg.status;
            const cancelled = pkg.cancel(input.reason, now);
            if (!cancelled.ok) return cancelled;
            await this.packages.update(pkg);
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.cancelled',
                actorUserId: input.actorId, data: { from, reason: input.reason }, at: now,
            });
            return ok(pkg);
        });
        if (!done.ok) return done;
        const pkg = done.value;
        const invitees = (await this.invitations.listByPackage(pkg.id)).filter(i => i.isInRunning);
        const buyerName = await this.notices.workspaceName(pkg.buyerWorkspaceId);
        await this.notices.cancelled(pkg, buyerName, invitees, input.reason);
        return ok(await this.views.buyerPackage(pkg, prices));
    }
}
