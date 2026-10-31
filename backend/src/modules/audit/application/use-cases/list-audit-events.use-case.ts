import { Injectable } from '@nestjs/common';
import { ModuleAccess } from '../../../../shared/application/module-access';
import { UserDirectory, type UserProfile } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, ok } from '../../../../shared/domain/result';
import { type AuditEvent, AuditEventRepository } from '../ports/audit-event.repository';

export interface ListAuditEventsInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    entityType?: string;
    entityId?: string;
    /** Cursor: id of the oldest event already shown. */
    before?: string;
    limit: number;
}

export interface AuditEventView extends AuditEvent {
    actorName: string | null;
}

export interface AuditPage {
    items: AuditEventView[];
    nextBefore: string | null;
}

/** GET /workspaces/:workspaceId/audit: `project-hub` active and `audit.read`; newest first, cursor-paged by id. */
@Injectable()
export class ListAuditEventsUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly events: AuditEventRepository,
        private readonly users: UserDirectory,
    ) {}

    async execute(input: ListAuditEventsInput): Promise<Result<AuditPage, DomainError>> {
        const grant = await this.access.inWorkspace(input.userId, input.workspaceId, 'project-hub', 'audit.read');
        if (!grant.ok) return grant;
        const limit = Math.max(1, Math.min(200, Math.trunc(input.limit)));
        const rows = await this.events.list(input.workspaceId, {
            entityType: input.entityType,
            entityId: input.entityId,
            before: input.before === undefined ? undefined : BigInt(input.before),
            limit: limit + 1,
        });
        const page = rows.slice(0, limit);
        const actors = [...new Set(page.map(e => e.actor).filter((a): a is UserId => a !== null))];
        const names = actors.length === 0 ? new Map<UserId, UserProfile>() : await this.users.findMany(actors);
        const last = page.at(-1);
        return ok({
            items: page.map(e => ({ ...e, actorName: e.actor === null ? null : (names.get(e.actor)?.displayName ?? null) })),
            nextBefore: rows.length > limit && last !== undefined ? last.id.toString() : null,
        });
    }
}
