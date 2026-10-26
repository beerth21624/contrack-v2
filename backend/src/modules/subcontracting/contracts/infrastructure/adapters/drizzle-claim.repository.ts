import { asc, eq, inArray } from 'drizzle-orm';
import { asUserId, asWorkspaceId } from '../../../../../shared/domain';
import type { DatabaseContext } from '../../../../../shared/infrastructure/database/database';
import { scClaims } from '../../../../../shared/infrastructure/database/schema-sc-contracts';
import { asClaimId, asSubcontractId, type ClaimId, type SubcontractId } from '../../../shared/ids';
import { ClaimRepository } from '../../application/ports/claim.repository';
import { Claim, type ClaimProps } from '../../domain/entities/claim.entity';

type Row = typeof scClaims.$inferSelect;

function toEntity(r: Row): Claim {
    return Claim.rehydrate({
        id: asClaimId(r.id),
        subcontractId: asSubcontractId(r.subcontractId),
        buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
        installmentNo: r.installmentNo,
        condition: r.condition,
        status: r.status,
        requestedBy: r.requestedBy,
        requestedByUser: asUserId(r.requestedByUser),
        requestedAt: r.requestedAt,
        photoFileIds: r.photoFileIds,
        note: r.note,
        inspection: r.inspection === null ? null : { ...r.inspection, byUserId: asUserId(r.inspection.byUserId), at: new Date(r.inspection.at) },
        amounts: {
            gross: r.grossAmount, adjustments: r.adjustments, retention: r.retentionAmount, wht: r.whtAmount, vat: r.vatAmount,
            net: r.netAmount,
        },
        approvedBy: r.approvedBy === null ? null : asUserId(r.approvedBy),
        approvedAt: r.approvedAt,
        paidAt: r.paidAt,
        paidAmount: r.paidAmount,
        paidChannel: r.paidChannel,
        paidRef: r.paidRef,
        paidBy: r.paidBy === null ? null : asUserId(r.paidBy),
        rejectedReason: r.rejectedReason,
        rejectedAt: r.rejectedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
    });
}

function toRow(p: ClaimProps): typeof scClaims.$inferInsert {
    const { amounts, inspection, ...rest } = p;
    return {
        ...rest,
        inspection: inspection === null ? null : { ...inspection, at: inspection.at.toISOString() },
        grossAmount: amounts.gross,
        adjustments: amounts.adjustments,
        retentionAmount: amounts.retention,
        whtAmount: amounts.wht,
        vatAmount: amounts.vat,
        netAmount: amounts.net,
    };
}

export class DrizzleClaimRepository extends ClaimRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(claim: Claim): Promise<void> {
        await this.ctx.executor.insert(scClaims).values(toRow(claim.toProps()));
    }

    async update(claim: Claim): Promise<void> {
        const { id, subcontractId: _s, buyerWorkspaceId: _b, createdAt: _c, ...rest } = toRow(claim.toProps());
        await this.ctx.executor.update(scClaims).set(rest).where(eq(scClaims.id, id));
    }

    async findById(id: ClaimId): Promise<Claim | undefined> {
        const rows = await this.ctx.executor.select().from(scClaims).where(eq(scClaims.id, id)).limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async listBySubcontracts(ids: readonly SubcontractId[]): Promise<Claim[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(scClaims)
            .where(inArray(scClaims.subcontractId, [...ids])).orderBy(asc(scClaims.installmentNo), asc(scClaims.createdAt));
        return rows.map(toEntity);
    }
}
