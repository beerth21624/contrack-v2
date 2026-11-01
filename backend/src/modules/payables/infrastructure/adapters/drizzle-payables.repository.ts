import type { SupplierBillStatus } from '@contrack/contract';
import { and, asc, desc, eq, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { apBillLines, apBills } from '../../../../shared/infrastructure/database/schema-payables';
import {
    type BillLineRecord, type BillListFilter, type BillRecord, PayablesRepository,
} from '../../application/ports/payables.repository';

type BillRow = typeof apBills.$inferSelect;
type LineRow = typeof apBillLines.$inferSelect;

const toBill = (r: BillRow): BillRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), projectId: r.projectId === null ? null : asProjectId(r.projectId),
    approvedBy: r.approvedBy === null ? null : asUserId(r.approvedBy), createdBy: asUserId(r.createdBy), fileIds: [...r.fileIds],
});

const toLine = (r: LineRow): BillLineRecord => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) });

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzlePayablesRepository extends PayablesRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async lockWorkspace(workspaceId: WorkspaceId): Promise<void> {
        await this.ctx.executor.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`payables:${workspaceId}`}, 0))`);
    }

    async find(billId: string): Promise<BillRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(apBills).where(eq(apBills.id, billId)).limit(1);
        return row === undefined ? undefined : toBill(row);
    }

    async lock(workspaceId: WorkspaceId, billId: string): Promise<BillRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(apBills)
            .where(and(eq(apBills.workspaceId, workspaceId), eq(apBills.id, billId))).limit(1).for('update');
        return row === undefined ? undefined : toBill(row);
    }

    async list(workspaceId: WorkspaceId, filter: BillListFilter): Promise<BillRecord[]> {
        if (filter.statuses?.length === 0) return [];
        const rows = await this.ctx.executor.select().from(apBills)
            .where(and(
                eq(apBills.workspaceId, workspaceId),
                filter.statuses === undefined ? undefined : inArray(apBills.status, [...filter.statuses]),
                filter.kind === undefined ? undefined : eq(apBills.kind, filter.kind),
                filter.supplierId === undefined ? undefined : eq(apBills.supplierId, filter.supplierId),
                filter.projectId === undefined ? undefined : eq(apBills.projectId, filter.projectId),
                filter.dueTo === undefined ? undefined : lte(apBills.dueDate, filter.dueTo),
            ))
            .orderBy(desc(apBills.billDate), desc(apBills.createdAt), desc(apBills.id));
        return rows.map(toBill);
    }

    async insert(bill: BillRecord, lines: readonly BillLineRecord[]): Promise<void> {
        await this.ctx.executor.insert(apBills).values(bill);
        if (lines.length > 0) await this.ctx.executor.insert(apBillLines).values([...lines]);
    }

    async save(bill: BillRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, createdBy: _b, ...rest } = bill;
        await this.ctx.executor.update(apBills).set(rest).where(and(eq(apBills.workspaceId, workspaceId), eq(apBills.id, id)));
    }

    async linesOf(workspaceId: WorkspaceId, billId: string): Promise<BillLineRecord[]> {
        const rows = await this.ctx.executor.select().from(apBillLines)
            .where(and(eq(apBillLines.workspaceId, workspaceId), eq(apBillLines.billId, billId)))
            .orderBy(asc(apBillLines.sort), asc(apBillLines.id));
        return rows.map(toLine);
    }

    async replaceLines(workspaceId: WorkspaceId, billId: string, lines: readonly BillLineRecord[]): Promise<void> {
        await this.ctx.executor.delete(apBillLines).where(and(eq(apBillLines.workspaceId, workspaceId), eq(apBillLines.billId, billId)));
        if (lines.length > 0) await this.ctx.executor.insert(apBillLines).values([...lines]);
    }

    async saveLines(lines: readonly BillLineRecord[]): Promise<void> {
        for (const l of lines) {
            const { id, workspaceId, billId: _b, ...rest } = l;
            await this.ctx.executor.update(apBillLines).set(rest).where(and(eq(apBillLines.workspaceId, workspaceId), eq(apBillLines.id, id)));
        }
    }

    async findByInvoiceNo(workspaceId: WorkspaceId, supplierId: string, invoiceNo: string, exceptId?: string): Promise<BillRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(apBills)
            .where(and(
                eq(apBills.workspaceId, workspaceId), eq(apBills.supplierId, supplierId), eq(apBills.supplierInvoiceNo, invoiceNo),
                ne(apBills.status, 'voided'), exceptId === undefined ? undefined : ne(apBills.id, exceptId),
            ))
            .limit(1);
        return row === undefined ? undefined : toBill(row);
    }

    async findByPayPeriod(workspaceId: WorkspaceId, periodId: string): Promise<BillRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(apBills)
            .where(and(eq(apBills.workspaceId, workspaceId), eq(apBills.payPeriodId, periodId), ne(apBills.status, 'voided')))
            .limit(1);
        return row === undefined ? undefined : toBill(row);
    }

    async billedClaims(workspaceId: WorkspaceId, claimIds: readonly string[]): Promise<Set<string>> {
        if (claimIds.length === 0) return new Set();
        const rows = await this.ctx.executor.select({ id: apBills.scClaimId }).from(apBills)
            .where(and(
                eq(apBills.workspaceId, workspaceId), isNotNull(apBills.scClaimId), inArray(apBills.scClaimId, [...claimIds]),
                ne(apBills.status, 'voided'),
            ));
        return new Set(rows.map(r => r.id).filter((id): id is string => id !== null));
    }

    async dueOn(date: string, statuses: readonly SupplierBillStatus[], limit: number): Promise<BillRecord[]> {
        if (statuses.length === 0) return [];
        const rows = await this.ctx.executor.select().from(apBills)
            .where(and(eq(apBills.dueDate, date), inArray(apBills.status, [...statuses])))
            .orderBy(asc(apBills.workspaceId), asc(apBills.id))
            .limit(limit);
        return rows.map(toBill);
    }

    async deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await this.ctx.executor.delete(apBills).where(and(eq(apBills.workspaceId, workspaceId), eq(apBills.projectId, projectId)));
    }
}
