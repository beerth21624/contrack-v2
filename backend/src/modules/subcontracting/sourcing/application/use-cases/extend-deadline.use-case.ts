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
import { SourcingViews, hasSubmitted } from '../services/sourcing-views.service';

/**
 * `sc.packages.manage`. The new deadline must be later than now and than the current one; reviewing / expired → open.
 * Links are renewed to the new deadline + 30 days and the "deadline soon" reminder is armed again.
 */
@Injectable()
export class ExtendDeadlineUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly views: SourcingViews,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorId: UserId; packageId: PackageId; bidDeadline: Date }): Promise<Result<BuyerPackageDto, DomainError>> {
        const found = await this.access.buyerPackage(input.actorId, input.packageId, ['sc.packages.manage']);
        if (!found.ok) return found;
        const { prices } = found.value;
        const now = this.clock.now();
        const done = await this.uow.run(async (): Promise<Result<WorkPackage, DomainError>> => {
            const locked = await this.access.lockPackage(input.packageId);
            if (!locked.ok) return locked;
            const pkg = locked.value;
            const invitations = await this.invitations.lockByPackage(pkg.id);
            pkg.settle(now, hasSubmitted(invitations));
            const before = pkg.props.bidDeadline;
            const extended = pkg.extend(input.bidDeadline, now);
            if (!extended.ok) return extended;
            await this.packages.update(pkg);
            for (const inv of invitations) {
                inv.renewExpiry(input.bidDeadline);
                inv.rearmReminder();
                await this.invitations.update(inv);
            }
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.extended',
                actorUserId: input.actorId, data: { from: before.toISOString(), to: input.bidDeadline.toISOString() }, at: now,
            });
            return ok(pkg);
        });
        if (!done.ok) return done;
        const pkg = done.value;
        return ok(await this.views.buyerPackage(pkg, prices));
    }
}
