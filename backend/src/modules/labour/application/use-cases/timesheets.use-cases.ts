// ─── Timesheet use cases (docs/erp/04-implementation-plan.md WP-44, docs/erp/02-domain-model.md §8.2) ───
// Read `labour.read`; write a day and approve a range `labour.record`. Work dates are Bangkok business dates, never after
// today (422 `future_work_date`). A person's wage and the amounts are null without `workforce.seeWages`.
import { Injectable } from '@nestjs/common';
import {
    type ApproveTimesheetsRequest, type ApproveTimesheetsResultDto, type PutTimesheetDayRequest, TIMESHEET_APPROVE_MAX_DAYS,
    TIMESHEET_DAY_HOURS, type TimesheetDayDto, type TimesheetSuggestionDto,
} from '@contrack/contract';
import { bangkokToday, daysBetween, payPeriodOf } from '@contrack/domain/dates/business-date';
import { defaultOtRate, timesheetAmount } from '@contrack/domain/labour/pay-period';
import { round2, sumMoney } from '@contrack/domain/money';
import { type ProjectGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    Approvals, AuditLog, Clock, CostCodeLookup, CrewDailyCost, IdGenerator, PeopleDirectory, SiteDiaryManpower, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { requireNotFuture, requirePeriodUnlocked } from '../../domain/labour-state';
import { LabourEffects, LabourViews, MODULE, entryDto, isLocked, seesWages, transact } from '../labour.service';
import { LabourRepository, type TimesheetEntryRecord } from '../ports/labour.repository';

const READ = ['labour.read' as const];
const RECORD = ['labour.record' as const];

const lower = (id: string | null | undefined): string | null => (id === undefined || id === null ? null : id.toLowerCase());
const roundHours = (v: number): number => Math.round(v * 10) / 10;

/** Authorizes on the project, then refuses a date after today (Bangkok). */
async function projectDay(
    access: ModuleAccess, clock: Clock, userId: UserId, projectId: ProjectId, workDate: string, write: boolean,
): Promise<Result<ProjectGrant, DomainError>> {
    const grant = await access.toProject(userId, projectId, MODULE, { permissions: write ? RECORD : READ, write });
    if (!grant.ok) return grant;
    const future = requireNotFuture(workDate, bangkokToday(clock.now()));
    return future.ok ? grant : future;
}

/** The day's entries, suggestions (from the site report's crews while the day has none) and totals. */
@Injectable()
export class TimesheetDayView {
    constructor(
        private readonly repo: LabourRepository,
        private readonly views: LabourViews,
        private readonly people: PeopleDirectory,
        private readonly diary: SiteDiaryManpower,
    ) {}

    async build(grant: ProjectGrant, projectId: ProjectId, workDate: string): Promise<TimesheetDayDto> {
        const ws = grant.workspaceId;
        const wages = seesWages(grant.role);
        const entries = await this.repo.entriesOfDay(ws, projectId, workDate);
        const { periodKey, status } = await this.views.periodStatusOf(ws, workDate);
        const locked = isLocked(status);
        const names = await this.views.names(ws, entries.map(e => e.personId));
        const suggestions = entries.length === 0 ? await this.suggestions(grant, projectId, workDate) : [];
        return {
            projectId, workDate, periodKey, periodStatus: status ?? 'open', locked,
            entries: entries.map(e => entryDto(e, names.get(e.personId) ?? '', wages)),
            suggestions,
            totals: {
                days: round2(entries.reduce((s, e) => s + e.days, 0)),
                otHours: roundHours(entries.reduce((s, e) => s + e.otHours, 0)),
                amount: wages ? sumMoney(entries.map(e => e.amount)) : null,
            },
            wagesHidden: !wages,
            canEdit: can(grant.role, 'labour.record') && !grant.archived && !locked,
        };
    }

    /** The named members of the crews on that day's site report (a person in two crews: the first one). */
    private async suggestions(grant: ProjectGrant, projectId: ProjectId, workDate: string): Promise<TimesheetSuggestionDto[]> {
        const ws = grant.workspaceId;
        const crews = await this.diary.crewsOn(ws, projectId, workDate);
        if (crews.length === 0) return [];
        const members = await this.people.crewMembers(ws, crews.map(c => c.crewId));
        const personIds = [...new Set([...members.values()].flatMap(m => m.personIds))];
        const people = await this.people.find(ws, personIds, { wages: seesWages(grant.role) });
        const out: TimesheetSuggestionDto[] = [];
        const seen = new Set<string>();
        for (const c of crews) {
            const crew = members.get(c.crewId.toLowerCase());
            if (crew === undefined) continue;
            for (const personId of crew.personIds) {
                const p = people.get(personId);
                if (p === undefined || p.archived || seen.has(personId)) continue;
                seen.add(personId);
                out.push({
                    personId, personName: p.name, crewId: c.crewId, crewName: crew.crewName, costCodeId: c.costCodeId,
                    days: c.hours > 0 && c.hours <= TIMESHEET_DAY_HOURS / 2 ? 0.5 : 1,
                    otHours: roundHours(Math.max(0, Math.min(24, c.hours - TIMESHEET_DAY_HOURS))), dailyWage: p.dailyWage,
                });
            }
        }
        return out;
    }
}

/** GET /projects/:projectId/timesheets/:date — `labour.read`. */
@Injectable()
export class GetTimesheetDayUseCase {
    constructor(private readonly access: ModuleAccess, private readonly clock: Clock, private readonly day: TimesheetDayView) {}

    async execute(userId: UserId, projectId: ProjectId, workDate: string): Promise<Result<TimesheetDayDto, DomainError>> {
        const grant = await projectDay(this.access, this.clock, userId, projectId, workDate, false);
        if (!grant.ok) return grant;
        return ok(await this.day.build(grant.value, projectId, workDate));
    }
}

/**
 * PUT /projects/:projectId/timesheets/:date — `labour.record`: replaces the day's draft entries of the project.
 * 409 `period_locked` (the day's pay period is pending_approval / approved / paid), 409 `approval_pending` (a draft of
 * the day waits for `timesheet.approve`), 409 `entry_approved` (a person already approved that day), 422
 * `duplicate_person`, 422 `over_one_day` (Σ days of a person that day across projects > 1), 422 `daily_wage_required`;
 * people / crews / cost codes not of the workspace / project → 404.
 */
@Injectable()
export class PutTimesheetDayUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: LabourRepository,
        private readonly views: LabourViews,
        private readonly day: TimesheetDayView,
        private readonly people: PeopleDirectory,
        private readonly crews: CrewDailyCost,
        private readonly costCodes: CostCodeLookup,
        private readonly ids: IdGenerator,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: {
        userId: UserId; projectId: ProjectId; workDate: string; body: PutTimesheetDayRequest;
    }): Promise<Result<TimesheetDayDto, DomainError>> {
        const { userId, projectId, workDate, body } = input;
        const grant = await projectDay(this.access, this.clock, userId, projectId, workDate, true);
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const wages = seesWages(grant.value.role);

        const rows = body.entries.map(e => ({ ...e, personId: e.personId.toLowerCase(), crewId: lower(e.crewId), costCodeId: lower(e.costCodeId) }));
        const personIds = rows.map(r => r.personId);
        const dup = personIds.find((id, i) => personIds.indexOf(id) !== i);
        if (dup !== undefined) {
            return err(DomainError.unprocessable('A person can appear only once per day', { reason: 'duplicate_person', personId: dup }));
        }
        const people = await this.people.find(ws, personIds, { wages: true });
        if (personIds.some(id => !people.has(id))) return err(DomainError.notFound('Person'));
        const crewIds = [...new Set(rows.map(r => r.crewId).filter((c): c is string => c !== null))];
        if (crewIds.length > 0) {
            const found = await this.crews.dailyCostOf(ws, crewIds);
            if (crewIds.some(id => !found.has(id))) return err(DomainError.notFound('Crew'));
        }
        const codeIds = [...new Set(rows.map(r => r.costCodeId).filter((c): c is string => c !== null))];
        if (codeIds.length > 0) {
            const found = new Set((await this.costCodes.findMany(ws, projectId, codeIds)).map(c => c.id));
            if (codeIds.some(id => !found.has(id))) return err(DomainError.notFound('CostCode'));
        }

        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const { periodKey, status } = await this.views.periodStatusOf(ws, workDate);
            const unlocked = requirePeriodUnlocked(status, periodKey);
            if (!unlocked.ok) return unlocked;
            const existing = await this.repo.entriesOfDay(ws, projectId, workDate);
            await this.repo.lockPersonDays(ws, [...personIds, ...existing.map(e => e.personId)], workDate);
            if (existing.some(e => e.status === 'draft' && e.approvalBatchId !== null)) {
                return err(DomainError.conflict('Timesheets of this day are waiting for approval', { reason: 'approval_pending' }));
            }
            const settled = new Set(existing.filter(e => e.status !== 'draft').map(e => e.personId));
            const clash = personIds.find(id => settled.has(id));
            if (clash !== undefined) {
                return err(DomainError.conflict('This person is already approved for the day', { reason: 'entry_approved', personId: clash }));
            }

            // Σ days of each person that day, other projects included.
            const elsewhere = (await this.repo.entriesOfPeopleOn(ws, personIds, workDate)).filter(e => e.projectId !== projectId);
            for (const r of rows) {
                const total = elsewhere.filter(e => e.personId === r.personId).reduce((s, e) => s + e.days, 0) + r.days;
                if (total > 1 + 1e-9) {
                    return err(DomainError.unprocessable('A person can work at most one day per day across projects', {
                        reason: 'over_one_day', personId: r.personId, days: round2(total),
                    }));
                }
            }

            const now = this.clock.now();
            const drafts = new Map(existing.filter(e => e.status === 'draft').map(e => [e.personId, e]));
            const inserts: TimesheetEntryRecord[] = [];
            const updates: TimesheetEntryRecord[] = [];
            for (const r of rows) {
                const prev = drafts.get(r.personId);
                const known = people.get(r.personId)?.dailyWage ?? null;
                // Wage: an override by someone who sees wages → workforce → the entry's snapshot → typed for a person without one.
                const dailyWage = (wages ? r.dailyWage : undefined) ?? known ?? prev?.dailyWage ?? r.dailyWage;
                if (dailyWage === undefined) {
                    return err(DomainError.unprocessable('The person has no daily wage; enter one', { reason: 'daily_wage_required', personId: r.personId }));
                }
                const otHours = roundHours(r.otHours ?? 0);
                const otRate = round2((wages ? r.otRate : undefined) ?? (prev?.dailyWage === dailyWage ? prev.otRate : defaultOtRate(dailyWage)));
                const fields = {
                    crewId: r.crewId, costCodeId: r.costCodeId, days: r.days, otHours, dailyWage: round2(dailyWage), otRate,
                    amount: timesheetAmount(r.days, dailyWage, otHours, otRate), source: r.source ?? prev?.source ?? 'manual', note: r.note ?? '',
                };
                if (prev !== undefined) {
                    updates.push({ ...prev, ...fields, recordedBy: userId, updatedAt: now });
                } else {
                    inserts.push({
                        id: this.ids.newId(), workspaceId: ws, projectId, personId: r.personId, workDate, ...fields, status: 'draft',
                        approvalBatchId: null, payPeriodId: null, recordedBy: userId, approvedBy: null, approvedAt: null, createdAt: now, updatedAt: now,
                    });
                }
            }
            const keep = new Set(personIds);
            await this.repo.deleteEntries(ws, [...drafts.values()].filter(e => !keep.has(e.personId)).map(e => e.id));
            await this.repo.saveEntries(updates);
            await this.repo.insertEntries(inserts);
            return ok(undefined);
        });
        if (!done.ok) return done;
        return ok(await this.day.build(grant.value, projectId, workDate));
    }
}

