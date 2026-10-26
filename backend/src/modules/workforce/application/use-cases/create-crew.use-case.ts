import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { Clock, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import { type DomainError, type Result, type UserId, type WorkspaceId, asCrewId, ok } from '../../../../shared/domain';
import { Crew } from '../../domain/entities/crew.entity';
import { checkCrewNameFree, checkRoomForAnotherCrew } from '../../domain/policies/workforce-library.policy';
import { CrewPricing, type PricedCrew } from '../crew-pricing';
import { CrewRepository } from '../ports/crew.repository';
import { WorkforceLock } from '../ports/workforce-lock.port';
import { WorkforceAccess } from '../workforce-access';
import { WorkforceReferences } from '../workforce-references';
import { type CrewInput, checkCrewReferences, parseNewCrew } from './crew-input';

export interface CreateCrewInput extends CrewInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    name: string;
    trade: string;
    skilledCount: number;
    labourerCount: number;
}

/**
 * Adds a crew. Its name is unique among the workspace's active crews (ignoring case); at most MAX_ACTIVE_CREWS active
 * crews; the leader and members are active people of the workspace and the rate card an active card of it.
 */
@Injectable()
export class CreateCrewUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly crews: CrewRepository,
        private readonly refs: WorkforceReferences,
        private readonly pricing: CrewPricing,
        private readonly lock: WorkforceLock,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: CreateCrewInput): Promise<Result<{ role: Role } & PricedCrew, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.manage');
        if (!granted.ok) return granted;
        const { userId: _userId, workspaceId, ...raw } = input;
        const fields = parseNewCrew(raw);
        if (!fields.ok) return fields;

        const created = await this.uow.run(async (): Promise<Result<Crew, DomainError>> => {
            await this.lock.lock(workspaceId);
            const room = checkRoomForAnotherCrew(await this.crews.countActive(workspaceId));
            if (!room.ok) return room;
            const free = checkCrewNameFree(fields.value.name, await this.crews.findActiveByName(workspaceId, fields.value.name));
            if (!free.ok) return free;
            const refs = await checkCrewReferences(this.refs, workspaceId, fields.value);
            if (!refs.ok) return refs;
            const crew = Crew.create({ ...fields.value, id: asCrewId(this.ids.newId()), workspaceId, now: this.clock.now() });
            await this.crews.insert(crew);
            return ok(crew);
        });
        if (!created.ok) return created;
        return ok({ role: granted.value, ...await this.pricing.priceOne(workspaceId, created.value) });
    }
}
