// ─── Shared port WorkspaceAccess (used by projects and realtime for authorization) ───
import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { WorkspaceAccess } from '../../../../shared/application/ports';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { MembershipRepository } from '../../application/ports/membership.repository';

@Injectable()
export class RepositoryWorkspaceAccess extends WorkspaceAccess {
    constructor(private readonly memberships: MembershipRepository) {
        super();
    }

    async roleOf(userId: UserId, workspaceId: WorkspaceId): Promise<Role | undefined> {
        return (await this.memberships.find(workspaceId, userId))?.role;
    }
}
