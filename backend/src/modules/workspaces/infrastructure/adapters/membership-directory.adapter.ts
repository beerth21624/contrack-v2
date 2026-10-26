// ─── Shared port MembershipDirectory (used by identity for GET /me) ───
import { Injectable } from '@nestjs/common';
import { MembershipDirectory, type MembershipSummary } from '../../../../shared/application/ports';
import type { UserId } from '../../../../shared/domain/ids';
import { MembershipRepository } from '../../application/ports/membership.repository';
import { WorkspaceRepository } from '../../application/ports/workspace.repository';

@Injectable()
export class RepositoryMembershipDirectory extends MembershipDirectory {
    constructor(
        private readonly memberships: MembershipRepository,
        private readonly workspaces: WorkspaceRepository,
    ) {
        super();
    }

    /** Personal first, then oldest first (same order as GET /workspaces). */
    async listForUser(userId: UserId): Promise<MembershipSummary[]> {
        const mine = await this.memberships.listByUser(userId);
        if (mine.length === 0) return [];
        const roleOf = new Map(mine.map(m => [m.workspaceId, m.role]));
        const workspaces = (await this.workspaces.findMany(mine.map(m => m.workspaceId)))
            .sort((a, b) => Number(b.isPersonal) - Number(a.isPersonal) || a.createdAt.getTime() - b.createdAt.getTime());
        const summaries: MembershipSummary[] = [];
        for (const w of workspaces) {
            const role = roleOf.get(w.id);
            if (role !== undefined) summaries.push({ workspaceId: w.id, name: w.name.value, kind: w.kind, role });
        }
        return summaries;
    }
}
