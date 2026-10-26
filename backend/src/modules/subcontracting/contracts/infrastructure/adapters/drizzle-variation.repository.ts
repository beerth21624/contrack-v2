import { asc, eq, inArray } from 'drizzle-orm';
import { asUserId, asWorkspaceId } from '../../../../../shared/domain';
import type { DatabaseContext } from '../../../../../shared/infrastructure/database/database';
import { scVariations } from '../../../../../shared/infrastructure/database/schema-sc-contracts';
import { asSubcontractId, asVariationId, type SubcontractId, type VariationId } from '../../../shared/ids';
import { VariationRepository } from '../../application/ports/variation.repository';
import { Variation } from '../../domain/entities/variation.entity';

type Row = typeof scVariations.$inferSelect;

function toEntity(r: Row): Variation {
    return Variation.rehydrate({
        id: asVariationId(r.id),
        subcontractId: asSubcontractId(r.subcontractId),
        buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
        proposedBy: r.proposedBy,
        proposedByUser: asUserId(r.proposedByUser),
        lines: r.lines,
        amount: r.amount,
        reason: r.reason,
        status: r.status,
        decidedBy: r.decidedBy === null ? null : asUserId(r.decidedBy),
        decidedAt: r.decidedAt,
        createdAt: r.createdAt,
    });
}

export class DrizzleVariationRepository extends VariationRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(variation: Variation): Promise<void> {
        await this.ctx.executor.insert(scVariations).values(variation.toProps());
    }

    async update(variation: Variation): Promise<void> {
        const p = variation.toProps();
        await this.ctx.executor.update(scVariations).set({ status: p.status, decidedBy: p.decidedBy, decidedAt: p.decidedAt })
            .where(eq(scVariations.id, p.id));
    }

    async findById(id: VariationId): Promise<Variation | undefined> {
        const rows = await this.ctx.executor.select().from(scVariations).where(eq(scVariations.id, id)).limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async listBySubcontracts(ids: readonly SubcontractId[]): Promise<Variation[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(scVariations)
            .where(inArray(scVariations.subcontractId, [...ids])).orderBy(asc(scVariations.createdAt));
        return rows.map(toEntity);
    }
}
