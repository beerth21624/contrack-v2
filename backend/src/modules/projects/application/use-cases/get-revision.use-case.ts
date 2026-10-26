import { Injectable } from '@nestjs/common';
import {
    DomainError, type ProjectId, type Result, type RevisionId, type UserId, err, ok,
} from '../../../../shared/domain';
import type { Revision } from '../../domain/entities/revision.entity';
import { ProjectAccess } from '../project-access';
import { RevisionRepository } from '../ports/revision.repository';

export interface GetRevisionInput {
    userId: UserId;
    projectId: ProjectId;
    revisionId: RevisionId;
}

@Injectable()
export class GetRevisionUseCase {
    constructor(private readonly access: ProjectAccess, private readonly revisions: RevisionRepository) {}

    async execute(input: GetRevisionInput): Promise<Result<Revision, DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'projects.read');
        if (!granted.ok) return granted;
        const { project } = granted.value;
        const revision = await this.revisions.find(project.workspaceId, project.id, input.revisionId);
        return revision === undefined ? err(DomainError.notFound('Revision')) : ok(revision);
    }
}
