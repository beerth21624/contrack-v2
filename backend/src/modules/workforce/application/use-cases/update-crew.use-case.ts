import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import {
    type CrewId, DomainError, type Result, type UserId, type WorkspaceId, err, ok,
} from '../../../../shared/domain';
import type { Crew } from '../../domain/entities/crew.entity';
import { checkCrewNameFree } from '../../domain/policies/workforce-library.policy';
import { CrewPricing, type PricedCrew } from '../crew-pricing';
import { CrewRepository } from '../ports/crew.repository';
import { WorkforceLock } from '../ports/workforce-lock.port';
import { WorkforceAccess } from '../workforce-access';
import { WorkforceReferences } from '../workforce-references';
import { type CrewInput, checkCrewReferences, parseCrewChanges } from './crew-input';

export interface UpdateCrewInput extends CrewInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    crewId: CrewId;
}

/** Changes any subset of a crew's fields (`memberIds` replaces the list). An archived crew is gone (not_found). */
@Injectable()
export class UpdateCrewUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly crews: CrewRepository,
        private readonly refs: WorkforceReferences,
        private readonly pricing: CrewPricing,
        private readonly lock: WorkforceLock,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: UpdateCrewInput): Promise<Result<{ role: Role } & PricedCrew, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.manage');
        if (!granted.ok) return granted;
        const { userId: _userId, workspaceId, crewId, ...raw } = input;
        if ((Object.values(raw) as unknown[]).every(v => v === undefined)) return err(DomainError.validation('Nothing to update'));
        const changes = parseCrewChanges(raw);
        if (!changes.ok) return changes;
        const { name } = changes.value;

        const updated = await this.uow.run(async (): Promise<Result<Crew, DomainError>> => {
            await this.lock.lock(workspaceId);
            const crew = await this.crews.find(workspaceId, crewId);
            if (crew === undefined || crew.isArchived) return err(DomainError.notFound('Crew'));
            if (name !== undefined) {
                const free = checkCrewNameFree(name, await this.crews.findActiveByName(workspaceId, name), crew.id);
                if (!free.ok) return free;
            }
            const refs = await checkCrewReferences(this.refs, workspaceId, changes.value, crew);
            if (!refs.ok) return refs;
            if (crew.update(changes.value, this.clock.now())) await this.crews.update(crew);
            return ok(crew);
        });
        if (!updated.ok) return updated;
        return ok({ role: granted.value, ...await this.pricing.priceOne(workspaceId, updated.value) });
    }
}
