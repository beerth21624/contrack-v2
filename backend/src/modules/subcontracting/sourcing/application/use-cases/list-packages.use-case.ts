import { Injectable } from '@nestjs/common';
import type { PackageSummaryDto } from '@contrack/contract';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { ProjectId, UserId } from '../../../../../shared/domain/ids';
import { type Result, ok } from '../../../../../shared/domain/result';
import { WorkPackageRepository } from '../ports/sourcing.repositories';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingViews } from '../services/sourcing-views.service';

/** `sc.read`. Packages of a project, newest first (estimates 0 / bestBidTotal null without `sc.readPrices`). */
@Injectable()
export class ListPackagesUseCase {
    constructor(private readonly access: SourcingAccess, private readonly packages: WorkPackageRepository, private readonly views: SourcingViews) {}

    async execute(input: { actorId: UserId; projectId: ProjectId }): Promise<Result<PackageSummaryDto[], DomainError>> {
        const buyer = await this.access.sc.buyerProject(input.actorId, input.projectId, ['sc.read']);
        if (!buyer.ok) return buyer;
        const prices = await this.access.prices(buyer.value.role, buyer.value.workspaceId);
        const pkgs = await this.packages.listByProject(buyer.value.workspaceId, input.projectId);
        return ok(await this.views.summaries(pkgs, prices));
    }
}
