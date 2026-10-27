import { Injectable } from '@nestjs/common';
import {
    type CrewId, DomainError, type ProjectId, type Result, type UserId, type WorkspaceId, err, ok,
} from '../../../../shared/domain';
import type { CrewAssignment } from '../../domain/entities/crew-assignment.entity';
import { planDay } from '../../domain/value-objects/plan-day.value-object';
import { type CrewAssignmentFilter, CrewAssignmentRepository } from '../ports/crew-assignment.repository';
import { WorkforceAccess } from '../workforce-access';

export interface ListCrewAssignmentsInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    projectId?: ProjectId;
    crewId?: CrewId;
    /** Keep the assignments whose days overlap [from, to] (either end optional). */
    from?: string;
    to?: string;
}

/**
 * The workspace's crew assignments (every project, or one project / one crew), ordered by start. A project or crew of
 * another workspace simply matches nothing.
 */
@Injectable()
export class ListCrewAssignmentsUseCase {
    constructor(private readonly access: WorkforceAccess, private readonly assignments: CrewAssignmentRepository) {}

    async execute(input: ListCrewAssignmentsInput): Promise<Result<CrewAssignment[], DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.read');
        if (!granted.ok) return granted;
        const filter: CrewAssignmentFilter = {};
        if (input.projectId !== undefined) filter.projectId = input.projectId;
        if (input.crewId !== undefined) filter.crewId = input.crewId;
        if (input.from !== undefined) {
            const r = planDay(input.from, 'from day');
            if (!r.ok) return r;
            filter.from = r.value;
        }
        if (input.to !== undefined) {
            const r = planDay(input.to, 'to day');
            if (!r.ok) return r;
            filter.to = r.value;
        }
        if (filter.from !== undefined && filter.to !== undefined && filter.from > filter.to) {
            return err(DomainError.validation('"from" comes after "to"'));
        }
        return ok(await this.assignments.list(input.workspaceId, filter));
    }
}
