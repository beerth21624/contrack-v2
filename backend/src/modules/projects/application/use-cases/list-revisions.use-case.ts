import { Injectable } from '@nestjs/common';
import { type DomainError, type ProjectId, type Result, type UserId, ok } from '../../../../shared/domain';
import type { Revision } from '../../domain/entities/revision.entity';
import { ProjectAccess } from '../project-access';
import { RevisionRepository } from '../ports/revision.repository';

export interface ListRevisionsInput {
    userId: UserId;
    projectId: ProjectId;
}

@Injectable()
export class ListRevisionsUseCase {
    constructor(private readonly access: ProjectAccess, private readonly revisions: RevisionRepository) {}

    async execute(input: ListRevisionsInput): Promise<Result<Revision[], DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'projects.read');
        if (!granted.ok) return granted;
        const { project } = granted.value;
        return ok(await this.revisions.listByProject(project.workspaceId, project.id));
    }
}
