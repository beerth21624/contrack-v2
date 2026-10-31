// ─── Shared port AuditLog (docs/erp/01-architecture.md §10): every module records its money / status actions here ───
import { Injectable } from '@nestjs/common';
import { type AuditEntry, AuditLog, Clock } from '../../../../shared/application/ports';
import { AuditEventRepository } from '../../application/ports/audit-event.repository';

/** Appends one event, stamped with the clock; joins the caller's transaction. Never gated by module flags. */
@Injectable()
export class RepositoryAuditLog extends AuditLog {
    constructor(private readonly events: AuditEventRepository, private readonly clock: Clock) {
        super();
    }

    async record(e: AuditEntry): Promise<void> {
        await this.events.append(e, this.clock.now());
    }
}
