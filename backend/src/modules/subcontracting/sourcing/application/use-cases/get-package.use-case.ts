import { Injectable } from '@nestjs/common';
import type { BuyerPackageDto } from '@contrack/contract';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, ok } from '../../../../../shared/domain/result';
import type { PackageId } from '../../../shared/ids';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingViews } from '../services/sourcing-views.service';

/** `sc.read`. Estimates 0 and bestBidTotal null without `sc.readPrices`; boqDrift against the live BOQ. */
@Injectable()
export class GetPackageUseCase {
    constructor(private readonly access: SourcingAccess, private readonly views: SourcingViews) {}

    async execute(input: { actorId: UserId; packageId: PackageId }): Promise<Result<BuyerPackageDto, DomainError>> {
        const found = await this.access.buyerPackage(input.actorId, input.packageId, ['sc.read']);
        if (!found.ok) return found;
        return ok(await this.views.buyerPackage(found.value.pkg, found.value.prices));
    }
}
