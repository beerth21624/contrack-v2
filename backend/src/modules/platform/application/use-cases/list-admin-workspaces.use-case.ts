import { Injectable } from '@nestjs/common';
import { Clock, WorkspaceDirectory } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { PlatformAdminAccess } from '../platform-admin-access';
import { WorkspaceEntitlementRepository } from '../ports/workspace-entitlement.repository';
import { ENTITLEMENT_MODULES, type AdminEntitlementView, toAdminEntitlementView } from './admin-entitlement.view';

export interface ListAdminWorkspacesInput {
    actorId: UserId;
    q?: string;
    limit: number;
}

export interface AdminWorkspaceView {
    id: WorkspaceId;
    name: string;
    kind: 'personal' | 'company';
    memberCount: number;
    createdAt: Date;
    entitlements: AdminEntitlementView[];
}

/** Platform admin: workspaces matching a search with their stored entitlement of every entitlement-bound module. */
@Injectable()
export class ListAdminWorkspacesUseCase {
    constructor(
        private readonly admins: PlatformAdminAccess,
        private readonly workspaces: WorkspaceDirectory,
        private readonly entitlements: WorkspaceEntitlementRepository,
        private readonly clock: Clock,
    ) {}

    async execute(input: ListAdminWorkspacesInput): Promise<Result<AdminWorkspaceView[], DomainError>> {
        const allowed = await this.admins.check(input.actorId);
        if (!allowed.ok) return err(allowed.error);
        const now = this.clock.now();
        const found = await this.workspaces.search(input.q ?? '', input.limit);
        const views = await Promise.all(found.map(async ws => {
            const grants = new Map((await this.entitlements.listByWorkspace(ws.id)).map(g => [g.module, g]));
            return { ...ws, entitlements: ENTITLEMENT_MODULES.map(m => toAdminEntitlementView(m, grants.get(m), now)) };
        }));
        return ok(views);
    }
}
