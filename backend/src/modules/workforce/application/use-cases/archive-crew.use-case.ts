import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import {
    type CrewId, DomainError, type Result, type UserId, type WorkspaceId, err, okVoid,
} from '../../../../shared/domain';
import { checkNotInUse } from '../../domain/policies/workforce-library.policy';
import { bangkokToday } from '../../domain/value-objects/plan-day.value-object';
import { CrewAssignmentRepository } from '../ports/crew-assignment.repository';
import { CrewRepository } from '../ports/crew.repository';
import { WorkforceLock } from '../ports/workforce-lock.port';
import { WorkforceAccess } from '../workforce-access';

export interface ArchiveCrewInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    crewId: CrewId;
}

/**
 * Soft delete (frees the name and its place in the limit). Refused (409 `in_use`) while the crew has an assignment that
 * ends today or later (Bangkok time); past assignments stay as history. Archiving again is a no-op.
 */
@Injectable()
export class ArchiveCrewUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly crews: CrewRepository,
        private readonly assignments: CrewAssignmentRepository,
        private readonly lock: WorkforceLock,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: ArchiveCrewInput): Promise<Result<undefined, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.manage');
        if (!granted.ok) return granted;
        const { workspaceId, crewId } = input;
        return this.uow.run(async (): Promise<Result<undefined, DomainError>> => {
            await this.lock.lock(workspaceId);
            const crew = await this.crews.find(workspaceId, crewId);
            if (crew === undefined) return err(DomainError.notFound('Crew'));
            if (crew.isArchived) return okVoid();
            const now = this.clock.now();
            const free = checkNotInUse('crew', await this.assignments.countEndingOnOrAfter(workspaceId, [crewId], bangkokToday(now)));
            if (!free.ok) return free;
            crew.archive(now);
            await this.crews.update(crew);
            return okVoid();
        });
    }
}
