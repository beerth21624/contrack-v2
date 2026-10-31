import { desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { type WorkspaceId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { workspaces } from '../../../../shared/infrastructure/database/schema';
import { WorkspaceRepository } from '../../application/ports/workspace.repository';
import { Workspace } from '../../domain/entities/workspace.entity';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.value-object';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = typeof workspaces.$inferSelect;

const toEntity = (row: Row): Workspace => Workspace.rehydrate({
    id: asWorkspaceId(row.id),
    name: WorkspaceName.rehydrate(row.name),
    kind: row.kind,
    createdAt: row.createdAt,
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. The workspace id is the tenant key. */
export class DrizzleWorkspaceRepository extends WorkspaceRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findById(id: WorkspaceId): Promise<Workspace | undefined> {
        const [row] = await this.ctx.executor.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
        return row === undefined ? undefined : toEntity(row);
    }

    async findMany(ids: readonly WorkspaceId[]): Promise<Workspace[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(workspaces).where(inArray(workspaces.id, [...new Set(ids)]));
        return rows.map(toEntity);
    }

    async search(q: string, limit: number): Promise<Workspace[]> {
        const needle = q.trim();
        // `%`, `_` and `\` in the text are literal characters, not wildcards.
        const pattern = `%${needle.replace(/[\\%_]/g, c => `\\${c}`)}%`;
        const byName = ilike(workspaces.name, pattern);
        const where = needle === '' ? undefined : (UUID.test(needle) ? or(byName, eq(workspaces.id, needle.toLowerCase())) : byName);
        const rows = await this.ctx.executor.select().from(workspaces).where(where).orderBy(desc(workspaces.createdAt), workspaces.id).limit(limit);
        return rows.map(toEntity);
    }

    async insert(workspace: Workspace): Promise<void> {
        await this.ctx.executor.insert(workspaces).values({
            id: workspace.id,
            name: workspace.name.value,
            kind: workspace.kind,
            createdAt: workspace.createdAt,
        });
    }

    async update(workspace: Workspace): Promise<void> {
        await this.ctx.executor.update(workspaces).set({ name: workspace.name.value }).where(eq(workspaces.id, workspace.id));
    }

    async delete(id: WorkspaceId): Promise<void> {
        await this.ctx.executor.delete(workspaces).where(eq(workspaces.id, id));
    }
}
