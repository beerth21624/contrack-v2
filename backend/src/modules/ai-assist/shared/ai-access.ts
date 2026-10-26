// ─── Authorization of every ai-assist use case (one place, like subcontracting/shared/sc-access.ts) ───
// Member of the workspace → module switched on for it. Any member may ask (the answers are proposals the user
// confirms; nothing is written). Not a member → not_found (never reveal another tenant's data). Module off → module_disabled.
import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { ModuleFlags, WorkspaceAccess } from '../../../shared/application/ports';
import { DomainError, type Result, type UserId, type WorkspaceId, err, ok } from '../../../shared/domain';

export const MODULE = 'ai-assist' as const;

export function moduleDisabled(): DomainError {
    return new DomainError('module_disabled', 'The AI assist module is switched off');
}

@Injectable()
export class AiAccess {
    constructor(private readonly workspaces: WorkspaceAccess, private readonly flags: ModuleFlags) {}

    /** The caller's role in the workspace when it is a member and the module is on for that workspace. */
    async member(userId: UserId, workspaceId: WorkspaceId): Promise<Result<Role, DomainError>> {
        const role = await this.workspaces.roleOf(userId, workspaceId);
        if (role === undefined) return err(DomainError.notFound('Workspace'));
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return err(moduleDisabled());
        return ok(role);
    }
}
