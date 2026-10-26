import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../../shared/domain/result';
import type { PortfolioItemId } from '../../../shared/ids';
import { ScAccess } from '../../../shared/sc-access';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { VendorProfileRepository } from '../ports/sourcing.repositories';

/** `vendor.profile.edit` in the item's vendor workspace (else not_found); the tier follows. */
@Injectable()
export class DeletePortfolioItemUseCase {
    constructor(
        private readonly access: ScAccess,
        private readonly profiles: VendorProfileRepository,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorId: UserId; itemId: PortfolioItemId }): Promise<Result<undefined, DomainError>> {
        const item = await this.profiles.findPortfolioItem(input.itemId);
        if (item === undefined) return err(SourcingErrors.portfolioNotFound());
        const role = await this.access.vendor(input.actorId, item.vendorWorkspaceId, ['vendor.profile.edit'], 'Portfolio item');
        if (!role.ok) return role;
        await this.uow.run(async () => {
            await this.profiles.deletePortfolioItem(item.vendorWorkspaceId, item.id);
            const profile = await this.profiles.find(item.vendorWorkspaceId);
            if (profile !== undefined) {
                profile.refreshTier((await this.profiles.listPortfolio(item.vendorWorkspaceId)).length, this.clock.now());
                await this.profiles.save(profile);
            }
        });
        return okVoid();
    }
}
