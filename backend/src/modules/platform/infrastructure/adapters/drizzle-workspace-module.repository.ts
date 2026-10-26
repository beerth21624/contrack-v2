import { and, eq } from 'drizzle-orm';
import { MODULE_IDS, type ModuleId } from '@contrack/contract';
import { type WorkspaceId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { workspaceModules } from '../../../../shared/infrastructure/database/schema-platform';
import { WorkspaceModuleRepository } from '../../application/ports/workspace-module.repository';
import { WorkspaceModule } from '../../domain/entities/workspace-module.entity';

type Row = typeof workspaceModules.$inferSelect;

const KNOWN = new Set<string>(MODULE_IDS);

/** Rows of modules this code no longer knows are ignored (never deleted). */
const toEntity = (row: Row): WorkspaceModule | undefined => (KNOWN.has(row.module)
    ? WorkspaceModule.rehydrate({
        workspaceId: asWorkspaceId(row.workspaceId),
        module: row.module as ModuleId,
        enabled: row.enabled,
        settings: row.settings,
        enabledBy: row.enabledBy === null ? null : asUserId(row.enabledBy),
        enabledAt: row.enabledAt,
    })
    : undefined);

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. Every query filters by `workspace_id`. */
export class DrizzleWorkspaceModuleRepository extends WorkspaceModuleRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(workspaceId: WorkspaceId, module: ModuleId): Promise<WorkspaceModule | undefined> {
        const [row] = await this.ctx.executor.select().from(workspaceModules)
            .where(and(eq(workspaceModules.workspaceId, workspaceId), eq(workspaceModules.module, module)))
            .limit(1);
        return row === undefined ? undefined : toEntity(row);
    }

    async listByWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceModule[]> {
        const rows = await this.ctx.executor.select().from(workspaceModules).where(eq(workspaceModules.workspaceId, workspaceId));
        return rows.map(toEntity).filter((e): e is WorkspaceModule => e !== undefined);
    }

    async save(entry: WorkspaceModule): Promise<void> {
        const p = entry.toProps();
        const values = { enabled: p.enabled, settings: p.settings, enabledBy: p.enabledBy, enabledAt: p.enabledAt };
        await this.ctx.executor.insert(workspaceModules)
            .values({ workspaceId: p.workspaceId, module: p.module, ...values })
            .onConflictDoUpdate({ target: [workspaceModules.workspaceId, workspaceModules.module], set: values });
    }
}
