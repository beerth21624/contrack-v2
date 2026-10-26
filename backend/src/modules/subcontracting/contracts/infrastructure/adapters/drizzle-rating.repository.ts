import { and, eq, inArray } from 'drizzle-orm';
import { asUserId, asWorkspaceId, type WorkspaceId } from '../../../../../shared/domain';
import type { DatabaseContext } from '../../../../../shared/infrastructure/database/database';
import { scRatings } from '../../../../../shared/infrastructure/database/schema-sc-contracts';
import { asRatingId, asSubcontractId, type SubcontractId } from '../../../shared/ids';
import { RatingRepository } from '../../application/ports/rating.repository';
import type { Side } from '../../domain/entities/claim.entity';
import type { Rating } from '../../domain/entities/contract-records.entity';

type Row = typeof scRatings.$inferSelect;

function toRating(r: Row): Rating {
    return {
        id: asRatingId(r.id),
        subcontractId: asSubcontractId(r.subcontractId),
        buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
        fromSide: r.fromSide,
        fromWorkspaceId: asWorkspaceId(r.fromWorkspaceId),
        toWorkspaceId: r.toWorkspaceId === null ? null : asWorkspaceId(r.toWorkspaceId),
        scores: r.scores,
        comment: r.comment,
        createdBy: asUserId(r.createdBy),
        createdAt: r.createdAt,
    };
}

export class DrizzleRatingRepository extends RatingRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(rating: Rating): Promise<boolean> {
        const rows = await this.ctx.executor.insert(scRatings).values({ ...rating }).onConflictDoNothing().returning({ id: scRatings.id });
        return rows.length > 0;
    }

    async find(subcontractId: SubcontractId, fromSide: Side): Promise<Rating | undefined> {
        const rows = await this.ctx.executor.select().from(scRatings)
            .where(and(eq(scRatings.subcontractId, subcontractId), eq(scRatings.fromSide, fromSide))).limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toRating(row);
    }

    async listGivenByBuyer(buyerWorkspaceId: WorkspaceId, vendorWorkspaceIds: readonly WorkspaceId[]): Promise<Rating[]> {
        if (vendorWorkspaceIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(scRatings).where(and(
            eq(scRatings.buyerWorkspaceId, buyerWorkspaceId),
            eq(scRatings.fromSide, 'buyer'),
            inArray(scRatings.toWorkspaceId, [...vendorWorkspaceIds]),
        ));
        return rows.map(toRating);
    }
}
