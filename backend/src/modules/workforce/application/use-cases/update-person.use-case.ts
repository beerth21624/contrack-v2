import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import {
    DomainError, type PersonId, type Result, type UserId, type WorkspaceId, err, ok,
} from '../../../../shared/domain';
import type { Person } from '../../domain/entities/person.entity';
import { PersonRepository } from '../ports/person.repository';
import { WorkforceLock } from '../ports/workforce-lock.port';
import { WorkforceAccess } from '../workforce-access';
import { type PersonInput, parsePersonChanges } from './person-input';

export interface UpdatePersonInput extends PersonInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    personId: PersonId;
}

/** Changes any subset of a person's fields (an unchanged value is a no-op). An archived person is gone (not_found). */
@Injectable()
export class UpdatePersonUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly people: PersonRepository,
        private readonly lock: WorkforceLock,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: UpdatePersonInput): Promise<Result<{ role: Role; person: Person }, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.manage');
        if (!granted.ok) return granted;
        const { userId: _userId, workspaceId, personId, ...raw } = input;
        if ((Object.values(raw) as unknown[]).every(v => v === undefined)) return err(DomainError.validation('Nothing to update'));
        const changes = parsePersonChanges(raw);
        if (!changes.ok) return changes;

        return this.uow.run(async (): Promise<Result<{ role: Role; person: Person }, DomainError>> => {
            await this.lock.lock(workspaceId);
            const person = await this.people.find(workspaceId, personId);
            if (person === undefined || person.isArchived) return err(DomainError.notFound('Person'));
            if (person.update(changes.value, this.clock.now())) await this.people.update(person);
            return ok({ role: granted.value, person });
        });
    }
}
