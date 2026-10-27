import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { Clock, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import { type DomainError, type Result, type UserId, type WorkspaceId, asPersonId, ok } from '../../../../shared/domain';
import { Person } from '../../domain/entities/person.entity';
import { checkRoomForAnotherPerson } from '../../domain/policies/workforce-library.policy';
import { PersonRepository } from '../ports/person.repository';
import { WorkforceLock } from '../ports/workforce-lock.port';
import { WorkforceAccess } from '../workforce-access';
import { type PersonInput, parseNewPerson } from './person-input';

export interface CreatePersonInput extends PersonInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    name: string;
    role: string;
    employment: string;
}

/** Adds a person (names may repeat: two workers can share a name). At most MAX_ACTIVE_PEOPLE active people. */
@Injectable()
export class CreatePersonUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly people: PersonRepository,
        private readonly lock: WorkforceLock,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: CreatePersonInput): Promise<Result<{ role: Role; person: Person }, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.manage');
        if (!granted.ok) return granted;
        const { userId: _userId, workspaceId, ...raw } = input;
        const fields = parseNewPerson(raw);
        if (!fields.ok) return fields;

        return this.uow.run(async (): Promise<Result<{ role: Role; person: Person }, DomainError>> => {
            await this.lock.lock(workspaceId);
            const room = checkRoomForAnotherPerson(await this.people.countActive(workspaceId));
            if (!room.ok) return room;
            const person = Person.create({ ...fields.value, id: asPersonId(this.ids.newId()), workspaceId, now: this.clock.now() });
            await this.people.insert(person);
            return ok({ role: granted.value, person });
        });
    }
}
