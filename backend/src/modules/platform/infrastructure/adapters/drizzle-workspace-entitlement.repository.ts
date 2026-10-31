import { and, eq } from 'drizzle-orm';
import { MODULE_IDS, type ModuleId } from '@contrack/contract';
import { type WorkspaceId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { workspaceEntitlements } from '../../../../shared/infrastructure/database/schema-platform';
import { WorkspaceEntitlementRepository } from '../../application/ports/workspace-entitlement.repository';
import { WorkspaceEntitlement } from '../../domain/entities/workspace-entitlement.entity';

type Row = typeof workspaceEntitlements.$inferSelect;

const KNOWN = new Set<string>(MODULE_IDS);

/** Rows of modules this code no longer knows are ignored (never deleted). */
const toEntity = (row: Row): WorkspaceEntitlement | undefined => (KNOWN.has(row.module)
    ? WorkspaceEntitlement.rehydrate({
        workspaceId: asWorkspaceId(row.workspaceId),
        module: row.module as ModuleId,
        status: row.status,
        startsAt: row.startsAt,
        expiresAt: row.expiresAt,
        trialUsedAt: row.trialUsedAt,
        grantedBy: row.grantedBy === null ? null : asUserId(row.grantedBy),
        note: row.note,
        updatedAt: row.updatedAt,
    })
    : undefined);

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. Every query filters by `workspace_id`. */
export class DrizzleWorkspaceEntitlementRepository extends WorkspaceEntitlementRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(workspaceId: WorkspaceId, module: ModuleId): Promise<WorkspaceEntitlement | undefined> {
        const [row] = await this.ctx.executor.select().from(workspaceEntitlements)
            .where(and(eq(workspaceEntitlements.workspaceId, workspaceId), eq(workspaceEntitlements.module, module)))
            .limit(1);
        return row === undefined ? undefined : toEntity(row);
    }

    async listByWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceEntitlement[]> {
        const rows = await this.ctx.executor.select().from(workspaceEntitlements).where(eq(workspaceEntitlements.workspaceId, workspaceId));
        return rows.map(toEntity).filter((e): e is WorkspaceEntitlement => e !== undefined);
    }

    async save(entry: WorkspaceEntitlement): Promise<void> {
        const p = entry.toProps();
        const values = {
            status: p.status, startsAt: p.startsAt, expiresAt: p.expiresAt, trialUsedAt: p.trialUsedAt,
            grantedBy: p.grantedBy, note: p.note, updatedAt: p.updatedAt,
        };
        await this.ctx.executor.insert(workspaceEntitlements)
            .values({ workspaceId: p.workspaceId, module: p.module, ...values })
            .onConflictDoUpdate({ target: [workspaceEntitlements.workspaceId, workspaceEntitlements.module], set: values });
    }
}
