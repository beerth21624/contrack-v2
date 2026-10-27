// ─── Authorization of every rate-card use case ───
// Not a member of the workspace → not_found (never reveal that another tenant exists). Member without the permission →
// forbidden.
import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { WorkspaceAccess } from '../../../shared/application/ports';
import { DomainError, type Result, type UserId, type WorkspaceId, err, ok } from '../../../shared/domain';
import { can, type Permission } from '../../../shared/domain/permissions';

@Injectable()
export class RateCardAccess {
    constructor(private readonly workspaces: WorkspaceAccess) {}

    async inWorkspace(userId: UserId, workspaceId: WorkspaceId, permission: Permission): Promise<Result<Role, DomainError>> {
        const role = await this.workspaces.roleOf(userId, workspaceId);
        if (role === undefined) return err(DomainError.notFound('Workspace'));
        if (!can(role, permission)) return err(DomainError.forbidden());
        return ok(role);
    }
}
