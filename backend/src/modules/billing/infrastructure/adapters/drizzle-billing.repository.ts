import type {
    ArAdvanceEntryKind, ArRetentionEntryKind, ArClaimStatus, InvoiceKind, InvoiceSource, InvoiceStatus, MainContractBillingMode,
} from '@contrack/contract';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import {
    arAdvanceEntries, arClaimLines, arClaims, arInvoices, arRetentionEntries,
} from '../../../../shared/infrastructure/database/schema-contracts-billing';
import {
    type AdvanceEntryRecord, BillingRepository, type ClaimLineRecord, type ClaimRecord, type InvoiceRecord, type RetentionEntryRecord,
} from '../../application/ports/billing.repository';

type ClaimRow = typeof arClaims.$inferSelect;
type LineRow = typeof arClaimLines.$inferSelect;
type InvoiceRow = typeof arInvoices.$inferSelect;
type RetentionRow = typeof arRetentionEntries.$inferSelect;
type AdvanceRow = typeof arAdvanceEntries.$inferSelect;

const toClaim = (r: ClaimRow): ClaimRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    mode: r.mode as MainContractBillingMode,
    status: r.status as ArClaimStatus,
    createdBy: asUserId(r.createdBy),
});

const toLine = (r: LineRow): ClaimLineRecord => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) });

const toInvoice = (r: InvoiceRow): InvoiceRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: r.projectId === null ? null : asProjectId(r.projectId),
    kind: r.kind as InvoiceKind,
    source: r.source as InvoiceSource,
    status: r.status as InvoiceStatus,
    issuedBy: r.issuedBy === null ? null : asUserId(r.issuedBy),
    createdBy: asUserId(r.createdBy),
});

const toRetention = (r: RetentionRow): RetentionEntryRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    kind: r.kind as ArRetentionEntryKind,
    createdBy: asUserId(r.createdBy),
});

