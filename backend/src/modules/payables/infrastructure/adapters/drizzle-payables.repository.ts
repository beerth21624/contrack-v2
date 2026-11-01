import type { PaymentRunStatus, SupplierBillStatus } from '@contrack/contract';
import { and, asc, desc, eq, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import {
    apBillLines, apBills, apPaymentAllocations, apPaymentRuns, apPayments, apWhtCertificates,
} from '../../../../shared/infrastructure/database/schema-payables';
import {
    type BillLineRecord, type BillListFilter, type BillRecord, PayablesRepository, type PaymentAllocationRecord, type PaymentRecord,
    type PaymentRunRecord, type WhtCertificateRecord,
} from '../../application/ports/payables.repository';

type BillRow = typeof apBills.$inferSelect;
type LineRow = typeof apBillLines.$inferSelect;

const toBill = (r: BillRow): BillRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), projectId: r.projectId === null ? null : asProjectId(r.projectId),
    approvedBy: r.approvedBy === null ? null : asUserId(r.approvedBy), createdBy: asUserId(r.createdBy), fileIds: [...r.fileIds],
});

const toLine = (r: LineRow): BillLineRecord => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) });

const toRun = (r: typeof apPaymentRuns.$inferSelect): PaymentRunRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), billIds: [...r.billIds], approvedBy: r.approvedBy === null ? null : asUserId(r.approvedBy),
    paidBy: r.paidBy === null ? null : asUserId(r.paidBy), createdBy: asUserId(r.createdBy),
});

const toPayment = (r: typeof apPayments.$inferSelect): PaymentRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), fileIds: [...r.fileIds], createdBy: asUserId(r.createdBy),
});

const toAllocation = (r: typeof apPaymentAllocations.$inferSelect): PaymentAllocationRecord => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) });

const toCertificate = (r: typeof apWhtCertificates.$inferSelect): WhtCertificateRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), createdBy: asUserId(r.createdBy),
});

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

    async findMany(workspaceId: WorkspaceId, billIds: readonly string[]): Promise<BillRecord[]> {
        if (billIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(apBills)
            .where(and(eq(apBills.workspaceId, workspaceId), inArray(apBills.id, [...billIds])));
        return rows.map(toBill);
    }

    async findRun(runId: string): Promise<PaymentRunRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(apPaymentRuns).where(eq(apPaymentRuns.id, runId)).limit(1);
        return row === undefined ? undefined : toRun(row);
    }

    async lockRun(workspaceId: WorkspaceId, runId: string): Promise<PaymentRunRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(apPaymentRuns)
            .where(and(eq(apPaymentRuns.workspaceId, workspaceId), eq(apPaymentRuns.id, runId))).limit(1).for('update');
        return row === undefined ? undefined : toRun(row);
    }

    async listRuns(workspaceId: WorkspaceId, statuses?: readonly PaymentRunStatus[]): Promise<PaymentRunRecord[]> {
        if (statuses?.length === 0) return [];
        const rows = await this.ctx.executor.select().from(apPaymentRuns)
            .where(and(eq(apPaymentRuns.workspaceId, workspaceId), statuses === undefined ? undefined : inArray(apPaymentRuns.status, [...statuses])))
            .orderBy(desc(apPaymentRuns.payDate), desc(apPaymentRuns.createdAt), desc(apPaymentRuns.id));
        return rows.map(toRun);
    }

    async insertRun(run: PaymentRunRecord): Promise<void> {
        await this.ctx.executor.insert(apPaymentRuns).values(run);
    }

    async saveRun(run: PaymentRunRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, createdBy: _b, ...rest } = run;
        await this.ctx.executor.update(apPaymentRuns).set(rest).where(and(eq(apPaymentRuns.workspaceId, workspaceId), eq(apPaymentRuns.id, id)));
    }

    async insertPayment(payment: PaymentRecord, allocations: readonly PaymentAllocationRecord[]): Promise<void> {
        await this.ctx.executor.insert(apPayments).values(payment);
        if (allocations.length > 0) await this.ctx.executor.insert(apPaymentAllocations).values([...allocations]);
    }

    async findPayment(paymentId: string): Promise<PaymentRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(apPayments).where(eq(apPayments.id, paymentId)).limit(1);
        return row === undefined ? undefined : toPayment(row);
    }

    async paymentsOfRun(workspaceId: WorkspaceId, runId: string): Promise<PaymentRecord[]> {
        const rows = await this.ctx.executor.select().from(apPayments)
            .where(and(eq(apPayments.workspaceId, workspaceId), eq(apPayments.runId, runId)))
            .orderBy(asc(apPayments.number));
        return rows.map(toPayment);
    }

    async allocationsOf(workspaceId: WorkspaceId, paymentId: string): Promise<PaymentAllocationRecord[]> {
        const rows = await this.ctx.executor.select().from(apPaymentAllocations)
            .where(and(eq(apPaymentAllocations.workspaceId, workspaceId), eq(apPaymentAllocations.paymentId, paymentId)));
        return rows.map(toAllocation);
    }

    async insertCertificate(certificate: WhtCertificateRecord): Promise<void> {
        await this.ctx.executor.insert(apWhtCertificates).values(certificate);
    }

    async findCertificate(certificateId: string): Promise<WhtCertificateRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(apWhtCertificates).where(eq(apWhtCertificates.id, certificateId)).limit(1);
        return row === undefined ? undefined : toCertificate(row);
    }

    async certificatesOf(workspaceId: WorkspaceId, certificateIds: readonly string[]): Promise<WhtCertificateRecord[]> {
        if (certificateIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(apWhtCertificates)
            .where(and(eq(apWhtCertificates.workspaceId, workspaceId), inArray(apWhtCertificates.id, [...certificateIds])));
        return rows.map(toCertificate);
    }
}
