import { Injectable } from '@nestjs/common';
import type { ScInvitationDto } from '@contrack/contract';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, ok } from '../../../../../shared/domain/result';
import type { PackageId } from '../../../shared/ids';
import { InvitationRepository } from '../ports/sourcing.repositories';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingViews } from '../services/sourcing-views.service';

/** `sc.read`. Every invitation of the package (withdrawn included), oldest first; bid totals 0 without `sc.readPrices`. */
@Injectable()
export class ListInvitationsUseCase {
    constructor(private readonly access: SourcingAccess, private readonly invitations: InvitationRepository, private readonly views: SourcingViews) {}

    async execute(input: { actorId: UserId; packageId: PackageId }): Promise<Result<ScInvitationDto[], DomainError>> {
        const found = await this.access.buyerPackage(input.actorId, input.packageId, ['sc.read']);
        if (!found.ok) return found;
        const { pkg, prices } = found.value;
        return ok(await this.views.invitationDtos(pkg, await this.invitations.listByPackage(pkg.id), prices));
    }
}
