import { Injectable } from '@nestjs/common';
import type { BuyerPackageDto, UpdatePackageRequest } from '@contrack/contract';
import type { Snapshot } from '@contrack/domain/subcontracting';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import type { PackageId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import type { PackageSelection, WorkPackage } from '../../domain/entities/work-package.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { InvitationRepository, WorkPackageRepository } from '../ports/sourcing.repositories';
import { PackageLineGuard } from '../services/package-line-guard.service';
import { PackageSnapshots } from '../services/package-snapshots.service';
import { patchOf, selectionOf, touchesLines } from '../services/package-input';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingViews, hasSubmitted } from '../services/sourcing-views.service';

export interface UpdatePackageInput {
    actorId: UserId;
    packageId: PackageId;
    body: UpdatePackageRequest;
}

/**
 * `sc.packages.manage`. Draft: any field (the snapshot is re-taken when lines or supply change). After sending: only
 * `description` and a later `bidDeadline` (422 for anything else; lines change through an addendum). BOQ lines in
 * another live package of the project → conflict { lineKeys }. Decided on the locked package row.
 */
@Injectable()
export class UpdatePackageUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly snapshots: PackageSnapshots,
        private readonly lineGuard: PackageLineGuard,
        private readonly views: SourcingViews,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: UpdatePackageInput): Promise<Result<BuyerPackageDto, DomainError>> {
        const found = await this.access.buyerPackage(input.actorId, input.packageId, ['sc.packages.manage']);
        if (!found.ok) return found;
        const { prices } = found.value;
        const now = this.clock.now();
        const body = input.body;
        const done = await this.uow.run(async (): Promise<Result<WorkPackage, DomainError>> => {
            const locked = await this.access.lockPackage(input.packageId);
            if (!locked.ok) return locked;
            const pkg = locked.value;
            const invitations = await this.invitations.lockByPackage(pkg.id);
            pkg.settle(now, hasSubmitted(invitations));
            const deadlineBefore = pkg.props.bidDeadline.getTime();

            if (pkg.isDraft) {
                let selection: PackageSelection | undefined;
                let snapshot: Snapshot | undefined;
                if (touchesLines(body)) {
                    const p = pkg.props;
                    const supplyMode = body.supplyMode ?? p.supplyMode;
                    selection = selectionOf(body.lineKeys ?? p.selection.lineKeys, body.customLines ?? p.selection.customLines,
                        body.materialByLine ?? p.selection.materialByLine, supplyMode);
                    const free = await this.lineGuard.check(pkg.buyerWorkspaceId, p.projectId, selection.lineKeys, pkg.id);
                    if (!free.ok) return free;
                    const taken = await this.snapshots.take(p.projectId, selection, supplyMode);
                    if (!taken.ok) return taken;
                    snapshot = taken.value;
                }
                const edited = pkg.editDraft(patchOf(body), selection, snapshot, now);
                if (!edited.ok) return edited;
            } else {
                if (touchesLines(body)) {
                    const fields = ['lineKeys', 'customLines', 'materialByLine', 'supplyMode'].filter(k => k in body);
                    return err(SourcingErrors.onlyDescriptionAndDeadline(fields));
                }
                const edited = pkg.editAfterSend(patchOf(body), now);
                if (!edited.ok) return edited;
            }

            const extended = pkg.props.bidDeadline.getTime() !== deadlineBefore;
            await this.packages.update(pkg);
            if (extended && !pkg.isDraft) {
                for (const inv of invitations) {
                    inv.renewExpiry(pkg.props.bidDeadline);
                    inv.rearmReminder();
                    await this.invitations.update(inv);
                }
            }
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.updated',
                actorUserId: input.actorId, data: { fields: Object.keys(body) }, at: now,
            });
            return ok(pkg);
        });
        if (!done.ok) return done;
        const pkg = done.value;
        return ok(await this.views.buyerPackage(pkg, prices));
    }
}
