// ─── Shared ports the projects module provides to the others (realtime) ───
import { Injectable } from '@nestjs/common';
import type { ProjectDocDto, ProjectDto } from '@contrack/contract';
import {
    ProjectCatalog, ProjectDirectory, ProjectDocLookup, type ProjectStatus, ProjectStatusLookup,
} from '../../../../shared/application/ports';
import type { ProjectId, WorkspaceId } from '../../../../shared/domain';
import { ProjectDocRepository } from '../../application/ports/project-doc.repository';
import { ProjectRepository } from '../../application/ports/project.repository';
import { projectDocToDto, projectToDto } from '../../application/project-dto.mapper';

@Injectable()
export class RepositoryProjectDirectory extends ProjectDirectory {
    constructor(private readonly projects: ProjectRepository) {
        super();
    }

    async workspaceOf(projectId: ProjectId): Promise<WorkspaceId | undefined> {
        return (await this.projects.findById(projectId))?.workspaceId;
    }
}

@Injectable()
export class RepositoryProjectStatusLookup extends ProjectStatusLookup {
    constructor(private readonly projects: ProjectRepository) {
        super();
    }

    async find(projectId: ProjectId): Promise<ProjectStatus | undefined> {
        const project = await this.projects.findById(projectId);
        return project === undefined ? undefined : { workspaceId: project.workspaceId, archived: project.isArchived };
    }
}

@Injectable()
export class RepositoryProjectDocLookup extends ProjectDocLookup {
    constructor(private readonly projects: ProjectRepository, private readonly docs: ProjectDocRepository) {
        super();
    }

    async find(projectId: ProjectId, docKey: string): Promise<ProjectDocDto | undefined> {
        const project = await this.projects.findById(projectId);
        if (project === undefined) return undefined;
        const doc = await this.docs.find(project.workspaceId, project.id, docKey);
        return doc === undefined ? undefined : projectDocToDto(doc);
    }
}

@Injectable()
export class RepositoryProjectCatalog extends ProjectCatalog {
    constructor(private readonly projects: ProjectRepository) {
        super();
    }

    async list(workspaceId: WorkspaceId, filter: { archived: boolean }): Promise<ProjectDto[]> {
        return (await this.projects.listByWorkspace(workspaceId, filter)).map(projectToDto);
    }

    async find(workspaceId: WorkspaceId, projectId: ProjectId): Promise<ProjectDto | undefined> {
        const project = await this.projects.findInWorkspace(workspaceId, projectId);
        return project === undefined ? undefined : projectToDto(project);
    }
}
