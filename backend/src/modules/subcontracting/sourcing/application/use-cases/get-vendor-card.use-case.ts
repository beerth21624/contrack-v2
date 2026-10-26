import { Injectable } from '@nestjs/common';
import type { VendorCardDto } from '@contrack/contract';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import { ScAccess } from '../../../shared/sc-access';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { VendorListRepository, VendorProfileRepository } from '../ports/sourcing.repositories';
import { VendorProfileViews } from '../services/vendor-profile-views.service';

export interface GetVendorCardInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    vendorWorkspaceId: WorkspaceId;
}

/** `sc.read`. Only crews in this buyer's vendor list (linked) — anything else is not_found. */
@Injectable()
export class GetVendorCardUseCase {
    constructor(
        private readonly access: ScAccess,
        private readonly entries: VendorListRepository,
        private readonly profiles: VendorProfileRepository,
        private readonly views: VendorProfileViews,
    ) {}

    async execute(input: GetVendorCardInput): Promise<Result<VendorCardDto, DomainError>> {
        const role = await this.access.buyer(input.actorId, input.workspaceId, ['sc.read']);
        if (!role.ok) return role;
        if (await this.entries.findLinked(input.workspaceId, input.vendorWorkspaceId) === undefined) return err(SourcingErrors.vendorNotFound());
        const profile = await this.profiles.find(input.vendorWorkspaceId);
        if (profile === undefined) return err(SourcingErrors.vendorNotFound());
        return ok(await this.views.card(profile));
    }
}
