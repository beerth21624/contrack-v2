import { Injectable } from '@nestjs/common';
import { type DomainError, type Result, type UserId, type WorkspaceId, ok } from '../../../../shared/domain';
import type { Project } from '../../domain/entities/project.entity';
import { ProjectAccess } from '../project-access';
import { ProjectRepository } from '../ports/project.repository';

export interface ListProjectsInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    /** Default false: active projects only. */
    archived?: boolean;
}

@Injectable()
export class ListProjectsUseCase {
    constructor(private readonly access: ProjectAccess, private readonly projects: ProjectRepository) {}

    async execute(input: ListProjectsInput): Promise<Result<Project[], DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'projects.read');
        if (!granted.ok) return granted;
        return ok(await this.projects.listByWorkspace(input.workspaceId, { archived: input.archived ?? false }));
    }
}
