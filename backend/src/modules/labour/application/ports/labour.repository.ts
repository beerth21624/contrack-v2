import type {
    LabourPaymentMethod, PayPeriodStatus, TimesheetSource, TimesheetStatus, WageAdvanceStatus,
} from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** One `lb_timesheet_entries` row. */
export interface TimesheetEntryRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    personId: string;
    workDate: string;
    crewId: string | null;
    costCodeId: string | null;
    days: number;
    otHours: number;
    dailyWage: number;
    otRate: number;
    amount: number;
    status: TimesheetStatus;
    approvalBatchId: string | null;
    payPeriodId: string | null;
    source: TimesheetSource;
    note: string;
    recordedBy: UserId;
    approvedBy: UserId | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/** One `lb_pay_periods` row. */
export interface PayPeriodRecord {
    id: string;
    workspaceId: WorkspaceId;
    periodKey: string;
    startDate: string;
    endDate: string;
    status: PayPeriodStatus;
    gross: number;
    advanceDeduction: number;
    net: number;
    builtAt: Date | null;
    builtBy: UserId | null;
    approvedBy: UserId | null;
    approvedAt: Date | null;
    paidDate: string | null;
    paidAt: Date | null;
    paidBy: UserId | null;
    paymentMethod: LabourPaymentMethod | null;
    createdAt: Date;
    updatedAt: Date;
}

/** One `lb_pay_lines` row. */
export interface PayLineRecord {
    id: string;
    workspaceId: WorkspaceId;
    periodId: string;
    personId: string;
    personName: string;
    days: number;
    otHours: number;
    gross: number;
    advanceDeduction: number;
    otherDeduction: number;
    net: number;
    paid: boolean;
    note: string;
}

/** One `lb_advances` row. */
export interface WageAdvanceRecord {
    id: string;
    workspaceId: WorkspaceId;
    personId: string;
    advanceDate: string;
    amount: number;
    reason: string;
    status: WageAdvanceStatus;
    recoveredAmount: number;
    paidAt: Date | null;
    paidBy: UserId | null;
    paymentMethod: LabourPaymentMethod | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `lb_advance_recoveries` row. */
export interface AdvanceRecoveryRecord {
    advanceId: string;
    payLineId: string;
    workspaceId: WorkspaceId;
    amount: number;
}

export interface EntryRange {
    from: string;
    to: string;
    projectId?: ProjectId;
    statuses?: readonly TimesheetStatus[];
}

/** Labour rows; every method is scoped by the workspace (`find*ById` returns the row, the caller checks its workspace). */
export abstract class LabourRepository {
    // ── timesheets ──
    /** Serializes writers of these people's day (Σ days ≤ 1 across projects). Inside the caller's transaction. */
    abstract lockPersonDays(workspaceId: WorkspaceId, personIds: readonly string[], date: string): Promise<void>;
    abstract entriesOfDay(workspaceId: WorkspaceId, projectId: ProjectId, date: string): Promise<TimesheetEntryRecord[]>;
    /** Entries of these people on that day, every project. */
    abstract entriesOfPeopleOn(workspaceId: WorkspaceId, personIds: readonly string[], date: string): Promise<TimesheetEntryRecord[]>;
    /** Oldest work date first. */
    abstract entriesInRange(workspaceId: WorkspaceId, range: EntryRange): Promise<TimesheetEntryRecord[]>;
    abstract entriesByBatch(workspaceId: WorkspaceId, batchId: string): Promise<TimesheetEntryRecord[]>;
    abstract entriesOfPeriod(workspaceId: WorkspaceId, periodId: string): Promise<TimesheetEntryRecord[]>;
    abstract insertEntries(rows: readonly TimesheetEntryRecord[]): Promise<void>;
    abstract saveEntries(rows: readonly TimesheetEntryRecord[]): Promise<void>;
    abstract deleteEntries(workspaceId: WorkspaceId, ids: readonly string[]): Promise<void>;
    /** Sets `pay_period_id` of the entries (null = unlink). */
    abstract linkEntries(workspaceId: WorkspaceId, ids: readonly string[], periodId: string | null): Promise<void>;
    /** Workspaces with timesheet entries (any status) between the dates. */
    abstract workspacesWithEntries(from: string, to: string, limit: number): Promise<WorkspaceId[]>;

    // ── pay periods ──
    abstract findPeriod(periodId: string): Promise<PayPeriodRecord | undefined>;
    abstract findPeriodByKey(workspaceId: WorkspaceId, periodKey: string): Promise<PayPeriodRecord | undefined>;
    abstract lockPeriod(workspaceId: WorkspaceId, periodId: string): Promise<PayPeriodRecord | undefined>;
    /** Newest period first; `year` filters on the key. */
    abstract listPeriods(workspaceId: WorkspaceId, filter: { year?: number; statuses?: readonly PayPeriodStatus[] }): Promise<PayPeriodRecord[]>;
    /** Inserts the period unless (workspace, key) exists (concurrent builds), then returns it locked. */
    abstract ensurePeriod(row: PayPeriodRecord): Promise<PayPeriodRecord>;
    abstract savePeriod(row: PayPeriodRecord): Promise<void>;
    abstract linesOf(workspaceId: WorkspaceId, periodId: string): Promise<PayLineRecord[]>;
    abstract lineCounts(workspaceId: WorkspaceId, periodIds: readonly string[]): Promise<Map<string, number>>;
    /** Deletes the period's lines (and their recoveries) and inserts `lines`. */
    abstract replaceLines(workspaceId: WorkspaceId, periodId: string, lines: readonly PayLineRecord[]): Promise<void>;
    abstract markLinesPaid(workspaceId: WorkspaceId, periodId: string): Promise<void>;

    // ── advances ──
    abstract findAdvance(advanceId: string): Promise<WageAdvanceRecord | undefined>;
    abstract lockAdvance(workspaceId: WorkspaceId, advanceId: string): Promise<WageAdvanceRecord | undefined>;
    /** The advances of these people, locked (build of a pay period). */
    abstract lockAdvancesOf(workspaceId: WorkspaceId, personIds: readonly string[]): Promise<WageAdvanceRecord[]>;
    /** Newest first. */
    abstract listAdvances(workspaceId: WorkspaceId, filter: { personId?: string; status?: WageAdvanceStatus }): Promise<WageAdvanceRecord[]>;
    abstract insertAdvance(row: WageAdvanceRecord): Promise<void>;
    abstract saveAdvance(row: WageAdvanceRecord): Promise<void>;
    abstract recoveriesOfLines(workspaceId: WorkspaceId, lineIds: readonly string[]): Promise<AdvanceRecoveryRecord[]>;
    /** Σ recovered per advance over every pay line. */
    abstract recoveredByAdvance(workspaceId: WorkspaceId, advanceIds: readonly string[]): Promise<Map<string, number>>;
    abstract insertRecoveries(rows: readonly AdvanceRecoveryRecord[]): Promise<void>;

    /** Memory adapter: forget a deleted project's entries (PostgreSQL cascades). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
