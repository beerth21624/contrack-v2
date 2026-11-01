import type { WarrantyClaimStatus } from '@contrack/contract';
import { and, asc, desc, eq, inArray, lte } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import {
    hoHandoverDocuments, hoHandovers, hoWarranties, hoWarrantyClaims,
} from '../../../../shared/infrastructure/database/schema-handover';
import {
    type HandoverDocumentRecord, type HandoverRecord, HandoverRepository, type WarrantyClaimRecord, type WarrantyRecord,
} from '../../application/ports/handover.repository';

type HandoverRow = typeof hoHandovers.$inferSelect;
type DocumentRow = typeof hoHandoverDocuments.$inferSelect;
type WarrantyRow = typeof hoWarranties.$inferSelect;
type ClaimRow = typeof hoWarrantyClaims.$inferSelect;

const toHandover = (r: HandoverRow): HandoverRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), projectId: asProjectId(r.projectId), createdBy: asUserId(r.createdBy),
});

const toDocument = (r: DocumentRow): HandoverDocumentRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), createdBy: asUserId(r.createdBy),
});

const toWarranty = (r: WarrantyRow): WarrantyRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), projectId: asProjectId(r.projectId),
});

const toClaim = (r: ClaimRow): WarrantyClaimRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    assigneeUserId: r.assigneeUserId === null ? null : asUserId(r.assigneeUserId),
    createdBy: asUserId(r.createdBy),
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleHandoverRepository extends HandoverRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findHandover(handoverId: string): Promise<HandoverRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(hoHandovers).where(eq(hoHandovers.id, handoverId)).limit(1);
        return row === undefined ? undefined : toHandover(row);
    }

    async handoverForProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<HandoverRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(hoHandovers)
            .where(and(eq(hoHandovers.workspaceId, workspaceId), eq(hoHandovers.projectId, projectId))).limit(1);
        return row === undefined ? undefined : toHandover(row);
    }

    async lockHandover(workspaceId: WorkspaceId, handoverId: string): Promise<HandoverRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(hoHandovers)
            .where(and(eq(hoHandovers.workspaceId, workspaceId), eq(hoHandovers.id, handoverId))).limit(1).for('update');
        return row === undefined ? undefined : toHandover(row);
    }

    async insertHandover(h: HandoverRecord): Promise<void> {
        await this.ctx.executor.insert(hoHandovers).values({ ...h });
    }

    async saveHandover(h: HandoverRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = h;
        await this.ctx.executor.update(hoHandovers).set(rest).where(and(eq(hoHandovers.workspaceId, workspaceId), eq(hoHandovers.id, id)));
    }

    async documentsOf(workspaceId: WorkspaceId, handoverId: string): Promise<HandoverDocumentRecord[]> {
        const rows = await this.ctx.executor.select().from(hoHandoverDocuments)
            .where(and(eq(hoHandoverDocuments.workspaceId, workspaceId), eq(hoHandoverDocuments.handoverId, handoverId)))
            .orderBy(asc(hoHandoverDocuments.createdAt));
        return rows.map(toDocument);
    }

    async insertDocument(d: HandoverDocumentRecord): Promise<void> {
        await this.ctx.executor.insert(hoHandoverDocuments).values({ ...d });
    }

    async deleteDocuments(workspaceId: WorkspaceId, handoverId: string, documentIds: readonly string[]): Promise<void> {
        if (documentIds.length === 0) return;
        await this.ctx.executor.delete(hoHandoverDocuments).where(and(
            eq(hoHandoverDocuments.workspaceId, workspaceId), eq(hoHandoverDocuments.handoverId, handoverId),
            inArray(hoHandoverDocuments.id, [...documentIds]),
        ));
    }

    async warrantyForProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<WarrantyRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(hoWarranties)
            .where(and(eq(hoWarranties.workspaceId, workspaceId), eq(hoWarranties.projectId, projectId))).limit(1);
        return row === undefined ? undefined : toWarranty(row);
    }

    async warrantiesForProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<WarrantyRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(hoWarranties)
            .where(and(eq(hoWarranties.workspaceId, workspaceId), inArray(hoWarranties.projectId, [...projectIds])));
        return rows.map(toWarranty);
    }

    async insertWarranty(w: WarrantyRecord): Promise<void> {
        await this.ctx.executor.insert(hoWarranties).values({ ...w });
    }

    async saveWarranty(w: WarrantyRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = w;
        await this.ctx.executor.update(hoWarranties).set(rest).where(and(eq(hoWarranties.workspaceId, workspaceId), eq(hoWarranties.id, id)));
    }

    async activeWarrantiesEndingBy(endBy: string, limit: number): Promise<WarrantyRecord[]> {
        const rows = await this.ctx.executor.select().from(hoWarranties)
            .where(and(eq(hoWarranties.status, 'active'), lte(hoWarranties.endDate, endBy)))
            .orderBy(asc(hoWarranties.endDate)).limit(limit);
        return rows.map(toWarranty);
    }

    async findClaim(claimId: string): Promise<WarrantyClaimRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(hoWarrantyClaims).where(eq(hoWarrantyClaims.id, claimId)).limit(1);
        return row === undefined ? undefined : toClaim(row);
    }

    async lockClaim(workspaceId: WorkspaceId, claimId: string): Promise<WarrantyClaimRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(hoWarrantyClaims)
            .where(and(eq(hoWarrantyClaims.workspaceId, workspaceId), eq(hoWarrantyClaims.id, claimId))).limit(1).for('update');
        return row === undefined ? undefined : toClaim(row);
    }

    async claimsByProject(workspaceId: WorkspaceId, projectId: ProjectId, status?: WarrantyClaimStatus): Promise<WarrantyClaimRecord[]> {
        const rows = await this.ctx.executor.select().from(hoWarrantyClaims)
            .where(and(
                eq(hoWarrantyClaims.workspaceId, workspaceId), eq(hoWarrantyClaims.projectId, projectId),
                status === undefined ? undefined : eq(hoWarrantyClaims.status, status),
            ))
            .orderBy(desc(hoWarrantyClaims.reportedDate), desc(hoWarrantyClaims.createdAt));
        return rows.map(toClaim);
    }

    async claimsOfProjects(
        workspaceId: WorkspaceId, projectIds: readonly ProjectId[], statuses: readonly WarrantyClaimStatus[],
    ): Promise<WarrantyClaimRecord[]> {
        if (projectIds.length === 0 || statuses.length === 0) return [];
        const rows = await this.ctx.executor.select().from(hoWarrantyClaims)
            .where(and(
                eq(hoWarrantyClaims.workspaceId, workspaceId), inArray(hoWarrantyClaims.projectId, [...projectIds]),
                inArray(hoWarrantyClaims.status, [...statuses]),
            ));
        return rows.map(toClaim);
    }

    async insertClaim(c: WarrantyClaimRecord): Promise<void> {
        await this.ctx.executor.insert(hoWarrantyClaims).values({ ...c });
    }

    async saveClaim(c: WarrantyClaimRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = c;
        await this.ctx.executor.update(hoWarrantyClaims).set(rest)
            .where(and(eq(hoWarrantyClaims.workspaceId, workspaceId), eq(hoWarrantyClaims.id, id)));
    }

    // PostgreSQL drops the rows with the project (tenant FK cascade).
    deleteByProject(): Promise<void> {
        return Promise.resolve();
    }
}
