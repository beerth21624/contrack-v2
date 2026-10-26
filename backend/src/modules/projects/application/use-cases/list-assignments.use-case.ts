import { Injectable } from '@nestjs/common';
import { type DomainError, type ProjectId, type Result, type UserId, ok } from '../../../../shared/domain';
import type { LevelAssignment } from '../../domain/entities/level-assignment.entity';
import { ProjectAccess } from '../project-access';
import { AssignmentRepository } from '../ports/assignment.repository';

export interface ListAssignmentsInput {
    userId: UserId;
    projectId: ProjectId;
}

@Injectable()
export class ListAssignmentsUseCase {
    constructor(private readonly access: ProjectAccess, private readonly assignments: AssignmentRepository) {}

    async execute(input: ListAssignmentsInput): Promise<Result<LevelAssignment[], DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'projects.read');
        if (!granted.ok) return granted;
        const { project } = granted.value;
        return ok(await this.assignments.listByProject(project.workspaceId, project.id));
    }
}
