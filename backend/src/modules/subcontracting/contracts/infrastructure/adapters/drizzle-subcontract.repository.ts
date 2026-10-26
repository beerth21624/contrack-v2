import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { tradeIdSchema, type SubcontractStatus } from '@contrack/contract';
import { asProjectId, asUserId, asWorkspaceId, type ProjectId, type WorkspaceId } from '../../../../../shared/domain';
import type { DatabaseContext } from '../../../../../shared/infrastructure/database/database';
import { scContractCounters, scSubcontracts } from '../../../../../shared/infrastructure/database/schema-sc-contracts';
import {
    asBidId, asPackageId, asScInvitationId, asSubcontractId, asVendorListEntryId, type PackageId, type ScInvitationId,
    type SubcontractId,
} from '../../../shared/ids';
import { SubcontractRepository } from '../../application/ports/subcontract.repository';
import { Subcontract, type SubcontractProps } from '../../domain/entities/subcontract.entity';

type Row = typeof scSubcontracts.$inferSelect;

function toEntity(r: Row): Subcontract {
    return Subcontract.rehydrate({
        id: asSubcontractId(r.id),
        buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
        projectId: asProjectId(r.projectId),
        packageId: asPackageId(r.packageId),
        bidId: asBidId(r.bidId),
        invitationId: asScInvitationId(r.invitationId),
        vendorListEntryId: asVendorListEntryId(r.vendorListEntryId),
        vendorWorkspaceId: r.vendorWorkspaceId === null ? null : asWorkspaceId(r.vendorWorkspaceId),
        vendorName: r.vendorName,
        buyerName: r.buyerName,
        projectName: r.projectName,
        contractNo: r.contractNo,
        year: r.year,
        seq: r.seq,
        title: r.title,
        trade: tradeIdSchema.parse(r.trade),
        location: r.location,
        lines: r.lines,
        baseTotal: r.baseTotal,
        variationsTotal: r.variationsTotal,
        total: r.total,
        terms: r.terms,
        schedule: r.schedule,
        installments: r.installments,
        documentVersion: r.documentVersion,
        signedScanFileId: r.signedScanFileId,
        status: r.status,
        acceptedBy: r.acceptedBy === null ? null : asUserId(r.acceptedBy),
        acceptedAt: r.acceptedAt,
        acceptedIp: r.acceptedIp,
        activatedAt: r.activatedAt,
        completedAt: r.completedAt,
        closedAt: r.closedAt,
        cancelledAt: r.cancelledAt,
        terminatedAt: r.terminatedAt,
        endReason: r.endReason,
        retentionReminders: r.retentionReminders,
        createdBy: asUserId(r.createdBy),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
    });
}

function toRow(p: SubcontractProps): typeof scSubcontracts.$inferInsert {
    return { ...p };
}

export class DrizzleSubcontractRepository extends SubcontractRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(subcontract: Subcontract): Promise<void> {
        await this.ctx.executor.insert(scSubcontracts).values(toRow(subcontract.toProps()));
    }

    async update(subcontract: Subcontract): Promise<void> {
        const { id, buyerWorkspaceId, ...rest } = toRow(subcontract.toProps());
        await this.ctx.executor.update(scSubcontracts).set(rest)
            .where(and(eq(scSubcontracts.id, id), eq(scSubcontracts.buyerWorkspaceId, buyerWorkspaceId)));
    }

    async findById(id: SubcontractId): Promise<Subcontract | undefined> {
        const rows = await this.ctx.executor.select().from(scSubcontracts).where(eq(scSubcontracts.id, id)).limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async lockForUpdate(id: SubcontractId): Promise<Subcontract | undefined> {
        const rows = await this.ctx.executor.select().from(scSubcontracts).where(eq(scSubcontracts.id, id)).limit(1).for('update');
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async lockByPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<Subcontract[]> {
        const rows = await this.ctx.executor.select().from(scSubcontracts)
            .where(and(eq(scSubcontracts.buyerWorkspaceId, buyerWorkspaceId), eq(scSubcontracts.packageId, packageId)))
            .orderBy(asc(scSubcontracts.id)).for('update');
        return rows.map(toEntity);
    }

    async listByProject(buyerWorkspaceId: WorkspaceId, projectId: ProjectId): Promise<Subcontract[]> {
        const rows = await this.ctx.executor.select().from(scSubcontracts)
            .where(and(eq(scSubcontracts.buyerWorkspaceId, buyerWorkspaceId), eq(scSubcontracts.projectId, projectId)))
            .orderBy(asc(scSubcontracts.createdAt));
        return rows.map(toEntity);
    }

    async listByBuyer(buyerWorkspaceId: WorkspaceId): Promise<Subcontract[]> {
        const rows = await this.ctx.executor.select().from(scSubcontracts)
            .where(eq(scSubcontracts.buyerWorkspaceId, buyerWorkspaceId)).orderBy(asc(scSubcontracts.createdAt));
        return rows.map(toEntity);
    }

    async listByVendor(vendorWorkspaceId: WorkspaceId): Promise<Subcontract[]> {
        const rows = await this.ctx.executor.select().from(scSubcontracts)
            .where(eq(scSubcontracts.vendorWorkspaceId, vendorWorkspaceId)).orderBy(asc(scSubcontracts.createdAt));
        return rows.map(toEntity);
    }

    async listByPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<Subcontract[]> {
        const rows = await this.ctx.executor.select().from(scSubcontracts)
            .where(and(eq(scSubcontracts.buyerWorkspaceId, buyerWorkspaceId), eq(scSubcontracts.packageId, packageId)))
            .orderBy(asc(scSubcontracts.createdAt));
        return rows.map(toEntity);
    }

    async listByInvitation(invitationId: ScInvitationId): Promise<Subcontract[]> {
        const rows = await this.ctx.executor.select().from(scSubcontracts)
            .where(eq(scSubcontracts.invitationId, invitationId)).orderBy(asc(scSubcontracts.createdAt));
        return rows.map(toEntity);
    }

    async listByStatuses(statuses: readonly SubcontractStatus[]): Promise<Subcontract[]> {
        if (statuses.length === 0) return [];
        const rows = await this.ctx.executor.select().from(scSubcontracts)
            .where(inArray(scSubcontracts.status, [...statuses])).orderBy(asc(scSubcontracts.createdAt));
        return rows.map(toEntity);
    }

    async nextSeq(buyerWorkspaceId: WorkspaceId, year: number): Promise<number> {
        // Upsert of the counter row: the first award of the year starts after any number already used (contracts made
        // before the counter existed); a concurrent award waits on the row lock and gets the next number.
        const rows = await this.ctx.executor.insert(scContractCounters).values({
            buyerWorkspaceId,
            year,
            seq: sql<number>`(select coalesce(max(${scSubcontracts.seq}), 0) + 1 from ${scSubcontracts}
                where ${scSubcontracts.buyerWorkspaceId} = ${buyerWorkspaceId} and ${scSubcontracts.year} = ${year})`,
        }).onConflictDoUpdate({
            target: [scContractCounters.buyerWorkspaceId, scContractCounters.year],
            set: { seq: sql`${scContractCounters.seq} + 1` },
        }).returning({ seq: scContractCounters.seq });
        const seq = rows[0]?.seq;
        if (seq === undefined) throw new Error('contract counter upsert returned no row');
        return seq;
    }
}
