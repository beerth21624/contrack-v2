// ─── Shared port WorkspaceDirectory (names of buyer companies / crews for the business modules) ───
import { Injectable } from '@nestjs/common';
import { WorkspaceDirectory, type WorkspaceSummary } from '../../../../shared/application/ports';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { MembershipRepository } from '../../application/ports/membership.repository';
import { WorkspaceRepository } from '../../application/ports/workspace.repository';

@Injectable()
export class RepositoryWorkspaceDirectory extends WorkspaceDirectory {
    constructor(
        private readonly workspaces: WorkspaceRepository,
        private readonly memberships: MembershipRepository,
    ) {
        super();
    }

    async names(ids: readonly WorkspaceId[]): Promise<Map<WorkspaceId, string>> {
        const unique = [...new Set(ids)];
        if (unique.length === 0) return new Map();
        const found = await this.workspaces.findMany(unique);
        return new Map(found.map(w => [w.id, w.name.value]));
    }

    async personalWorkspaceOf(userId: UserId): Promise<WorkspaceId | undefined> {
        const mine = await this.memberships.listByUser(userId);
        if (mine.length === 0) return undefined;
        const found = await this.workspaces.findMany(mine.map(m => m.workspaceId));
        return found.find(w => w.isPersonal)?.id;
    }

    async memberIds(workspaceId: WorkspaceId): Promise<UserId[]> {
        return (await this.memberships.listByWorkspace(workspaceId)).map(m => m.userId);
    }

    async search(q: string, limit: number): Promise<WorkspaceSummary[]> {
        const found = await this.workspaces.search(q, limit);
        const counts = await this.memberships.countByWorkspaces(found.map(w => w.id));
        return found.map(w => ({ id: w.id, name: w.name.value, kind: w.kind, memberCount: counts.get(w.id) ?? 0, createdAt: w.createdAt }));
    }
}
