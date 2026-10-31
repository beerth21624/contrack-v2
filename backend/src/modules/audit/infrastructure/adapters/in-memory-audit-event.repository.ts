import type { AuditEntry } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { type AuditEvent, type AuditEventFilter, AuditEventRepository } from '../../application/ports/audit-event.repository';

/** Array-based; stores snapshots. */
export class InMemoryAuditEventRepository extends AuditEventRepository {
    private readonly rows: AuditEvent[] = [];
    private next = 1n;

    append(entry: AuditEntry, at: Date): Promise<void> {
        this.rows.push({ ...structuredClone(entry), id: this.next, at: new Date(at) });
        this.next += 1n;
        return Promise.resolve();
    }

    list(workspaceId: WorkspaceId, filter: AuditEventFilter): Promise<AuditEvent[]> {
        const found = this.rows
            .filter(r => r.workspaceId === workspaceId
                && (filter.entityType === undefined || r.entityType === filter.entityType)
                && (filter.entityId === undefined || r.entityId === filter.entityId)
                && (filter.before === undefined || r.id < filter.before))
            .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
            .slice(0, Math.max(0, filter.limit));
        return Promise.resolve(found.map(r => ({ ...structuredClone(r), at: new Date(r.at) })));
    }
}
