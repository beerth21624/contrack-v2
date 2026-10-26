import { Injectable } from '@nestjs/common';
import type { CreatePortfolioItemRequest, PortfolioItemDto } from '@contrack/contract';
import { Clock, FileService, IdGenerator, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import { asPortfolioItemId } from '../../../shared/ids';
import { ScAccess } from '../../../shared/sc-access';
import { PortfolioItem } from '../../domain/entities/portfolio-item.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { VendorProfileRepository } from '../ports/sourcing.repositories';
import { VendorProfileViews } from '../services/vendor-profile-views.service';

/** `vendor.profile.edit`; the profile must exist and every photo must be uploaded by the caller. */
@Injectable()
export class AddPortfolioItemUseCase {
    constructor(
        private readonly access: ScAccess,
        private readonly profiles: VendorProfileRepository,
        private readonly files: FileService,
        private readonly views: VendorProfileViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: { actorId: UserId; workspaceId: WorkspaceId; body: CreatePortfolioItemRequest }): Promise<Result<PortfolioItemDto, DomainError>> {
        const role = await this.access.vendor(input.actorId, input.workspaceId, ['vendor.profile.edit']);
        if (!role.ok) return role;
        const profile = await this.profiles.find(input.workspaceId);
        if (profile === undefined) return err(SourcingErrors.profileNotFound());
        const uploaded = await this.files.assertUploadedBy(input.body.photoFileIds, input.actorId);
        if (!uploaded.ok) return uploaded;
        const now = this.clock.now();
        const item = PortfolioItem.create({
            id: asPortfolioItemId(this.ids.newId()), vendorWorkspaceId: input.workspaceId, title: input.body.title,
            trade: input.body.trade, year: input.body.year, district: input.body.district, province: input.body.province,
            photoFileIds: input.body.photoFileIds, note: input.body.note, createdAt: now,
        });
        await this.uow.run(async () => {
            await this.profiles.insertPortfolioItem(item);
            profile.refreshTier((await this.profiles.listPortfolio(input.workspaceId)).length, now);
            await this.profiles.save(profile);
        });
        return ok(await this.views.portfolioItem(item));
    }
}
