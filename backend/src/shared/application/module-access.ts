// ─── Authorization of every ERP use case (docs/erp/01-architecture.md §1.3) ───
// Always in this order: not a member of the workspace (or of the project's workspace) → not_found (never reveal that
// another tenant exists); the module not active for that workspace (any of the four flag layers) → module_disabled;
// the role lacks a permission → forbidden. Provided (and exported) by the platform module.
import { Injectable } from '@nestjs/common';
import type { ModuleId, Role } from '@contrack/contract';
import { DomainError } from '../domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../domain/ids';
import { type Permission, can } from '../domain/permissions';
import { type Result, err, ok } from '../domain/result';
import { ModuleFlags, ProjectStatusLookup, WorkspaceAccess, WorkspaceDirectory } from './ports';

export interface WorkspaceGrant {
    workspaceId: WorkspaceId;
    role: Role;
    /** Members of the workspace (1 = working alone: screens hide "send for approval"; approvals decide the real skip). */
    memberCount: number;
}

export interface ProjectGrant extends WorkspaceGrant {
    projectId: ProjectId;
    archived: boolean;
}

export const erpModuleDisabled = (module: ModuleId): DomainError =>
    new DomainError('module_disabled', `The module "${module}" is switched off`);

export const erpProjectArchived = (): DomainError =>
    DomainError.conflict('The project is archived; restore it to edit', { reason: 'project_archived' });

@Injectable()
export class ModuleAccess {
    constructor(
        private readonly workspaces: WorkspaceAccess,
        private readonly projects: ProjectStatusLookup,
        private readonly flags: ModuleFlags,
        private readonly members: WorkspaceDirectory,
    ) {}

    /** not_found (not a member) → module_disabled (module not active) → forbidden (a permission missing). */
    async inWorkspace(
        userId: UserId, workspaceId: WorkspaceId, module: ModuleId, ...permissions: Permission[]
    ): Promise<Result<WorkspaceGrant, DomainError>> {
        const role = await this.workspaces.roleOf(userId, workspaceId);
        if (role === undefined) return err(DomainError.notFound('Workspace'));
        return this.grant(role, workspaceId, module, permissions);
    }

    /** Same, starting from a project; `write` on an archived project → conflict `project_archived` (after the rest). */
    async toProject(
        userId: UserId, projectId: ProjectId, module: ModuleId, opts: { permissions: Permission[]; write: boolean },
    ): Promise<Result<ProjectGrant, DomainError>> {
        const project = await this.projects.find(projectId);
        if (project === undefined) return err(DomainError.notFound('Project'));
        const role = await this.workspaces.roleOf(userId, project.workspaceId);
        if (role === undefined) return err(DomainError.notFound('Project'));
        const grant = await this.grant(role, project.workspaceId, module, opts.permissions);
        if (!grant.ok) return grant;
        if (opts.write && project.archived) return err(erpProjectArchived());
        return ok({ ...grant.value, projectId, archived: project.archived });
    }

    private async grant(
        role: Role, workspaceId: WorkspaceId, module: ModuleId, permissions: readonly Permission[],
    ): Promise<Result<WorkspaceGrant, DomainError>> {
        if (!(await this.flags.isEnabled(workspaceId, module))) return err(erpModuleDisabled(module));
        if (!permissions.every(p => can(role, p))) return err(DomainError.forbidden());
        const memberCount = (await this.members.memberIds(workspaceId)).length;
        return ok({ workspaceId, role, memberCount });
    }
}
