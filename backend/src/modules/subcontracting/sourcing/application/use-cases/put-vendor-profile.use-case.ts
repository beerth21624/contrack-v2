import { Injectable } from '@nestjs/common';
import type { PutVendorProfileRequest, VendorProfileDto } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import { type UserId, asWorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, ok } from '../../../../../shared/domain/result';
import { ScAccess } from '../../../shared/sc-access';
import { VendorProfile } from '../../domain/entities/vendor-profile.entity';
import { VendorProfileRepository } from '../ports/sourcing.repositories';
import { VendorProfileViews } from '../services/vendor-profile-views.service';

/**
 * `vendor.profile.edit` in the vendor workspace. Creates the profile when the workspace has none (no phone yet: it
 * comes with a phone sign-in). The tier follows completeness (L0 ↔ L1).
 */
@Injectable()
export class PutVendorProfileUseCase {
    constructor(
        private readonly access: ScAccess,
        private readonly profiles: VendorProfileRepository,
        private readonly views: VendorProfileViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorId: UserId; body: PutVendorProfileRequest }): Promise<Result<VendorProfileDto, DomainError>> {
        const workspaceId = asWorkspaceId(input.body.workspaceId);
        const role = await this.access.vendor(input.actorId, workspaceId, ['vendor.profile.edit']);
        if (!role.ok) return role;
        const { workspaceId: _ws, ...fields } = input.body;
        const now = this.clock.now();
        const profile = await this.uow.run(async () => {
            const existing = await this.profiles.find(workspaceId);
            const p = existing ?? VendorProfile.create({ workspaceId, teamName: fields.teamName, contactName: fields.contactName, phone: '', now });
            p.update(fields, (await this.profiles.listPortfolio(workspaceId)).length, now);
            await this.profiles.save(p);
            return p;
        });
        return ok(await this.views.profile(profile));
    }
}
