import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/application/ports';
import {
    type CrewAssignmentId, DomainError, type Result, type UserId, type WorkspaceId, err, okVoid,
} from '../../../../shared/domain';
import { CrewAssignmentRepository } from '../ports/crew-assignment.repository';
import { WorkforceLock } from '../ports/workforce-lock.port';
import { WorkforceAccess } from '../workforce-access';

export interface DeleteCrewAssignmentInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    assignmentId: CrewAssignmentId;
}

/** Removes an assignment (a hard delete: it is a plan, not a record). An archived project → 409 `conflict`. */
@Injectable()
export class DeleteCrewAssignmentUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly assignments: CrewAssignmentRepository,
        private readonly lock: WorkforceLock,
        private readonly uow: UnitOfWork,
    ) {}

    async execute(input: DeleteCrewAssignmentInput): Promise<Result<undefined, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.assign');
        if (!granted.ok) return granted;
        return this.uow.run(async (): Promise<Result<undefined, DomainError>> => {
            await this.lock.lock(input.workspaceId);
            const assignment = await this.assignments.find(input.workspaceId, input.assignmentId);
            if (assignment === undefined) return err(DomainError.notFound('Crew assignment'));
            const project = await this.access.projectOfWorkspace(input.workspaceId, assignment.projectId);
            if (!project.ok) return project;
            await this.assignments.delete(input.workspaceId, input.assignmentId);
            return okVoid();
        });
    }
}
