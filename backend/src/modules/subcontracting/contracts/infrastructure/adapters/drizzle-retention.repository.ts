import { asc, inArray } from 'drizzle-orm';
import { asUserId, asWorkspaceId } from '../../../../../shared/domain';
import type { DatabaseContext } from '../../../../../shared/infrastructure/database/database';
import { scRetentionEntries } from '../../../../../shared/infrastructure/database/schema-sc-contracts';
import { asClaimId, asRetentionEntryId, asSubcontractId, type SubcontractId } from '../../../shared/ids';
import { RetentionRepository } from '../../application/ports/retention.repository';
import type { RetentionEntry } from '../../domain/entities/contract-records.entity';

export class DrizzleRetentionRepository extends RetentionRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(entry: RetentionEntry): Promise<void> {
        await this.ctx.executor.insert(scRetentionEntries).values({ ...entry });
    }

    async listBySubcontracts(ids: readonly SubcontractId[]): Promise<RetentionEntry[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(scRetentionEntries)
            .where(inArray(scRetentionEntries.subcontractId, [...ids])).orderBy(asc(scRetentionEntries.createdAt));
        return rows.map(r => ({
            id: asRetentionEntryId(r.id),
            subcontractId: asSubcontractId(r.subcontractId),
            buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
            kind: r.kind,
            amount: r.amount,
            claimId: r.claimId === null ? null : asClaimId(r.claimId),
            note: r.note,
            createdBy: r.createdBy === null ? null : asUserId(r.createdBy),
            createdAt: r.createdAt,
        }));
    }
}
