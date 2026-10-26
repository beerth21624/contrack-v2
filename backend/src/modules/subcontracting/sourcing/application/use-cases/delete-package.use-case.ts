import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../../shared/domain/result';
import type { PackageId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { WorkPackageRepository } from '../ports/sourcing.repositories';
import { SourcingAccess } from '../services/sourcing-access.service';

/** `sc.packages.manage`, draft only (a sent package is cancelled instead). */
@Injectable()
export class DeletePackageUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorId: UserId; packageId: PackageId }): Promise<Result<undefined, DomainError>> {
        const found = await this.access.buyerPackage(input.actorId, input.packageId, ['sc.packages.manage']);
        if (!found.ok) return found;
        const { pkg } = found.value;
        if (!pkg.isDraft) return err(SourcingErrors.notDraft());
        await this.uow.run(async () => {
            await this.packages.delete(pkg.buyerWorkspaceId, pkg.id);
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.deleted',
                actorUserId: input.actorId, at: this.clock.now(),
            });
        });
        return okVoid();
    }
}