const toAdvance = (r: AdvanceRow): AdvanceEntryRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    kind: r.kind as ArAdvanceEntryKind,
    createdBy: asUserId(r.createdBy),
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleBillingRepository extends BillingRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findClaim(claimId: string): Promise<ClaimRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(arClaims).where(eq(arClaims.id, claimId)).limit(1);
        return row === undefined ? undefined : toClaim(row);
    }

    async lockClaim(workspaceId: WorkspaceId, claimId: string): Promise<ClaimRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(arClaims)
            .where(and(eq(arClaims.workspaceId, workspaceId), eq(arClaims.id, claimId))).limit(1).for('update');
        return row === undefined ? undefined : toClaim(row);
    }

    async claimsOfContract(workspaceId: WorkspaceId, contractId: string): Promise<ClaimRecord[]> {
        const rows = await this.ctx.executor.select().from(arClaims)
            .where(and(eq(arClaims.workspaceId, workspaceId), eq(arClaims.contractId, contractId)))
            .orderBy(asc(arClaims.claimNo));
        return rows.map(toClaim);
    }

    async claimsOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<ClaimRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(arClaims)
            .where(and(eq(arClaims.workspaceId, workspaceId), inArray(arClaims.projectId, [...projectIds])));
        return rows.map(toClaim);
    }

    async insertClaim(c: ClaimRecord): Promise<void> {
        await this.ctx.executor.insert(arClaims).values({ ...c });
    }

    async saveClaim(c: ClaimRecord): Promise<void> {
        const { id, workspaceId, ...rest } = c;
        await this.ctx.executor.update(arClaims).set(rest).where(and(eq(arClaims.workspaceId, workspaceId), eq(arClaims.id, id)));
    }

    async linesOf(workspaceId: WorkspaceId, claimIds: readonly string[]): Promise<ClaimLineRecord[]> {
        if (claimIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(arClaimLines)
            .where(and(eq(arClaimLines.workspaceId, workspaceId), inArray(arClaimLines.claimId, [...claimIds])));
        return rows.map(toLine);
    }

    async replaceLines(workspaceId: WorkspaceId, claimId: string, lines: readonly ClaimLineRecord[]): Promise<void> {
        await this.ctx.executor.delete(arClaimLines).where(and(eq(arClaimLines.workspaceId, workspaceId), eq(arClaimLines.claimId, claimId)));
        // Large projects: insert in chunks (parameter limit).
        for (let i = 0; i < lines.length; i += 500) {
            await this.ctx.executor.insert(arClaimLines).values(lines.slice(i, i + 500).map(l => ({ ...l })));
        }
    }

    async findInvoice(invoiceId: string): Promise<InvoiceRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(arInvoices).where(eq(arInvoices.id, invoiceId)).limit(1);
        return row === undefined ? undefined : toInvoice(row);
    }

    async lockInvoice(workspaceId: WorkspaceId, invoiceId: string): Promise<InvoiceRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(arInvoices)
            .where(and(eq(arInvoices.workspaceId, workspaceId), eq(arInvoices.id, invoiceId))).limit(1).for('update');
        return row === undefined ? undefined : toInvoice(row);
    }

    async invoicesOfProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<InvoiceRecord[]> {
        const rows = await this.ctx.executor.select().from(arInvoices)
            .where(and(eq(arInvoices.workspaceId, workspaceId), eq(arInvoices.projectId, projectId)))
            .orderBy(desc(arInvoices.createdAt));
        return rows.map(toInvoice);
    }

    async invoicesOfContract(workspaceId: WorkspaceId, contractId: string): Promise<InvoiceRecord[]> {
        const rows = await this.ctx.executor.select().from(arInvoices)
            .where(and(eq(arInvoices.workspaceId, workspaceId), eq(arInvoices.contractId, contractId)))
            .orderBy(desc(arInvoices.createdAt));
        return rows.map(toInvoice);
    }

    async invoicesOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<InvoiceRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(arInvoices)
            .where(and(eq(arInvoices.workspaceId, workspaceId), inArray(arInvoices.projectId, [...projectIds])));
        return rows.map(toInvoice);
    }

    async insertInvoice(i: InvoiceRecord): Promise<void> {
        await this.ctx.executor.insert(arInvoices).values({ ...i });
    }

    async saveInvoice(i: InvoiceRecord): Promise<void> {
        const { id, workspaceId, ...rest } = i;
        await this.ctx.executor.update(arInvoices).set(rest).where(and(eq(arInvoices.workspaceId, workspaceId), eq(arInvoices.id, id)));
    }

    async retentionEntries(workspaceId: WorkspaceId, contractId: string): Promise<RetentionEntryRecord[]> {
        const rows = await this.ctx.executor.select().from(arRetentionEntries)
            .where(and(eq(arRetentionEntries.workspaceId, workspaceId), eq(arRetentionEntries.contractId, contractId)))
            .orderBy(asc(arRetentionEntries.entryDate), asc(arRetentionEntries.createdAt));
        return rows.map(toRetention);
    }

    async insertRetentionEntry(e: RetentionEntryRecord): Promise<void> {
        await this.ctx.executor.insert(arRetentionEntries).values({ ...e });
    }

    async deleteRetentionEntriesOfInvoice(workspaceId: WorkspaceId, invoiceId: string): Promise<void> {
        await this.ctx.executor.delete(arRetentionEntries)
            .where(and(eq(arRetentionEntries.workspaceId, workspaceId), eq(arRetentionEntries.invoiceId, invoiceId)));
    }

    async advanceEntries(workspaceId: WorkspaceId, contractId: string): Promise<AdvanceEntryRecord[]> {
        const rows = await this.ctx.executor.select().from(arAdvanceEntries)
            .where(and(eq(arAdvanceEntries.workspaceId, workspaceId), eq(arAdvanceEntries.contractId, contractId)))
            .orderBy(asc(arAdvanceEntries.entryDate), asc(arAdvanceEntries.createdAt));
        return rows.map(toAdvance);
    }

    async insertAdvanceEntry(e: AdvanceEntryRecord): Promise<void> {
        await this.ctx.executor.insert(arAdvanceEntries).values({ ...e });
    }

    async deleteAdvanceEntriesOfInvoice(workspaceId: WorkspaceId, invoiceId: string): Promise<void> {
        await this.ctx.executor.delete(arAdvanceEntries)
            .where(and(eq(arAdvanceEntries.workspaceId, workspaceId), eq(arAdvanceEntries.invoiceId, invoiceId)));
    }

    async deleteByProject(): Promise<void> {
        // PostgreSQL drops billing rows with the project (tenant FK on delete cascade).
    }
}
