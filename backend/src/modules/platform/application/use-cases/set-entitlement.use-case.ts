import { Injectable } from '@nestjs/common';
import { type EntitlementGrantStatus, MODULE_REGISTRY, type ModuleId } from '@contrack/contract';
import { AuditLog, Clock, UnitOfWork, WorkspaceDirectory } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { WorkspaceEntitlement } from '../../domain/entities/workspace-entitlement.entity';
import { PlatformAdminAccess } from '../platform-admin-access';
import { WorkspaceEntitlementRepository } from '../ports/workspace-entitlement.repository';
import { WorkspaceModuleStates } from '../services/workspace-module-states';
import { type AdminEntitlementView, toAdminEntitlementView } from './admin-entitlement.view';

export interface SetEntitlementInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    module: ModuleId;
    status: EntitlementGrantStatus;
    /** `trial` needs it; `revoked` ignores it. */
    expiresAt?: Date | null;
    note?: string;
}

/**
 * Platform admin sets the entitlement (layer 2) of one module of any workspace: purchased / trial / beta / revoked.
 * Not an admin → 404 `not_found`; unknown workspace → 404; a module that needs no entitlement → 422; `trial` without an
 * end → 422. The module flag cache of the workspace is invalidated, so the change is visible at once. Audited in the
 * workspace's trail as `entitlement` / `set` (entity id = the module) with the fields before and after.
 */
@Injectable()
export class SetEntitlementUseCase {
    constructor(
        private readonly admins: PlatformAdminAccess,
        private readonly workspaces: WorkspaceDirectory,
        private readonly entitlements: WorkspaceEntitlementRepository,
        private readonly states: WorkspaceModuleStates,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly audit: AuditLog,
    ) {}

    async execute(input: SetEntitlementInput): Promise<Result<AdminEntitlementView, DomainError>> {
        const allowed = await this.admins.check(input.actorId);
        if (!allowed.ok) return err(allowed.error);
        if (MODULE_REGISTRY[input.module].entitlement !== 'required') {
            return err(DomainError.unprocessable('This module needs no entitlement', { reason: 'no_entitlement_needed', module: input.module }));
        }
        const expiresAt = input.status === 'revoked' ? null : (input.expiresAt ?? null);
        if (input.status === 'trial' && expiresAt === null) return err(DomainError.validation('A trial needs an end date'));
        if (!(await this.workspaces.names([input.workspaceId])).has(input.workspaceId)) return err(DomainError.notFound('Workspace'));

        const now = this.clock.now();
        const note = (input.note ?? '').trim();
        const view = await this.uow.run(async () => {
            const existing = await this.entitlements.find(input.workspaceId, input.module);
            const before = existing === undefined
                ? { status: null, expiresAt: null, note: '' }
                : { status: existing.status, expiresAt: existing.expiresAt?.toISOString() ?? null, note: existing.note };
            let grant = existing;
            if (grant === undefined) grant = WorkspaceEntitlement.granted(input.workspaceId, input.module, input.status, expiresAt, input.actorId, note, now);
            else grant.grant(input.status, expiresAt, input.actorId, note, now);
            await this.entitlements.save(grant);
            const after = { status: grant.status, expiresAt: grant.expiresAt?.toISOString() ?? null, note: grant.note };
            await this.audit.record({
                workspaceId: input.workspaceId,
                projectId: null,
                actor: input.actorId,
                entityType: 'entitlement',
                entityId: input.module,
                action: 'set',
                data: {
                    status: [before.status, after.status],
                    expiresAt: [before.expiresAt, after.expiresAt],
                    ...(before.note === after.note ? {} : { note: [before.note, after.note] }),
                },
            });
            return toAdminEntitlementView(input.module, grant, now);
        });
        this.states.invalidate(input.workspaceId);
        return ok(view);
    }
}
