import type {
    ArAdvanceEntryKind, ArRetentionEntryKind, ArClaimStatus, InvoiceKind, InvoiceSource, InvoiceStatus, MainContractBillingMode,
    ReceiptMethod, ReceiptStatus,
} from '@contrack/contract';
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import {
    arAdvanceEntries, arClaimLines, arClaims, arInvoices, arReceiptAllocations, arReceipts, arRetentionEntries,
} from '../../../../shared/infrastructure/database/schema-contracts-billing';
import {
    type AdvanceEntryRecord, BillingRepository, type ClaimLineRecord, type ClaimRecord, type InvoiceRecord, type ReceiptAllocationRecord,
    type ReceiptRecord, type RetentionEntryRecord,
} from '../../application/ports/billing.repository';

const RECEIVABLE_KINDS = ['invoice', 'advance_invoice'];
const OPEN_STATUSES = ['issued', 'partially_paid'];

type ClaimRow = typeof arClaims.$inferSelect;
type LineRow = typeof arClaimLines.$inferSelect;
type InvoiceRow = typeof arInvoices.$inferSelect;
type RetentionRow = typeof arRetentionEntries.$inferSelect;
type AdvanceRow = typeof arAdvanceEntries.$inferSelect;
type ReceiptRow = typeof arReceipts.$inferSelect;
type AllocationRow = typeof arReceiptAllocations.$inferSelect;

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

const toReceipt = (r: ReceiptRow): ReceiptRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: r.projectId === null ? null : asProjectId(r.projectId),
    method: r.method as ReceiptMethod,
    status: r.status as ReceiptStatus,
    voidedBy: r.voidedBy === null ? null : asUserId(r.voidedBy),
    createdBy: asUserId(r.createdBy),
});

const toAllocation = (r: AllocationRow): ReceiptAllocationRecord => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) });

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

    async relatedInvoices(workspaceId: WorkspaceId, invoiceId: string): Promise<InvoiceRecord[]> {
        const rows = await this.ctx.executor.select().from(arInvoices)
            .where(and(eq(arInvoices.workspaceId, workspaceId), eq(arInvoices.relatedInvoiceId, invoiceId)))
            .orderBy(asc(arInvoices.createdAt));
        return rows.map(toInvoice);
    }

    async invoicesOfCustomer(workspaceId: WorkspaceId, customerId: string): Promise<InvoiceRecord[]> {
        const rows = await this.ctx.executor.select().from(arInvoices)
            .where(and(eq(arInvoices.workspaceId, workspaceId), eq(arInvoices.customerId, customerId)))
            .orderBy(asc(arInvoices.issueDate), asc(arInvoices.createdAt));
        return rows.map(toInvoice);
    }

    async openInvoices(workspaceId: WorkspaceId): Promise<InvoiceRecord[]> {
        const rows = await this.ctx.executor.select().from(arInvoices)
            .where(and(eq(arInvoices.workspaceId, workspaceId), inArray(arInvoices.kind, RECEIVABLE_KINDS), inArray(arInvoices.status, OPEN_STATUSES)))
            .orderBy(asc(arInvoices.dueDate), asc(arInvoices.createdAt));
        return rows.map(toInvoice);
    }

    async openInvoicesDueBetween(from: string, to: string, limit: number): Promise<InvoiceRecord[]> {
        const rows = await this.ctx.executor.select().from(arInvoices)
            .where(and(
                inArray(arInvoices.kind, RECEIVABLE_KINDS), inArray(arInvoices.status, OPEN_STATUSES),
                gte(arInvoices.dueDate, from), lte(arInvoices.dueDate, to),
            ))
            .orderBy(asc(arInvoices.dueDate)).limit(limit);
        return rows.map(toInvoice);
    }

    async findReceipt(receiptId: string): Promise<ReceiptRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(arReceipts).where(eq(arReceipts.id, receiptId)).limit(1);
        return row === undefined ? undefined : toReceipt(row);
    }

    async lockReceipt(workspaceId: WorkspaceId, receiptId: string): Promise<ReceiptRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(arReceipts)
            .where(and(eq(arReceipts.workspaceId, workspaceId), eq(arReceipts.id, receiptId))).limit(1).for('update');
        return row === undefined ? undefined : toReceipt(row);
    }

    async insertReceipt(r: ReceiptRecord): Promise<void> {
        await this.ctx.executor.insert(arReceipts).values({ ...r });
    }

    async saveReceipt(r: ReceiptRecord): Promise<void> {
        const { id, workspaceId, ...rest } = r;
        await this.ctx.executor.update(arReceipts).set(rest).where(and(eq(arReceipts.workspaceId, workspaceId), eq(arReceipts.id, id)));
    }

    async receiptsOfCustomer(workspaceId: WorkspaceId, customerId: string): Promise<ReceiptRecord[]> {
        const rows = await this.ctx.executor.select().from(arReceipts)
            .where(and(eq(arReceipts.workspaceId, workspaceId), eq(arReceipts.customerId, customerId)))
            .orderBy(asc(arReceipts.receiptDate), asc(arReceipts.createdAt));
        return rows.map(toReceipt);
    }

    async insertAllocations(rows: readonly ReceiptAllocationRecord[]): Promise<void> {
        if (rows.length === 0) return;
        await this.ctx.executor.insert(arReceiptAllocations).values(rows.map(r => ({ ...r })));
    }

    async allocationsOf(workspaceId: WorkspaceId, receiptIds: readonly string[]): Promise<ReceiptAllocationRecord[]> {
        if (receiptIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(arReceiptAllocations)
            .where(and(eq(arReceiptAllocations.workspaceId, workspaceId), inArray(arReceiptAllocations.receiptId, [...receiptIds])));
        return rows.map(toAllocation);
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

    async deleteAdvanceEntriesOfReceipt(workspaceId: WorkspaceId, receiptId: string): Promise<void> {
        await this.ctx.executor.delete(arAdvanceEntries)
            .where(and(eq(arAdvanceEntries.workspaceId, workspaceId), eq(arAdvanceEntries.receiptId, receiptId)));
    }

    async retentionEntriesOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<RetentionEntryRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(arRetentionEntries)
            .where(and(eq(arRetentionEntries.workspaceId, workspaceId), inArray(arRetentionEntries.projectId, [...projectIds])));
        return rows.map(toRetention);
    }

    async advanceEntriesOfProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<AdvanceEntryRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(arAdvanceEntries)
            .where(and(eq(arAdvanceEntries.workspaceId, workspaceId), inArray(arAdvanceEntries.projectId, [...projectIds])));
        return rows.map(toAdvance);
    }

    async contractsWithRetention(limit: number): Promise<{ workspaceId: WorkspaceId; contractId: string }[]> {
        const rows = await this.ctx.executor.select({ workspaceId: arRetentionEntries.workspaceId, contractId: arRetentionEntries.contractId })
            .from(arRetentionEntries).where(eq(arRetentionEntries.kind, 'withheld'))
            .groupBy(arRetentionEntries.workspaceId, arRetentionEntries.contractId).limit(limit);
        return rows.map(r => ({ workspaceId: asWorkspaceId(r.workspaceId), contractId: r.contractId }));
    }

    async deleteByProject(): Promise<void> {
        // PostgreSQL drops billing rows with the project (tenant FK on delete cascade).
    }
}
