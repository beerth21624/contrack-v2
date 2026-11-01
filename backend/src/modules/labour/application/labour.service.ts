// ─── Shared parts of the labour use cases: transactions, DTOs, posting approved timesheets, building a pay period ───
import { Injectable } from '@nestjs/common';
import {
    PAY_PERIOD_LOCKED_STATUSES, type PayLineDto, type PayPeriodDto, type PayPeriodStatus, type PayPeriodSummaryDto, type Role,
    type TimesheetEntryDto, type WageAdvanceDto,
} from '@contrack/contract';
import { payPeriodOf } from '@contrack/domain/dates/business-date';
import { payPeriodRange, recoverAdvances } from '@contrack/domain/labour/pay-period';
import { round2, sumMoney } from '@contrack/domain/money';
import { type CostLedgerEntryInput, CostLedger, IdGenerator, PeopleDirectory, UnitOfWork } from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../shared/domain/ids';
import { can } from '../../../shared/domain/permissions';
import { type Result, err, okVoid } from '../../../shared/domain/result';
import { advanceStatusOf, requirePeriodUnlocked } from '../domain/labour-state';
import {
    type AdvanceRecoveryRecord, LabourRepository, type PayLineRecord, type PayPeriodRecord, type TimesheetEntryRecord, type WageAdvanceRecord,
} from './ports/labour.repository';

export const MODULE = 'labour';
/** Cost ledger `source_type` of an approved timesheet entry. */
export const LEDGER_SOURCE = 'timesheet';
/** fin_events `source_type` of a pay period / a wage advance. */
export const PERIOD_SOURCE = 'pay_period';
export const ADVANCE_SOURCE = 'wage_advance';

/** Thrown inside a transaction so an `err` rolls it back (the UnitOfWork commits on a normal return). */
class Rollback extends Error {
    constructor(readonly error: DomainError) {
        super(error.message);
    }
}

/** Runs `work` in one transaction; an `err` result rolls everything back and is returned. Joins an open transaction. */
export async function transact<T>(uow: UnitOfWork, work: () => Promise<Result<T, DomainError>>): Promise<Result<T, DomainError>> {
    try {
        return await uow.run(async () => {
            const r = await work();
            if (!r.ok) throw new Rollback(r.error);
            return r;
        });
    } catch (e) {
        if (e instanceof Rollback) return err(e.error);
        throw e;
    }
}

export const seesWages = (role: Role): boolean => can(role, 'workforce.seeWages');

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;
const hide = (v: number, wages: boolean): number | null => (wages ? v : null);

export function entryDto(e: TimesheetEntryRecord, personName: string, wages: boolean): TimesheetEntryDto {
    return {
        id: e.id, projectId: e.projectId, personId: e.personId, personName, workDate: e.workDate, crewId: e.crewId, costCodeId: e.costCodeId,
        days: e.days, otHours: e.otHours, dailyWage: hide(e.dailyWage, wages), otRate: hide(e.otRate, wages), amount: hide(e.amount, wages),
        status: e.status, pendingApproval: e.status === 'draft' && e.approvalBatchId !== null, payPeriodId: e.payPeriodId, source: e.source,
        note: e.note, recordedBy: e.recordedBy, approvedBy: e.approvedBy, approvedAt: iso(e.approvedAt), updatedAt: e.updatedAt.toISOString(),
    };
}

/** A period not built yet (no row): open, zero totals. */
export function virtualPeriodSummary(periodKey: string): PayPeriodSummaryDto {
    const { startDate, endDate } = payPeriodRange(periodKey);
    return {
        id: null, periodKey, startDate, endDate, status: 'open', gross: 0, advanceDeduction: 0, net: 0, lineCount: 0, builtAt: null,
        approvedBy: null, approvedAt: null, paidDate: null, paidAt: null, paymentMethod: null,
    };
}

export function periodSummaryDto(p: PayPeriodRecord, lineCount: number): PayPeriodSummaryDto {
    return {
        id: p.id, periodKey: p.periodKey, startDate: p.startDate, endDate: p.endDate, status: p.status, gross: p.gross,
        advanceDeduction: p.advanceDeduction, net: p.net, lineCount, builtAt: iso(p.builtAt), approvedBy: p.approvedBy,
        approvedAt: iso(p.approvedAt), paidDate: p.paidDate, paidAt: iso(p.paidAt), paymentMethod: p.paymentMethod,
    };
}

export function lineDto(l: PayLineRecord, wages: boolean): PayLineDto {
    return {
        id: l.id, personId: l.personId, personName: l.personName, days: l.days, otHours: l.otHours, gross: hide(l.gross, wages),
        advanceDeduction: hide(l.advanceDeduction, wages), otherDeduction: hide(l.otherDeduction, wages), net: hide(l.net, wages),
        paid: l.paid, note: l.note,
    };
}

