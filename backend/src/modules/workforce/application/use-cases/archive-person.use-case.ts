import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import {
    DomainError, type PersonId, type Result, type UserId, type WorkspaceId, err, okVoid,
} from '../../../../shared/domain';
import { checkNotInUse } from '../../domain/policies/workforce-library.policy';
import { bangkokToday } from '../../domain/value-objects/plan-day.value-object';
import { CrewAssignmentRepository } from '../ports/crew-assignment.repository';
import { CrewRepository } from '../ports/crew.repository';
import { PersonRepository } from '../ports/person.repository';
import { ProjectSupervisorRepository } from '../ports/project-supervisor.repository';
import { WorkforceLock } from '../ports/workforce-lock.port';
import { WorkforceAccess } from '../workforce-access';

export interface ArchivePersonInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    personId: PersonId;
}

/**
 * Soft delete. Refused (409 `in_use`) while a crew the person leads or belongs to has an assignment that ends today or
 * later (Bangkok time). Otherwise the person is taken out of every crew (as leader and as member) and off every
 * project's supervisors, then archived, so no list ever names an archived person. Archiving again is a no-op.
 */
@Injectable()
export class ArchivePersonUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly people: PersonRepository,
        private readonly crews: CrewRepository,
        private readonly assignments: CrewAssignmentRepository,
        private readonly supervisors: ProjectSupervisorRepository,
        private readonly lock: WorkforceLock,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: ArchivePersonInput): Promise<Result<undefined, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.manage');
        if (!granted.ok) return granted;
        const { workspaceId, personId } = input;
        return this.uow.run(async (): Promise<Result<undefined, DomainError>> => {
            await this.lock.lock(workspaceId);
            const person = await this.people.find(workspaceId, personId);
            if (person === undefined) return err(DomainError.notFound('Person'));
            if (person.isArchived) return okVoid();
            const now = this.clock.now();
            const crews = await this.crews.listInvolving(workspaceId, personId);
            const open = await this.assignments.countEndingOnOrAfter(workspaceId, crews.map(c => c.id), bangkokToday(now));
            const free = checkNotInUse('person', open);
            if (!free.ok) return free;

            for (const crew of crews) {
                if (crew.removePerson(personId, now)) await this.crews.update(crew);
            }
            await this.supervisors.removePerson(workspaceId, personId);
            person.archive(now);
            await this.people.update(person);
            return okVoid();
        });
    }
}
