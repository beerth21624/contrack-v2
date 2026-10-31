// ─── Stored audit events (append-only). Writes join the caller's UnitOfWork transaction. ───
import type { AuditEntry } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';

export interface AuditEvent extends AuditEntry {
    /** Increasing (bigserial). */
    id: bigint;
    at: Date;
}

export interface AuditEventFilter {
    entityType?: string;
    entityId?: string;
    /** Only events older than this id (cursor). */
    before?: bigint;
    limit: number;
}

export abstract class AuditEventRepository {
    abstract append(entry: AuditEntry, at: Date): Promise<void>;
    /** Events of one workspace, newest first. */
    abstract list(workspaceId: WorkspaceId, filter: AuditEventFilter): Promise<AuditEvent[]>;
}
