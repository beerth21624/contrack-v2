import { sql } from 'drizzle-orm';
import type { WorkspaceId } from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { WorkforceLock } from '../../application/ports/workforce-lock.port';

/** Transaction-scoped advisory lock, keyed by the workspace (released at COMMIT / ROLLBACK). */
export class DrizzleWorkforceLock extends WorkforceLock {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async lock(workspaceId: WorkspaceId): Promise<void> {
        await this.ctx.executor.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`workforce:${workspaceId}`}, 0))`);
    }
}
