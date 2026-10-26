// ─── Authorization of every projects use case (one place, so no use case can forget a rule) ───
// Not a member of the workspace → not_found (never reveal that another tenant's project exists).
// Member without the permission → forbidden.
import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { WorkspaceAccess } from '../../../shared/application/ports';
import { DomainError, type ProjectId, type Result, type UserId, type WorkspaceId, err, ok } from '../../../shared/domain';
import { can, type Permission } from '../../../shared/domain/permissions';
import type { Project } from '../domain/entities/project.entity';
import { ProjectRepository } from './ports/project.repository';

export interface ProjectGrant {
    project: Project;
    role: Role;
}

@Injectable()
export class ProjectAccess {
    constructor(private readonly workspaces: WorkspaceAccess, private readonly projects: ProjectRepository) {}

    /** The caller's role in the workspace when it has every one of `permissions`. */
    async inWorkspace(userId: UserId, workspaceId: WorkspaceId, ...permissions: Permission[]): Promise<Result<Role, DomainError>> {
        const role = await this.workspaces.roleOf(userId, workspaceId);
        if (role === undefined) return err(DomainError.notFound('Workspace'));
        if (!permissions.every(p => can(role, p))) return err(DomainError.forbidden());
        return ok(role);
    }

    /** The project and the caller's role in its workspace when the caller has every one of `permissions`. */
    async toProject(userId: UserId, projectId: ProjectId, ...permissions: Permission[]): Promise<Result<ProjectGrant, DomainError>> {
        // The only unscoped read: it tells which workspace to check. Every query after it uses project.workspaceId.
        const project = await this.projects.findById(projectId);
        if (project === undefined) return err(DomainError.notFound('Project'));
        const role = await this.workspaces.roleOf(userId, project.workspaceId);
        if (role === undefined) return err(DomainError.notFound('Project'));
        if (!permissions.every(p => can(role, p))) return err(DomainError.forbidden());
        return ok({ project, role });
    }
}
