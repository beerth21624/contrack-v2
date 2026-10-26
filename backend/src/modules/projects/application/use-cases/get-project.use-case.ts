import { Injectable } from '@nestjs/common';
import { type DomainError, type ProjectId, type Result, type UserId, ok } from '../../../../shared/domain';
import type { ProjectDoc } from '../../domain/entities/project-doc.entity';
import type { Project } from '../../domain/entities/project.entity';
import { ProjectAccess } from '../project-access';
import { ProjectDocRepository } from '../ports/project-doc.repository';

export interface GetProjectInput {
    userId: UserId;
    projectId: ProjectId;
}

export interface ProjectWithDocs {
    project: Project;
    docs: ProjectDoc[];
}

@Injectable()
export class GetProjectUseCase {
    constructor(private readonly access: ProjectAccess, private readonly docs: ProjectDocRepository) {}

    async execute(input: GetProjectInput): Promise<Result<ProjectWithDocs, DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'projects.read');
        if (!granted.ok) return granted;
        const { project } = granted.value;
        return ok({ project, docs: await this.docs.listByProject(project.workspaceId, project.id) });
    }
}
