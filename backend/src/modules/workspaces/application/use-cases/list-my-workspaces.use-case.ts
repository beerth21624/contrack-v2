import { Injectable } from '@nestjs/common';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import { type Result, ok } from '../../../../shared/domain/result';
import { MembershipRepository } from '../ports/membership.repository';
import { WorkspaceRepository } from '../ports/workspace.repository';
import type { WorkspaceView } from './get-workspace.use-case';

export interface ListMyWorkspacesInput {
    actorId: UserId;
}

/** Every workspace of the caller with their role and the member count; personal first, then oldest first. */
@Injectable()
export class ListMyWorkspacesUseCase {
    constructor(
        private readonly workspaces: WorkspaceRepository,
        private readonly memberships: MembershipRepository,
    ) {}

    async execute(input: ListMyWorkspacesInput): Promise<Result<WorkspaceView[], DomainError>> {
        const mine = await this.memberships.listByUser(input.actorId);
        if (mine.length === 0) return ok([]);
        const ids = mine.map(m => m.workspaceId);
        const [workspaces, counts] = await Promise.all([this.workspaces.findMany(ids), this.memberships.countByWorkspaces(ids)]);
        const roleOf = new Map(mine.map(m => [m.workspaceId, m.role]));
        const views: WorkspaceView[] = [];
        for (const workspace of workspaces) {
            const role = roleOf.get(workspace.id);
            if (role === undefined) continue;
            views.push({ workspace, role, memberCount: counts.get(workspace.id) ?? 0 });
        }
        views.sort((a, b) =>
            Number(b.workspace.isPersonal) - Number(a.workspace.isPersonal)
            || a.workspace.createdAt.getTime() - b.workspace.createdAt.getTime()
            || a.workspace.name.value.localeCompare(b.workspace.name.value));
        return ok(views);
    }
}
