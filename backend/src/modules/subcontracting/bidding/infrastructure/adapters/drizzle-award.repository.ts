// ─── AwardRepository on PostgreSQL (sc_awards) ───
import { and, asc, eq } from 'drizzle-orm';
import { asUserId, asWorkspaceId, type WorkspaceId } from '../../../../../shared/domain';
import type { DatabaseContext } from '../../../../../shared/infrastructure/database/database';
import { scAwards } from '../../../../../shared/infrastructure/database/schema-sc-bidding';
import { asAwardId, asBidId, asPackageId, asSubcontractId, type PackageId } from '../../../shared/ids';
import { AwardRepository, type AwardRecord } from '../../application/ports/award.repository';

export class DrizzleAwardRepository extends AwardRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(a: AwardRecord): Promise<void> {
        await this.ctx.executor.insert(scAwards).values({
            id: a.id, buyerWorkspaceId: a.buyerWorkspaceId, packageId: a.packageId, decidedBy: a.decidedBy, decidedAt: a.decidedAt,
            allocations: a.allocations, installmentsFrom: a.installmentsFrom, subcontractIds: a.subcontractIds, note: a.note,
        });
    }

    async listForPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<AwardRecord[]> {
        const rows = await this.ctx.executor.select().from(scAwards)
            .where(and(eq(scAwards.buyerWorkspaceId, buyerWorkspaceId), eq(scAwards.packageId, packageId)))
            .orderBy(asc(scAwards.decidedAt));
        return rows.map(r => ({
            id: asAwardId(r.id),
            buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
            packageId: asPackageId(r.packageId),
            decidedBy: r.decidedBy === null ? null : asUserId(r.decidedBy),
            decidedAt: r.decidedAt,
            allocations: r.allocations.map(x => ({ idx: x.idx, bidId: asBidId(x.bidId) })),
            installmentsFrom: r.installmentsFrom,
            subcontractIds: r.subcontractIds.map(asSubcontractId),
            note: r.note,
        }));
    }
}
