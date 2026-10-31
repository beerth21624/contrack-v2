import { type SQL, and, desc, eq, lt } from 'drizzle-orm';
import type { AuditEntry } from '../../../../shared/application/ports';
import { type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { auditEvents } from '../../../../shared/infrastructure/database/schema-erp-core';
import { type AuditEvent, type AuditEventFilter, AuditEventRepository } from '../../application/ports/audit-event.repository';

type Row = typeof auditEvents.$inferSelect;

const toEvent = (row: Row): AuditEvent => ({
    id: row.id,
    workspaceId: asWorkspaceId(row.workspaceId),
    projectId: row.projectId === null ? null : asProjectId(row.projectId),
    actor: row.actorUserId === null ? null : asUserId(row.actorUserId),
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    data: row.data,
    at: row.at,
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. Every query filters by `workspace_id`. */
export class DrizzleAuditEventRepository extends AuditEventRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async append(entry: AuditEntry, at: Date): Promise<void> {
        await this.ctx.executor.insert(auditEvents).values({
            workspaceId: entry.workspaceId,
            projectId: entry.projectId,
            actorUserId: entry.actor,
            entityType: entry.entityType,
            entityId: entry.entityId,
            action: entry.action,
            data: entry.data,
            at,
        });
    }

    async list(workspaceId: WorkspaceId, filter: AuditEventFilter): Promise<AuditEvent[]> {
        const conditions: SQL[] = [eq(auditEvents.workspaceId, workspaceId)];
        if (filter.entityType !== undefined) conditions.push(eq(auditEvents.entityType, filter.entityType));
        if (filter.entityId !== undefined) conditions.push(eq(auditEvents.entityId, filter.entityId));
        if (filter.before !== undefined) conditions.push(lt(auditEvents.id, filter.before));
        const rows = await this.ctx.executor.select().from(auditEvents)
            .where(and(...conditions))
            .orderBy(desc(auditEvents.id))
            .limit(Math.max(0, filter.limit));
        return rows.map(toEvent);
    }
}
