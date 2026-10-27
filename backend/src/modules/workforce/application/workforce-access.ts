// ─── Authorization of every workforce use case ───
// Not a member of the workspace (or of the project's workspace) → not_found (never reveal that another tenant exists).
// Member without the permission → forbidden.
import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { ProjectStatusLookup, WorkspaceAccess } from '../../../shared/application/ports';
import { DomainError, type ProjectId, type Result, type UserId, type WorkspaceId, err, ok } from '../../../shared/domain';
import { can, type Permission } from '../../../shared/domain/permissions';

export interface ProjectGrant {
    role: Role;
    workspaceId: WorkspaceId;
    archived: boolean;
}

export const projectArchived = (): DomainError => DomainError.conflict('The project is archived; restore it to edit');

@Injectable()
export class WorkforceAccess {
    constructor(private readonly workspaces: WorkspaceAccess, private readonly projects: ProjectStatusLookup) {}

    async inWorkspace(userId: UserId, workspaceId: WorkspaceId, permission: Permission): Promise<Result<Role, DomainError>> {
        const role = await this.workspaces.roleOf(userId, workspaceId);
        if (role === undefined) return err(DomainError.notFound('Workspace'));
        if (!can(role, permission)) return err(DomainError.forbidden());
        return ok(role);
    }

    /** The project's workspace and state, and the caller's role there, when the caller has `permission`. */
    async toProject(userId: UserId, projectId: ProjectId, permission: Permission): Promise<Result<ProjectGrant, DomainError>> {
        const project = await this.projects.find(projectId);
        if (project === undefined) return err(DomainError.notFound('Project'));
        const role = await this.workspaces.roleOf(userId, project.workspaceId);
        if (role === undefined) return err(DomainError.notFound('Project'));
        if (!can(role, permission)) return err(DomainError.forbidden());
        return ok({ role, workspaceId: project.workspaceId, archived: project.archived });
    }

    /** A project named in a request body: it must belong to `workspaceId` (else not_found) and not be archived. */
    async projectOfWorkspace(workspaceId: WorkspaceId, projectId: ProjectId): Promise<Result<undefined, DomainError>> {
        const project = await this.projects.find(projectId);
        if (project?.workspaceId !== workspaceId) return err(DomainError.notFound('Project'));
        if (project.archived) return err(projectArchived());
        return ok(undefined);
    }

    /** The ids among `projectIds` that are projects of `workspaceId` and not archived. */
    async activeProjectsOf(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Set<ProjectId>> {
        const found = await Promise.all(projectIds.map(async id => ({ id, project: await this.projects.find(id) })));
        return new Set(found.filter(f => f.project?.workspaceId === workspaceId && !f.project.archived).map(f => f.id));
    }
}