/**
 * POST /projects/:projectId/timesheets/approve {from, to} — `labour.record`: the project's draft entries of the range
 * (not already waiting) go to `timesheet.approve`; approved at once (policy off by default) → status approved + actual
 * labour cost per cost code. 409 `period_locked` when one falls in a locked pay period; at most 62 days.
 */
@Injectable()
export class ApproveTimesheetsUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: LabourRepository,
        private readonly effects: LabourEffects,
        private readonly approvals: Approvals,
        private readonly audit: AuditLog,
        private readonly ids: IdGenerator,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: ApproveTimesheetsRequest }): Promise<Result<ApproveTimesheetsResultDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: RECORD, write: true });
        if (!grant.ok) return grant;
        if (daysBetween(body.from, body.to) + 1 > TIMESHEET_APPROVE_MAX_DAYS) {
            return err(DomainError.validation(`At most ${TIMESHEET_APPROVE_MAX_DAYS} days at a time`, { field: 'to' }));
        }
        const ws = grant.value.workspaceId;
        const wages = seesWages(grant.value.role);

        const done = await transact(this.uow, async (): Promise<Result<{ dto: ApproveTimesheetsResultDto; pending: string | null }, DomainError>> => {
            const drafts = (await this.repo.entriesInRange(ws, { from: body.from, to: body.to, projectId, statuses: ['draft'] }))
                .filter(e => e.approvalBatchId === null);
            if (drafts.length === 0) return ok({ dto: { status: 'none', entryCount: 0, amount: wages ? 0 : null, approvalRequestId: null }, pending: null });
            const amount = sumMoney(drafts.map(e => e.amount));
            const batchId = this.ids.newId();
            const now = this.clock.now();
            // Refuse a locked period before asking for the approval (approveEntries checks again when applied).
            for (const key of new Set(drafts.map(e => payPeriodOf(e.workDate)))) {
                const unlocked = requirePeriodUnlocked((await this.repo.findPeriodByKey(ws, key))?.status, key);
                if (!unlocked.ok) return unlocked;
            }
            const ticket = await this.approvals.request({
                workspaceId: ws, subject: 'timesheet.approve', subjectId: batchId, projectId, amount, title: `${body.from} – ${body.to}`,
                requestedBy: userId, requesterRole: grant.value.role,
            });
            if (!ticket.ok) return ticket;
            const approved = ticket.value.status === 'approved';
            if (approved) {
                const applied = await this.effects.approveEntries(ws, drafts, userId, now);
                if (!applied.ok) return applied;
            } else {
                await this.repo.saveEntries(drafts.map(e => ({ ...e, approvalBatchId: batchId, updatedAt: now })));
            }
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'timesheet', entityId: batchId, action: approved ? 'approved' : 'submit',
                data: { from: body.from, to: body.to, entries: drafts.length, amount, approvalRequestId: ticket.value.requestId },
            });
            return ok({
                dto: {
                    status: approved ? 'approved' : 'pending', entryCount: drafts.length, amount: wages ? amount : null,
                    approvalRequestId: ticket.value.requestId,
                },
                pending: approved ? null : ticket.value.requestId,
            });
        });
        if (!done.ok) return done;
        if (done.value.pending !== null) await this.approvals.notifyRequested(done.value.pending);
        return ok(done.value.dto);
    }
}
