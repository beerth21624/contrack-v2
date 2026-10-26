import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { asRateCardId, asUserId, asWorkspaceId, type RateCardId, type WorkspaceId } from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { rateCards } from '../../../../shared/infrastructure/database/schema';
import { RateCardRepository } from '../../application/ports/rate-card.repository';
import { RateCard } from '../../domain/entities/rate-card.entity';
import { DailyRate } from '../../domain/value-objects/daily-rate.value-object';
import { RateCardName } from '../../domain/value-objects/rate-card-name.value-object';

type RateCardRow = typeof rateCards.$inferSelect;

function toEntity(row: RateCardRow): RateCard {
    const name = RateCardName.create(row.name);
    const skilled = DailyRate.create(row.skilledRate, 'skilled');
    const labourer = DailyRate.create(row.labourerRate, 'labourer');
    if (!name.ok || !skilled.ok || !labourer.ok) throw new Error(`rate card ${row.id} has invalid stored values`);
    return RateCard.rehydrate({
        id: asRateCardId(row.id),
        workspaceId: asWorkspaceId(row.workspaceId),
        name: name.value,
        skilledRate: skilled.value,
        labourerRate: labourer.value,
        note: row.note,
        createdBy: asUserId(row.createdBy),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        archivedAt: row.archivedAt,
    });
}

function toRow(card: RateCard): RateCardRow {
    const c = card.toProps();
    return {
        id: c.id,
        workspaceId: c.workspaceId,
        name: c.name.value,
        skilledRate: c.skilledRate.baht,
        labourerRate: c.labourerRate.baht,
        note: c.note,
        createdBy: c.createdBy,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        archivedAt: c.archivedAt,
    };
}

export class DrizzleRateCardRepository extends RateCardRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    /** Transaction-scoped advisory lock, keyed by the workspace (released at COMMIT / ROLLBACK). */
    async lockLibrary(workspaceId: WorkspaceId): Promise<void> {
        await this.ctx.executor.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`rate_cards:${workspaceId}`}, 0))`);
    }

    async insert(card: RateCard): Promise<void> {
        await this.ctx.executor.insert(rateCards).values(toRow(card));
    }

    async find(workspaceId: WorkspaceId, id: RateCardId): Promise<RateCard | undefined> {
        const rows = await this.ctx.executor.select().from(rateCards)
            .where(and(eq(rateCards.workspaceId, workspaceId), eq(rateCards.id, id)))
            .limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async findMany(workspaceId: WorkspaceId, ids: readonly RateCardId[]): Promise<RateCard[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(rateCards)
            .where(and(eq(rateCards.workspaceId, workspaceId), inArray(rateCards.id, [...ids])));
        return rows.map(toEntity);
    }

    async listActive(workspaceId: WorkspaceId): Promise<RateCard[]> {
        const rows = await this.ctx.executor.select().from(rateCards)
            .where(and(eq(rateCards.workspaceId, workspaceId), isNull(rateCards.archivedAt)))
            .orderBy(asc(rateCards.createdAt), asc(rateCards.id));
        return rows.map(toEntity);
    }

    async countActive(workspaceId: WorkspaceId): Promise<number> {
        const rows = await this.ctx.executor.select({ n: count() }).from(rateCards)
            .where(and(eq(rateCards.workspaceId, workspaceId), isNull(rateCards.archivedAt)));
        return rows[0]?.n ?? 0;
    }

    async findActiveByName(workspaceId: WorkspaceId, name: RateCardName): Promise<RateCard | undefined> {
        const rows = await this.ctx.executor.select().from(rateCards)
            .where(and(
                eq(rateCards.workspaceId, workspaceId),
                isNull(rateCards.archivedAt),
                // The expression of the rate_cards_name_key unique index.
                sql`lower(${rateCards.name}) = lower(${name.value})`,
            ))
            .limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async update(card: RateCard): Promise<void> {
        const row = toRow(card);
        await this.ctx.executor.update(rateCards)
            .set({
                name: row.name,
                skilledRate: row.skilledRate,
                labourerRate: row.labourerRate,
                note: row.note,
                updatedAt: row.updatedAt,
                archivedAt: row.archivedAt,
            })
            .where(and(eq(rateCards.workspaceId, row.workspaceId), eq(rateCards.id, row.id)));
    }
}
