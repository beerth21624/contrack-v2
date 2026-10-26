// ─── May this user watch this project live? (projects.read in the project's workspace) ───
import { Injectable } from '@nestjs/common';
import { ProjectDirectory, UserDirectory, WorkspaceAccess } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';

export interface ProjectViewer {
    readonly userId: UserId;
    readonly displayName: string;
}

const UNKNOWN_NAME = 'Unknown user';

@Injectable()
export class ProjectViewAccess {
    constructor(
        private readonly projects: ProjectDirectory,
        private readonly access: WorkspaceAccess,
        private readonly users: UserDirectory,
    ) {}

    async canView(userId: UserId, projectId: ProjectId): Promise<boolean> {
        const workspaceId = await this.projects.workspaceOf(projectId);
        if (workspaceId === undefined) return false;
        const role = await this.access.roleOf(userId, workspaceId);
        return role !== undefined && can(role, 'projects.read');
    }

    /** The viewer with their display name, or not_found (never reveals that another tenant's project exists). */
    async authorize(userId: UserId, projectId: ProjectId): Promise<Result<ProjectViewer, DomainError>> {
        if (!(await this.canView(userId, projectId))) return err(DomainError.notFound('Project'));
        const profile = (await this.users.findMany([userId])).get(userId);
        return ok({ userId, displayName: profile?.displayName ?? UNKNOWN_NAME });
    }
}
