import { Injectable } from '@nestjs/common';
import type { BuyerPackageDto, CreatePackageRequest } from '@contrack/contract';
import { Clock, IdGenerator, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { ProjectId, UserId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import { asPackageId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { WorkPackage } from '../../domain/entities/work-package.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { WorkPackageRepository } from '../ports/sourcing.repositories';
import { PackageLineGuard } from '../services/package-line-guard.service';
import { PackageSnapshots } from '../services/package-snapshots.service';
import { fieldsOf, selectionOf } from '../services/package-input';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingViews } from '../services/sourcing-views.service';

export interface CreatePackageInput {
    actorId: UserId;
    projectId: ProjectId;
    body: CreatePackageRequest;
}

/**
 * `sc.packages.manage`. A draft package whose lines are snapshotted from the live BOQ right away. The project must
 * be in the caller's workspace and not archived; unknown BOQ keys → 422; sourcingMode 'open' → 422 (phase 2); BOQ
 * lines already in another live package of the project → 409 conflict { lineKeys }.
 */
@Injectable()
export class CreatePackageUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly snapshots: PackageSnapshots,
        private readonly lineGuard: PackageLineGuard,
        private readonly views: SourcingViews,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: CreatePackageInput): Promise<Result<BuyerPackageDto, DomainError>> {
        const buyer = await this.access.sc.buyerProject(input.actorId, input.projectId, ['sc.packages.manage']);
        if (!buyer.ok) return buyer;
        const { workspaceId, role } = buyer.value;
        const read = await this.snapshots.read(input.projectId);
        if (read?.workspaceId !== workspaceId) return err(SourcingErrors.projectNotFound());
        if (read.archived) return err(SourcingErrors.projectArchived());
        if (input.body.sourcingMode === 'open') return err(SourcingErrors.openSourcingUnsupported());
        const selection = selectionOf(input.body.lineKeys, input.body.customLines, input.body.materialByLine, input.body.supplyMode);
        const free = await this.lineGuard.check(workspaceId, input.projectId, selection.lineKeys);
        if (!free.ok) return free;
        const snapshot = this.snapshots.fromRead(read, selection, input.body.supplyMode);
        if (!snapshot.ok) return snapshot;
        const now = this.clock.now();
        const created = WorkPackage.create({
            id: asPackageId(this.ids.newId()), buyerWorkspaceId: workspaceId, projectId: input.projectId, projectName: read.name,
            fields: fieldsOf(input.body), selection, snapshot: snapshot.value, createdBy: input.actorId, now,
        });
        if (!created.ok) return created;
        const pkg = created.value;
        await this.uow.run(async () => {
            await this.packages.insert(pkg);
            await this.activity.record({
                buyerWorkspaceId: workspaceId, entity: 'package', entityId: pkg.id, action: 'package.created',
                actorUserId: input.actorId, data: { lines: pkg.lines.length }, at: now,
            });
        });
        return ok(await this.views.buyerPackage(pkg, await this.access.prices(role, workspaceId)));
    }
}
