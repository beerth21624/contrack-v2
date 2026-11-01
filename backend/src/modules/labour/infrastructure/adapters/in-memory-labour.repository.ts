import type { PayPeriodStatus, WageAdvanceStatus } from '@contrack/contract';
import { round2 } from '@contrack/domain/money';
import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import {
    type AdvanceRecoveryRecord, type EntryRange, LabourRepository, type PayLineRecord, type PayPeriodRecord, type TimesheetEntryRecord,
    type WageAdvanceRecord,
} from '../../application/ports/labour.repository';

const clone = <T>(v: T): T => structuredClone(v);
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Memory adapter (tests / trying without a database); mimics unique `(person_id, work_date, project_id)` and `(workspace_id, period_key)`. */
export class InMemoryLabourRepository extends LabourRepository {
    private readonly entries = new Map<string, TimesheetEntryRecord>();
    private readonly periods = new Map<string, PayPeriodRecord>();
    private readonly lines = new Map<string, PayLineRecord>();
    private readonly advances = new Map<string, WageAdvanceRecord>();
    private recoveries: AdvanceRecoveryRecord[] = [];

    private all(ws: WorkspaceId): TimesheetEntryRecord[] {
        return [...this.entries.values()].filter(e => e.workspaceId === ws);
    }

    private static ordered(rows: TimesheetEntryRecord[]): TimesheetEntryRecord[] {
        return rows.sort((a, b) => cmp(a.workDate, b.workDate) || a.createdAt.getTime() - b.createdAt.getTime() || cmp(a.id, b.id)).map(clone);
    }

    // ── timesheets ──

    lockPersonDays(): Promise<void> {
        return Promise.resolve();
    }

    entriesOfDay(workspaceId: WorkspaceId, projectId: ProjectId, date: string): Promise<TimesheetEntryRecord[]> {
        return Promise.resolve(InMemoryLabourRepository.ordered(this.all(workspaceId).filter(e => e.projectId === projectId && e.workDate === date)));
    }

    entriesOfPeopleOn(workspaceId: WorkspaceId, personIds: readonly string[], date: string): Promise<TimesheetEntryRecord[]> {
        const ids = new Set(personIds);
        return Promise.resolve(InMemoryLabourRepository.ordered(this.all(workspaceId).filter(e => ids.has(e.personId) && e.workDate === date)));
    }

    entriesInRange(workspaceId: WorkspaceId, range: EntryRange): Promise<TimesheetEntryRecord[]> {
        return Promise.resolve(InMemoryLabourRepository.ordered(this.all(workspaceId).filter(e =>
            e.workDate >= range.from && e.workDate <= range.to
            && (range.projectId === undefined || e.projectId === range.projectId)
            && (range.statuses === undefined || range.statuses.includes(e.status)))));
    }

    entriesByBatch(workspaceId: WorkspaceId, batchId: string): Promise<TimesheetEntryRecord[]> {
        return Promise.resolve(InMemoryLabourRepository.ordered(this.all(workspaceId).filter(e => e.approvalBatchId === batchId)));
    }

    entriesOfPeriod(workspaceId: WorkspaceId, periodId: string): Promise<TimesheetEntryRecord[]> {
        return Promise.resolve(InMemoryLabourRepository.ordered(this.all(workspaceId).filter(e => e.payPeriodId === periodId)));
    }

    insertEntries(rows: readonly TimesheetEntryRecord[]): Promise<void> {
        for (const r of rows) {
            const clash = [...this.entries.values()].some(o =>
                o.id === r.id || (o.personId === r.personId && o.workDate === r.workDate && o.projectId === r.projectId));
            if (clash) return Promise.reject(new Error(`duplicate timesheet entry ${r.personId} ${r.workDate}`));
            this.entries.set(r.id, clone(r));
        }
        return Promise.resolve();
    }

    saveEntries(rows: readonly TimesheetEntryRecord[]): Promise<void> {
        for (const r of rows) if (this.entries.get(r.id)?.workspaceId === r.workspaceId) this.entries.set(r.id, clone(r));
        return Promise.resolve();
    }

    deleteEntries(workspaceId: WorkspaceId, ids: readonly string[]): Promise<void> {
        for (const id of ids) if (this.entries.get(id)?.workspaceId === workspaceId) this.entries.delete(id);
        return Promise.resolve();
    }

    linkEntries(workspaceId: WorkspaceId, ids: readonly string[], periodId: string | null): Promise<void> {
        for (const id of ids) {
            const e = this.entries.get(id);
            if (e?.workspaceId === workspaceId) this.entries.set(id, { ...e, payPeriodId: periodId, updatedAt: new Date() });
        }
        return Promise.resolve();
    }

    workspacesWithEntries(from: string, to: string, limit: number): Promise<WorkspaceId[]> {
        const out = new Set<WorkspaceId>();
        for (const e of this.entries.values()) if (e.workDate >= from && e.workDate <= to && e.status !== 'paid') out.add(e.workspaceId);
        return Promise.resolve([...out].slice(0, limit));
    }

    // ── pay periods ──

    findPeriod(periodId: string): Promise<PayPeriodRecord | undefined> {
        const p = this.periods.get(periodId);
        return Promise.resolve(p === undefined ? undefined : clone(p));
    }

    findPeriodByKey(workspaceId: WorkspaceId, periodKey: string): Promise<PayPeriodRecord | undefined> {
        const p = [...this.periods.values()].find(x => x.workspaceId === workspaceId && x.periodKey === periodKey);
        return Promise.resolve(p === undefined ? undefined : clone(p));
    }

