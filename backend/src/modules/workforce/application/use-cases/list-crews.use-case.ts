import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { type DomainError, type Result, type UserId, type WorkspaceId, ok } from '../../../../shared/domain';
import { CrewPricing, type PricedCrew } from '../crew-pricing';
import { CrewRepository } from '../ports/crew.repository';
import { WorkforceAccess } from '../workforce-access';

export interface ListCrewsInput {
    userId: UserId;
    workspaceId: WorkspaceId;
}

/** The workspace's active crews, oldest first, priced; with the caller's role (it decides whether costs are shown). */
@Injectable()
export class ListCrewsUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly crews: CrewRepository,
        private readonly pricing: CrewPricing,
    ) {}

    async execute(input: ListCrewsInput): Promise<Result<{ role: Role; crews: PricedCrew[] }, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.read');
        if (!granted.ok) return granted;
        const crews = await this.crews.listActive(input.workspaceId);
        return ok({ role: granted.value, crews: await this.pricing.price(input.workspaceId, crews) });
    }
}