export function advanceDto(a: WageAdvanceRecord, personName: string, wages: boolean): WageAdvanceDto {
    return {
        id: a.id, personId: a.personId, personName, advanceDate: a.advanceDate, amount: hide(a.amount, wages),
        recoveredAmount: hide(a.recoveredAmount, wages), outstanding: hide(round2(a.amount - a.recoveredAmount), wages), reason: a.reason,
        status: a.status, paidAt: iso(a.paidAt), paymentMethod: a.paymentMethod, createdBy: a.createdBy, createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
    };
}

@Injectable()
export class LabourViews {
    constructor(private readonly repo: LabourRepository, private readonly people: PeopleDirectory) {}

    /** person id → name ('' when unknown). */
    async names(workspaceId: WorkspaceId, personIds: readonly string[]): Promise<Map<string, string>> {
        const found = await this.people.find(workspaceId, personIds, { wages: false });
        return new Map([...found].map(([id, p]) => [id, p.name]));
    }

    /** Status of the pay period a work date falls in (undefined = not built). */
    async periodStatusOf(workspaceId: WorkspaceId, date: string): Promise<{ periodKey: string; status: PayPeriodStatus | undefined }> {
        const periodKey = payPeriodOf(date);
        return { periodKey, status: (await this.repo.findPeriodByKey(workspaceId, periodKey))?.status };
    }

    async periodDetail(p: PayPeriodRecord, role: Role): Promise<PayPeriodDto> {
        const ws = p.workspaceId;
        const [lines, drafts] = await Promise.all([
            this.repo.linesOf(ws, p.id),
            this.repo.entriesInRange(ws, { from: p.startDate, to: p.endDate, statuses: ['draft'] }),
        ]);
        const wages = seesWages(role);
        const pays = can(role, 'labour.pay');
        return {
            ...periodSummaryDto(p, lines.length),
            lines: lines.map(l => lineDto(l, wages)),
            unapprovedCount: drafts.length,
            wagesHidden: !wages,
            canBuild: pays && p.status === 'open',
            canApprove: pays && p.status === 'open',
            canPay: pays && p.status === 'approved',
        };
    }
}

/** Posts approved timesheets (status, cost ledger) and builds pay periods (lines, advance recoveries). */
@Injectable()
export class LabourEffects {
    constructor(
        private readonly repo: LabourRepository,
        private readonly ledger: CostLedger,
        private readonly people: PeopleDirectory,
        private readonly ids: IdGenerator,
    ) {}

    /**
     * Marks the draft entries approved and posts one `actual` labour row per entry with an amount (cost code of the
     * entry, null = overhead). 409 `period_locked` when one of them falls in a locked pay period. In the caller's transaction.
     */
    async approveEntries(
        workspaceId: WorkspaceId, entries: readonly TimesheetEntryRecord[], by: UserId, now: Date,
    ): Promise<Result<void, DomainError>> {
        if (entries.length === 0) return okVoid();
        for (const key of new Set(entries.map(e => payPeriodOf(e.workDate)))) {
            const locked = requirePeriodUnlocked((await this.repo.findPeriodByKey(workspaceId, key))?.status, key);
            if (!locked.ok) return locked;
        }
        const names = new Map([...(await this.people.find(workspaceId, entries.map(e => e.personId), { wages: false }))].map(([id, p]) => [id, p.name]));
        await this.repo.saveEntries(entries.map(e => ({
            ...e, status: 'approved' as const, approvalBatchId: null, approvedBy: by, approvedAt: now, updatedAt: now,
        })));
        const rows: CostLedgerEntryInput[] = entries.filter(e => e.amount > 0).map(e => ({
            projectId: e.projectId, costCodeId: e.costCodeId, entryDate: e.workDate, kind: 'actual', category: 'labour', amount: e.amount,
            qty: e.days, sourceType: LEDGER_SOURCE, sourceId: e.id, note: names.get(e.personId) ?? '', by,
        }));
        if (rows.length === 0) return okVoid();
        const posted = await this.ledger.post(workspaceId, rows);
        return posted.ok ? okVoid() : posted;
    }