    lockPeriod(workspaceId: WorkspaceId, periodId: string): Promise<PayPeriodRecord | undefined> {
        const p = this.periods.get(periodId);
        return Promise.resolve(p?.workspaceId === workspaceId ? clone(p) : undefined);
    }

    listPeriods(workspaceId: WorkspaceId, filter: { year?: number; statuses?: readonly PayPeriodStatus[] }): Promise<PayPeriodRecord[]> {
        return Promise.resolve([...this.periods.values()]
            .filter(p => p.workspaceId === workspaceId
                && (filter.year === undefined || p.periodKey.startsWith(`${filter.year}-`))
                && (filter.statuses === undefined || filter.statuses.includes(p.status)))
            .sort((a, b) => cmp(b.periodKey, a.periodKey))
            .map(clone));
    }

    async ensurePeriod(row: PayPeriodRecord): Promise<PayPeriodRecord> {
        const found = await this.findPeriodByKey(row.workspaceId, row.periodKey);
        if (found !== undefined) return found;
        this.periods.set(row.id, clone(row));
        return clone(row);
    }

    savePeriod(row: PayPeriodRecord): Promise<void> {
        if (this.periods.get(row.id)?.workspaceId === row.workspaceId) this.periods.set(row.id, clone(row));
        return Promise.resolve();
    }

    linesOf(workspaceId: WorkspaceId, periodId: string): Promise<PayLineRecord[]> {
        return Promise.resolve([...this.lines.values()]
            .filter(l => l.workspaceId === workspaceId && l.periodId === periodId)
            .sort((a, b) => cmp(a.personName, b.personName) || cmp(a.id, b.id))
            .map(clone));
    }

    lineCounts(workspaceId: WorkspaceId, periodIds: readonly string[]): Promise<Map<string, number>> {
        const out = new Map<string, number>();
        const ids = new Set(periodIds);
        for (const l of this.lines.values()) if (l.workspaceId === workspaceId && ids.has(l.periodId)) out.set(l.periodId, (out.get(l.periodId) ?? 0) + 1);
        return Promise.resolve(out);
    }

    replaceLines(workspaceId: WorkspaceId, periodId: string, lines: readonly PayLineRecord[]): Promise<void> {
        const old = new Set([...this.lines.values()].filter(l => l.workspaceId === workspaceId && l.periodId === periodId).map(l => l.id));
        for (const id of old) this.lines.delete(id);
        this.recoveries = this.recoveries.filter(r => !old.has(r.payLineId));
        for (const l of lines) this.lines.set(l.id, clone(l));
        return Promise.resolve();
    }

    markLinesPaid(workspaceId: WorkspaceId, periodId: string): Promise<void> {
        for (const l of this.lines.values()) if (l.workspaceId === workspaceId && l.periodId === periodId) l.paid = true;
        return Promise.resolve();
    }

    // ── advances ──

    findAdvance(advanceId: string): Promise<WageAdvanceRecord | undefined> {
        const a = this.advances.get(advanceId);
        return Promise.resolve(a === undefined ? undefined : clone(a));
    }

    lockAdvance(workspaceId: WorkspaceId, advanceId: string): Promise<WageAdvanceRecord | undefined> {
        const a = this.advances.get(advanceId);
        return Promise.resolve(a?.workspaceId === workspaceId ? clone(a) : undefined);
    }

    lockAdvancesOf(workspaceId: WorkspaceId, personIds: readonly string[]): Promise<WageAdvanceRecord[]> {
        const ids = new Set(personIds);
        return Promise.resolve([...this.advances.values()].filter(a => a.workspaceId === workspaceId && ids.has(a.personId)).map(clone));
    }

    listAdvances(workspaceId: WorkspaceId, filter: { personId?: string; status?: WageAdvanceStatus }): Promise<WageAdvanceRecord[]> {
        return Promise.resolve([...this.advances.values()]
            .filter(a => a.workspaceId === workspaceId
                && (filter.personId === undefined || a.personId === filter.personId)
                && (filter.status === undefined || a.status === filter.status))
            .sort((a, b) => cmp(b.advanceDate, a.advanceDate) || b.createdAt.getTime() - a.createdAt.getTime())
            .map(clone));
    }

    insertAdvance(row: WageAdvanceRecord): Promise<void> {
        this.advances.set(row.id, clone(row));
        return Promise.resolve();
    }

    saveAdvance(row: WageAdvanceRecord): Promise<void> {
        if (this.advances.get(row.id)?.workspaceId === row.workspaceId) this.advances.set(row.id, clone(row));
        return Promise.resolve();
    }

    recoveriesOfLines(workspaceId: WorkspaceId, lineIds: readonly string[]): Promise<AdvanceRecoveryRecord[]> {
        const ids = new Set(lineIds);
        return Promise.resolve(this.recoveries.filter(r => r.workspaceId === workspaceId && ids.has(r.payLineId)).map(clone));
    }

    recoveredByAdvance(workspaceId: WorkspaceId, advanceIds: readonly string[]): Promise<Map<string, number>> {
        const ids = new Set(advanceIds);
        const out = new Map<string, number>();
        for (const r of this.recoveries) {
            if (r.workspaceId === workspaceId && ids.has(r.advanceId)) out.set(r.advanceId, round2((out.get(r.advanceId) ?? 0) + r.amount));
        }
        return Promise.resolve(out);
    }

    insertRecoveries(rows: readonly AdvanceRecoveryRecord[]): Promise<void> {
        this.recoveries.push(...rows.map(clone));
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const [id, e] of this.entries) if (e.workspaceId === workspaceId && e.projectId === projectId) this.entries.delete(id);
        return Promise.resolve();
    }
}
