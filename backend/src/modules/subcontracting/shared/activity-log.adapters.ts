// ─── ScActivityLog adapters (in-memory for tests / PERSISTENCE=memory, Drizzle for Postgres) ───
import { and, desc, eq } from 'drizzle-orm';
import { asUserId, asWorkspaceId } from '../../../shared/domain';
import type { DatabaseContext } from '../../../shared/infrastructure/database/database';
import { scActivity } from '../../../shared/infrastructure/database/schema-sc-shared';
import { ScActivityLog, type ScActivityRecord } from './ports';

export class InMemoryScActivityLog extends ScActivityLog {
    readonly rows: ScActivityRecord[] = [];

    record(entry: ScActivityRecord): Promise<void> {
        this.rows.push({ ...entry, at: new Date(entry.at.getTime()) });
        return Promise.resolve();
    }

    listForEntity(entity: ScActivityRecord['entity'], entityId: string, limit: number): Promise<ScActivityRecord[]> {
        return Promise.resolve(this.rows.filter(r => r.entity === entity && r.entityId === entityId).reverse().slice(0, limit));
    }
}

export class DrizzleScActivityLog extends ScActivityLog {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async record(entry: ScActivityRecord): Promise<void> {
        await this.ctx.executor.insert(scActivity).values({
            buyerWorkspaceId: entry.buyerWorkspaceId,
            vendorWorkspaceId: entry.vendorWorkspaceId ?? null,
            entity: entry.entity,
            entityId: entry.entityId,
            action: entry.action,
            actorUserId: entry.actorUserId,
            data: entry.data ?? null,
            at: entry.at,
        });
    }

    async listForEntity(entity: ScActivityRecord['entity'], entityId: string, limit: number): Promise<ScActivityRecord[]> {
        const rows = await this.ctx.executor.select().from(scActivity)
            .where(and(eq(scActivity.entity, entity), eq(scActivity.entityId, entityId)))
            .orderBy(desc(scActivity.id)).limit(limit);
        return rows.map(r => ({
            buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
            vendorWorkspaceId: r.vendorWorkspaceId === null ? null : asWorkspaceId(r.vendorWorkspaceId),
            entity: r.entity,
            entityId: r.entityId,
            action: r.action,
            actorUserId: r.actorUserId === null ? null : asUserId(r.actorUserId),
            ...(r.data === null ? {} : { data: r.data }),
            at: r.at,
        }));
    }
}
