import type { PayPeriodStatus, WageAdvanceStatus } from '@contrack/contract';
import { and, asc, count, desc, eq, gte, inArray, like, lte, ne, sql } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import {
    lbAdvanceRecoveries, lbAdvances, lbPayLines, lbPayPeriods, lbTimesheetEntries,
} from '../../../../shared/infrastructure/database/schema-site';
import {
    type AdvanceRecoveryRecord, type EntryRange, LabourRepository, type PayLineRecord, type PayPeriodRecord, type TimesheetEntryRecord,
    type WageAdvanceRecord,
} from '../../application/ports/labour.repository';

type EntryRow = typeof lbTimesheetEntries.$inferSelect;
type PeriodRow = typeof lbPayPeriods.$inferSelect;
type AdvanceRow = typeof lbAdvances.$inferSelect;

const user = (v: string | null) => (v === null ? null : asUserId(v));

const toEntry = (r: EntryRow): TimesheetEntryRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), projectId: asProjectId(r.projectId), recordedBy: asUserId(r.recordedBy),
    approvedBy: user(r.approvedBy),
});

const toPeriod = (r: PeriodRow): PayPeriodRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), builtBy: user(r.builtBy), approvedBy: user(r.approvedBy), paidBy: user(r.paidBy),
});

const toAdvance = (r: AdvanceRow): WageAdvanceRecord => ({
    ...r, workspaceId: asWorkspaceId(r.workspaceId), paidBy: user(r.paidBy), createdBy: asUserId(r.createdBy),
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleLabourRepository extends LabourRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    // ── timesheets ──

    async lockPersonDays(workspaceId: WorkspaceId, personIds: readonly string[], date: string): Promise<void> {
        for (const id of [...new Set(personIds)].sort()) {
            await this.ctx.executor.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`labour:${workspaceId}:${id}:${date}`}, 0))`);
        }
    }

    async entriesOfDay(workspaceId: WorkspaceId, projectId: ProjectId, date: string): Promise<TimesheetEntryRecord[]> {
        const rows = await this.ctx.executor.select().from(lbTimesheetEntries)
            .where(and(
                eq(lbTimesheetEntries.workspaceId, workspaceId), eq(lbTimesheetEntries.projectId, projectId), eq(lbTimesheetEntries.workDate, date),
            ))
            .orderBy(asc(lbTimesheetEntries.createdAt), asc(lbTimesheetEntries.id));
        return rows.map(toEntry);
    }

    async entriesOfPeopleOn(workspaceId: WorkspaceId, personIds: readonly string[], date: string): Promise<TimesheetEntryRecord[]> {
        if (personIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(lbTimesheetEntries)
            .where(and(
                eq(lbTimesheetEntries.workspaceId, workspaceId), inArray(lbTimesheetEntries.personId, [...personIds]),
                eq(lbTimesheetEntries.workDate, date),
            ));
        return rows.map(toEntry);
    }

    async entriesInRange(workspaceId: WorkspaceId, range: EntryRange): Promise<TimesheetEntryRecord[]> {
        if (range.statuses?.length === 0) return [];
        const rows = await this.ctx.executor.select().from(lbTimesheetEntries)
            .where(and(
                eq(lbTimesheetEntries.workspaceId, workspaceId),
                gte(lbTimesheetEntries.workDate, range.from), lte(lbTimesheetEntries.workDate, range.to),
                range.projectId === undefined ? undefined : eq(lbTimesheetEntries.projectId, range.projectId),
                range.statuses === undefined ? undefined : inArray(lbTimesheetEntries.status, [...range.statuses]),
            ))
            .orderBy(asc(lbTimesheetEntries.workDate), asc(lbTimesheetEntries.createdAt), asc(lbTimesheetEntries.id));
        return rows.map(toEntry);
    }

    async entriesByBatch(workspaceId: WorkspaceId, batchId: string): Promise<TimesheetEntryRecord[]> {
        const rows = await this.ctx.executor.select().from(lbTimesheetEntries)
            .where(and(eq(lbTimesheetEntries.workspaceId, workspaceId), eq(lbTimesheetEntries.approvalBatchId, batchId)))
            .orderBy(asc(lbTimesheetEntries.workDate), asc(lbTimesheetEntries.id));
        return rows.map(toEntry);
    }

    async entriesOfPeriod(workspaceId: WorkspaceId, periodId: string): Promise<TimesheetEntryRecord[]> {
        const rows = await this.ctx.executor.select().from(lbTimesheetEntries)
            .where(and(eq(lbTimesheetEntries.workspaceId, workspaceId), eq(lbTimesheetEntries.payPeriodId, periodId)))
            .orderBy(asc(lbTimesheetEntries.workDate), asc(lbTimesheetEntries.id));
        return rows.map(toEntry);
    }

    async insertEntries(rows: readonly TimesheetEntryRecord[]): Promise<void> {
        if (rows.length > 0) await this.ctx.executor.insert(lbTimesheetEntries).values(rows.map(r => ({ ...r })));
    }

    async saveEntries(rows: readonly TimesheetEntryRecord[]): Promise<void> {
        for (const r of rows) {
            const { id, workspaceId, createdAt: _c, ...rest } = r;
            await this.ctx.executor.update(lbTimesheetEntries).set(rest)
                .where(and(eq(lbTimesheetEntries.workspaceId, workspaceId), eq(lbTimesheetEntries.id, id)));
        }
    }

    async deleteEntries(workspaceId: WorkspaceId, ids: readonly string[]): Promise<void> {
        if (ids.length === 0) return;
        await this.ctx.executor.delete(lbTimesheetEntries)
            .where(and(eq(lbTimesheetEntries.workspaceId, workspaceId), inArray(lbTimesheetEntries.id, [...ids])));
    }

    async linkEntries(workspaceId: WorkspaceId, ids: readonly string[], periodId: string | null): Promise<void> {
        if (ids.length === 0) return;
        await this.ctx.executor.update(lbTimesheetEntries).set({ payPeriodId: periodId, updatedAt: new Date() })
            .where(and(eq(lbTimesheetEntries.workspaceId, workspaceId), inArray(lbTimesheetEntries.id, [...ids])));
    }

    async workspacesWithEntries(from: string, to: string, limit: number): Promise<WorkspaceId[]> {
        const rows = await this.ctx.executor.select({ ws: lbTimesheetEntries.workspaceId }).from(lbTimesheetEntries)
            .where(and(gte(lbTimesheetEntries.workDate, from), lte(lbTimesheetEntries.workDate, to), ne(lbTimesheetEntries.status, 'paid')))
            .groupBy(lbTimesheetEntries.workspaceId)
            .limit(limit);
        return rows.map(r => asWorkspaceId(r.ws));
    }

    // ── pay periods ──

    async findPeriod(periodId: string): Promise<PayPeriodRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(lbPayPeriods).where(eq(lbPayPeriods.id, periodId)).limit(1);
        return row === undefined ? undefined : toPeriod(row);
    }

    async findPeriodByKey(workspaceId: WorkspaceId, periodKey: string): Promise<PayPeriodRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(lbPayPeriods)
            .where(and(eq(lbPayPeriods.workspaceId, workspaceId), eq(lbPayPeriods.periodKey, periodKey))).limit(1);
        return row === undefined ? undefined : toPeriod(row);
    }

    async lockPeriod(workspaceId: WorkspaceId, periodId: string): Promise<PayPeriodRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(lbPayPeriods)
            .where(and(eq(lbPayPeriods.workspaceId, workspaceId), eq(lbPayPeriods.id, periodId))).limit(1).for('update');
        return row === undefined ? undefined : toPeriod(row);
    }

    async listPeriods(workspaceId: WorkspaceId, filter: { year?: number; statuses?: readonly PayPeriodStatus[] }): Promise<PayPeriodRecord[]> {
        if (filter.statuses?.length === 0) return [];
        const rows = await this.ctx.executor.select().from(lbPayPeriods)
            .where(and(
                eq(lbPayPeriods.workspaceId, workspaceId),
                filter.year === undefined ? undefined : like(lbPayPeriods.periodKey, `${filter.year}-%`),
                filter.statuses === undefined ? undefined : inArray(lbPayPeriods.status, [...filter.statuses]),
            ))
            .orderBy(desc(lbPayPeriods.periodKey));
        return rows.map(toPeriod);
    }

    async ensurePeriod(row: PayPeriodRecord): Promise<PayPeriodRecord> {
        await this.ctx.executor.insert(lbPayPeriods).values({ ...row }).onConflictDoNothing({ target: [lbPayPeriods.workspaceId, lbPayPeriods.periodKey] });
        const [locked] = await this.ctx.executor.select().from(lbPayPeriods)
            .where(and(eq(lbPayPeriods.workspaceId, row.workspaceId), eq(lbPayPeriods.periodKey, row.periodKey))).limit(1).for('update');
        if (locked === undefined) throw new Error(`pay period ${row.periodKey} vanished`);
        return toPeriod(locked);
    }

    async savePeriod(row: PayPeriodRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = row;
        await this.ctx.executor.update(lbPayPeriods).set(rest).where(and(eq(lbPayPeriods.workspaceId, workspaceId), eq(lbPayPeriods.id, id)));
    }

    async linesOf(workspaceId: WorkspaceId, periodId: string): Promise<PayLineRecord[]> {
        const rows = await this.ctx.executor.select().from(lbPayLines)
            .where(and(eq(lbPayLines.workspaceId, workspaceId), eq(lbPayLines.periodId, periodId)))
            .orderBy(asc(lbPayLines.personName), asc(lbPayLines.id));
        return rows.map(r => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) }));
    }

    async lineCounts(workspaceId: WorkspaceId, periodIds: readonly string[]): Promise<Map<string, number>> {
        const out = new Map<string, number>();
        if (periodIds.length === 0) return out;
        const rows = await this.ctx.executor.select({ id: lbPayLines.periodId, n: count() }).from(lbPayLines)
            .where(and(eq(lbPayLines.workspaceId, workspaceId), inArray(lbPayLines.periodId, [...periodIds]))).groupBy(lbPayLines.periodId);
        for (const r of rows) out.set(r.id, r.n);
        return out;
    }

    async replaceLines(workspaceId: WorkspaceId, periodId: string, lines: readonly PayLineRecord[]): Promise<void> {
        // lb_advance_recoveries cascade with their pay line.
        await this.ctx.executor.delete(lbPayLines).where(and(eq(lbPayLines.workspaceId, workspaceId), eq(lbPayLines.periodId, periodId)));
        if (lines.length > 0) await this.ctx.executor.insert(lbPayLines).values(lines.map(l => ({ ...l })));
    }

    async markLinesPaid(workspaceId: WorkspaceId, periodId: string): Promise<void> {
        await this.ctx.executor.update(lbPayLines).set({ paid: true })
            .where(and(eq(lbPayLines.workspaceId, workspaceId), eq(lbPayLines.periodId, periodId)));
    }

    // ── advances ──

    async findAdvance(advanceId: string): Promise<WageAdvanceRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(lbAdvances).where(eq(lbAdvances.id, advanceId)).limit(1);
        return row === undefined ? undefined : toAdvance(row);
    }

    async lockAdvance(workspaceId: WorkspaceId, advanceId: string): Promise<WageAdvanceRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(lbAdvances)
            .where(and(eq(lbAdvances.workspaceId, workspaceId), eq(lbAdvances.id, advanceId))).limit(1).for('update');
        return row === undefined ? undefined : toAdvance(row);
    }

    async lockAdvancesOf(workspaceId: WorkspaceId, personIds: readonly string[]): Promise<WageAdvanceRecord[]> {
        if (personIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(lbAdvances)
            .where(and(eq(lbAdvances.workspaceId, workspaceId), inArray(lbAdvances.personId, [...personIds])))
            .orderBy(asc(lbAdvances.id)).for('update');
        return rows.map(toAdvance);
    }

    async listAdvances(workspaceId: WorkspaceId, filter: { personId?: string; status?: WageAdvanceStatus }): Promise<WageAdvanceRecord[]> {
        const rows = await this.ctx.executor.select().from(lbAdvances)
            .where(and(
                eq(lbAdvances.workspaceId, workspaceId),
                filter.personId === undefined ? undefined : eq(lbAdvances.personId, filter.personId),
                filter.status === undefined ? undefined : eq(lbAdvances.status, filter.status),
            ))
            .orderBy(desc(lbAdvances.advanceDate), desc(lbAdvances.createdAt));
        return rows.map(toAdvance);
    }

    async insertAdvance(row: WageAdvanceRecord): Promise<void> {
        await this.ctx.executor.insert(lbAdvances).values({ ...row });
    }

    async saveAdvance(row: WageAdvanceRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = row;
        await this.ctx.executor.update(lbAdvances).set(rest).where(and(eq(lbAdvances.workspaceId, workspaceId), eq(lbAdvances.id, id)));
    }

    async recoveriesOfLines(workspaceId: WorkspaceId, lineIds: readonly string[]): Promise<AdvanceRecoveryRecord[]> {
        if (lineIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(lbAdvanceRecoveries)
            .where(and(eq(lbAdvanceRecoveries.workspaceId, workspaceId), inArray(lbAdvanceRecoveries.payLineId, [...lineIds])));
        return rows.map(r => ({ ...r, workspaceId: asWorkspaceId(r.workspaceId) }));
    }

    async recoveredByAdvance(workspaceId: WorkspaceId, advanceIds: readonly string[]): Promise<Map<string, number>> {
        const out = new Map<string, number>();
        if (advanceIds.length === 0) return out;
        const rows = await this.ctx.executor
            .select({ id: lbAdvanceRecoveries.advanceId, total: sql<string>`coalesce(sum(${lbAdvanceRecoveries.amount}), 0)` })
            .from(lbAdvanceRecoveries)
            .where(and(eq(lbAdvanceRecoveries.workspaceId, workspaceId), inArray(lbAdvanceRecoveries.advanceId, [...advanceIds])))
            .groupBy(lbAdvanceRecoveries.advanceId);
        for (const r of rows) out.set(r.id, Number(r.total));
        return out;
    }

    async insertRecoveries(rows: readonly AdvanceRecoveryRecord[]): Promise<void> {
        if (rows.length > 0) await this.ctx.executor.insert(lbAdvanceRecoveries).values(rows.map(r => ({ ...r })));
    }

    deleteByProject(): Promise<void> {
        return Promise.resolve();
    }
}
