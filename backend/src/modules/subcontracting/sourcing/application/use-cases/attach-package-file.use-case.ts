import { Injectable } from '@nestjs/common';
import type { BuyerPackageDto } from '@contrack/contract';
import { Clock, FileService, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, ok } from '../../../../../shared/domain/result';
import type { PackageId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { InvitationRepository, WorkPackageRepository } from '../ports/sourcing.repositories';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingNotices } from '../services/sourcing-notices.service';
import { SourcingViews } from '../services/sourcing-views.service';

/**
 * `sc.packages.manage`. Attaches a file the caller uploaded (idempotent). Not after the decision. A file added to a
 * sent package is announced to the invitees like an addendum ("มีข้อมูลเพิ่ม").
 */
@Injectable()
export class AttachPackageFileUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly files: FileService,
        private readonly views: SourcingViews,
        private readonly notices: SourcingNotices,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorId: UserId; packageId: PackageId; fileId: string }): Promise<Result<BuyerPackageDto, DomainError>> {
        const found = await this.access.buyerPackage(input.actorId, input.packageId, ['sc.packages.manage']);
        if (!found.ok) return found;
        const { pkg, prices } = found.value;
        const uploaded = await this.files.assertUploadedBy([input.fileId], input.actorId);
        if (!uploaded.ok) return uploaded;
        const now = this.clock.now();
        const attached = pkg.attachFile(input.fileId, now);
        if (!attached.ok) return attached;
        if (attached.value) {
            await this.uow.run(async () => {
                await this.packages.update(pkg);
                await this.activity.record({
                    buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.file_added',
                    actorUserId: input.actorId, data: { fileId: input.fileId }, at: now,
                });
            });
            if (!pkg.isDraft) {
                const buyerName = await this.notices.workspaceName(pkg.buyerWorkspaceId);
                for (const inv of (await this.invitations.listByPackage(pkg.id)).filter(i => i.isInRunning)) {
                    await this.notices.addendum(pkg, buyerName, inv, undefined);
                }
            }
        }
        return ok(await this.views.buyerPackage(pkg, prices));
    }
}