    /**
     * (Re)builds an open period: links every approved entry of its dates, one line per person (Σ days, OT, amount),
     * and deducts wage advances (paid, not written off, dated up to the period's end) oldest first up to the gross.
     * Recoveries of a previous build of this period are given back first. Saves the totals. In the caller's transaction,
     * with the period locked.
     */
    async build(period: PayPeriodRecord, by: UserId, now: Date): Promise<PayPeriodRecord> {
        const ws = period.workspaceId;
        const entries = await this.repo.entriesInRange(ws, { from: period.startDate, to: period.endDate, statuses: ['approved'] });
        const stale = (await this.repo.entriesOfPeriod(ws, period.id)).filter(e => !entries.some(x => x.id === e.id)).map(e => e.id);
        await this.repo.linkEntries(ws, stale, null);
        await this.repo.linkEntries(ws, entries.filter(e => e.payPeriodId !== period.id).map(e => e.id), period.id);

        const byPerson = new Map<string, TimesheetEntryRecord[]>();
        for (const e of entries) byPerson.set(e.personId, [...(byPerson.get(e.personId) ?? []), e]);

        const oldLines = await this.repo.linesOf(ws, period.id);
        const oldRecoveries = await this.repo.recoveriesOfLines(ws, oldLines.map(l => l.id));
        const personIds = [...new Set([...byPerson.keys(), ...oldLines.map(l => l.personId)])];
        const advances = await this.repo.lockAdvancesOf(ws, personIds);
        await this.repo.replaceLines(ws, period.id, []);

        // What other periods already recovered (this period's old recoveries are gone now).
        const touched = new Set([...oldRecoveries.map(r => r.advanceId), ...advances.map(a => a.id)]);
        const recoveredElsewhere = await this.repo.recoveredByAdvance(ws, [...touched]);

        const names = await this.people.find(ws, [...byPerson.keys()], { wages: false });
        const lines: PayLineRecord[] = [];
        const recoveries: AdvanceRecoveryRecord[] = [];
        const recoveredNow = new Map<string, number>();
        for (const [personId, rows] of byPerson) {
            const gross = sumMoney(rows.map(r => r.amount));
            const open = advances
                .filter(a => a.personId === personId && a.paidAt !== null && a.advanceDate <= period.endDate
                    && (a.status === 'open' || a.status === 'partially_recovered' || a.status === 'recovered'))
                .map(a => ({ id: a.id, advanceDate: a.advanceDate, createdAt: a.createdAt, outstanding: round2(a.amount - (recoveredElsewhere.get(a.id) ?? 0)) }));
            const lineId = this.ids.newId();
            const taken = recoverAdvances(gross, open);
            for (const t of taken) {
                recoveries.push({ advanceId: t.advanceId, payLineId: lineId, workspaceId: ws, amount: t.amount });
                recoveredNow.set(t.advanceId, round2((recoveredNow.get(t.advanceId) ?? 0) + t.amount));
            }
            const deduction = sumMoney(taken.map(t => t.amount));
            lines.push({
                id: lineId, workspaceId: ws, periodId: period.id, personId, personName: names.get(personId)?.name ?? '',
                days: round2(rows.reduce((s, r) => s + r.days, 0)), otHours: Math.round(rows.reduce((s, r) => s + r.otHours, 0) * 10) / 10,
                gross, advanceDeduction: deduction, otherDeduction: 0, net: round2(gross - deduction), paid: false, note: '',
            });
        }
        await this.repo.replaceLines(ws, period.id, lines);
        await this.repo.insertRecoveries(recoveries);

        for (const a of advances.filter(x => touched.has(x.id))) {
            const recovered = round2((recoveredElsewhere.get(a.id) ?? 0) + (recoveredNow.get(a.id) ?? 0));
            const status = a.status === 'written_off' ? a.status : advanceStatusOf(a.amount, recovered);
            if (recovered !== a.recoveredAmount || status !== a.status) {
                await this.repo.saveAdvance({ ...a, recoveredAmount: recovered, status, updatedAt: now });
            }
        }

        const gross = sumMoney(lines.map(l => l.gross));
        const advanceDeduction = sumMoney(lines.map(l => l.advanceDeduction));
        const built: PayPeriodRecord = {
            ...period, gross, advanceDeduction, net: round2(gross - advanceDeduction), builtAt: now, builtBy: by, updatedAt: now,
        };
        await this.repo.savePeriod(built);
        return built;
    }

    /** A new period row (status open) for the key, or the existing one; locked. */
    async ensurePeriod(workspaceId: WorkspaceId, periodKey: string, now: Date): Promise<PayPeriodRecord> {
        const { startDate, endDate } = payPeriodRange(periodKey);
        return this.repo.ensurePeriod({
            id: this.ids.newId(), workspaceId, periodKey, startDate, endDate, status: 'open', gross: 0, advanceDeduction: 0, net: 0,
            builtAt: null, builtBy: null, approvedBy: null, approvedAt: null, paidDate: null, paidAt: null, paidBy: null, paymentMethod: null,
            createdAt: now, updatedAt: now,
        });
    }
}

/** True when timesheets of a period in this status are locked. */
export const isLocked = (status: PayPeriodStatus | undefined): boolean => status !== undefined && PAY_PERIOD_LOCKED_STATUSES.includes(status);

export const periodNotFound = (): DomainError => DomainError.notFound('PayPeriod');
