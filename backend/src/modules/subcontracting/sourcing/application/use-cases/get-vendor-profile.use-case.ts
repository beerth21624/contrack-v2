import { Injectable } from '@nestjs/common';
import type { VendorProfileDto } from '@contrack/contract';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import { ScAccess } from '../../../shared/sc-access';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { VendorProfileRepository } from '../ports/sourcing.repositories';
import { VendorProfileViews } from '../services/vendor-profile-views.service';

/** `vendor.read` in the vendor workspace; no profile → not_found. */
@Injectable()
export class GetVendorProfileUseCase {
    constructor(private readonly access: ScAccess, private readonly profiles: VendorProfileRepository, private readonly views: VendorProfileViews) {}

    async execute(input: { actorId: UserId; workspaceId: WorkspaceId }): Promise<Result<VendorProfileDto, DomainError>> {
        const role = await this.access.vendor(input.actorId, input.workspaceId, ['vendor.read']);
        if (!role.ok) return role;
        const profile = await this.profiles.find(input.workspaceId);
        if (profile === undefined) return err(SourcingErrors.profileNotFound());
        return ok(await this.views.profile(profile));
    }
}
