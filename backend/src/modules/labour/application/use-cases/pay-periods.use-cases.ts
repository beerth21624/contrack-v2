// ─── Pay period and wage advance use cases (docs/erp/04-implementation-plan.md WP-44, docs/erp/02-domain-model.md §8.2) ───
// Read `labour.read`; build / approve / pay a period `labour.pay`; record / change advances `labour.pay` +
// `workforce.seeWages`. Per-person amounts are null without `workforce.seeWages`.
import { Injectable } from '@nestjs/common';
import type {
    CreateWageAdvanceRequest, PatchWageAdvanceRequest, PayPayPeriodRequest, PayPeriodDto, PayPeriodListDto, PayPeriodListQuery,
    WageAdvanceDto, WageAdvanceListDto, WageAdvanceListQuery,
} from '@contrack/contract';
import { bangkokToday, payPeriodOf } from '@contrack/domain/dates/business-date';
import { isPayPeriodKey } from '@contrack/domain/labour/pay-period';
import { allocate, round2 } from '@contrack/domain/money';
import { type WorkspaceGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    Approvals, AuditLog, Clock, FinancialEvents, IdGenerator, PayPeriodBillChecks, PeopleDirectory, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { requirePeriodTransition } from '../../domain/labour-state';
import {
    ADVANCE_SOURCE, LabourEffects, LabourViews, MODULE, PERIOD_SOURCE, advanceDto, periodNotFound, periodSummaryDto, seesWages, transact,
    virtualPeriodSummary,
} from '../labour.service';
import { LabourRepository, type PayPeriodRecord, type WageAdvanceRecord } from '../ports/labour.repository';

const keyNotFound = (): DomainError => DomainError.notFound('PayPeriod');
const advanceNotFound = (): DomainError => DomainError.notFound('WageAdvance');

/** Loads a period by id and authorizes on its workspace (another tenant's id → 404). */
async function periodById(
    access: ModuleAccess, repo: LabourRepository, userId: UserId, periodId: string,
): Promise<Result<{ grant: WorkspaceGrant; period: PayPeriodRecord }, DomainError>> {
    if (!isUuid(periodId)) return err(periodNotFound());
    const period = await repo.findPeriod(periodId.toLowerCase());
    if (period === undefined) return err(periodNotFound());
    const grant = await access.inWorkspace(userId, period.workspaceId, MODULE, 'labour.read');
    if (!grant.ok) return grant.error.code === 'not_found' ? err(periodNotFound()) : grant;
    return ok({ grant: grant.value, period });
}

/** GET /workspaces/:workspaceId/pay-periods?year= — `labour.read`: built periods, newest first, plus the current one. */
@Injectable()
export class ListPayPeriodsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: LabourRepository, private readonly clock: Clock) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: PayPeriodListQuery): Promise<Result<PayPeriodListDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, 'labour.read');
        if (!grant.ok) return grant;
        const list = await this.repo.listPeriods(workspaceId, { year: query.year });
        const counts = await this.repo.lineCounts(workspaceId, list.map(p => p.id));
        const items = list.map(p => periodSummaryDto(p, counts.get(p.id) ?? 0));
        const current = payPeriodOf(bangkokToday(this.clock.now()));
        if ((query.year === undefined || current.startsWith(`${query.year}-`)) && !items.some(p => p.periodKey === current)) {
            items.push(virtualPeriodSummary(current));
            items.sort((a, b) => (a.periodKey < b.periodKey ? 1 : a.periodKey > b.periodKey ? -1 : 0));
        }
        return ok({ items });
    }
}

/** GET /pay-periods/:periodId — `labour.read`. */
@Injectable()
export class GetPayPeriodUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: LabourRepository, private readonly views: LabourViews) {}

    async execute(userId: UserId, periodId: string): Promise<Result<PayPeriodDto, DomainError>> {
        const loaded = await periodById(this.access, this.repo, userId, periodId);
        if (!loaded.ok) return loaded;
        return ok(await this.views.periodDetail(loaded.value.period, loaded.value.grant.role));
    }
}

/** Authorizes `labour.pay` in the workspace and checks the key (`2026-10-A`); unknown key shape → 404. */
async function payAccess(
    access: ModuleAccess, userId: UserId, workspaceId: WorkspaceId, periodKey: string,
): Promise<Result<WorkspaceGrant, DomainError>> {
    const grant = await access.inWorkspace(userId, workspaceId, MODULE, 'labour.pay');
    if (!grant.ok) return grant;
    return isPayPeriodKey(periodKey) ? grant : err(keyNotFound());
}

/** POST /workspaces/:workspaceId/pay-periods/:periodKey/build — `labour.pay`: (re)builds an open period (created on first build). */
@Injectable()
export class BuildPayPeriodUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly effects: LabourEffects,
        private readonly views: LabourViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, periodKey: string): Promise<Result<PayPeriodDto, DomainError>> {
        const grant = await payAccess(this.access, userId, workspaceId, periodKey);
        if (!grant.ok) return grant;
        const done = await transact(this.uow, async (): Promise<Result<PayPeriodRecord, DomainError>> => {
            const now = this.clock.now();
            const period = await this.effects.ensurePeriod(workspaceId, periodKey, now);
            // Only an open period is rebuilt (pending_approval / approved / paid keep their lines).
            const open = requirePeriodTransition(period.status, 'pending_approval');
            if (!open.ok) return open;
            const built = await this.effects.build(period, userId, now);
            await this.audit.record({
                workspaceId, projectId: null, actor: userId, entityType: 'pay_period', entityId: built.id, action: 'build',
                data: { periodKey, gross: built.gross, advanceDeduction: built.advanceDeduction, net: built.net },
            });
            return ok(built);
        });
        if (!done.ok) return done;
        return ok(await this.views.periodDetail(done.value, grant.value.role));
    }
}

/**
 * POST /workspaces/:workspaceId/pay-periods/:periodKey/approve — `labour.pay`: rebuilds the open period, then asks
 * `pay_period.approve` (amount = net); skipped → approved at once, else pending_approval (timesheets locked from now).
 * 422 `no_lines` when nothing approved falls in the period.
 */
@Injectable()
export class ApprovePayPeriodUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: LabourRepository,
        private readonly effects: LabourEffects,
        private readonly views: LabourViews,
        private readonly approvals: Approvals,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, periodKey: string): Promise<Result<PayPeriodDto, DomainError>> {
        const grant = await payAccess(this.access, userId, workspaceId, periodKey);
        if (!grant.ok) return grant;
        const done = await transact(this.uow, async (): Promise<Result<{ period: PayPeriodRecord; pending: string | null }, DomainError>> => {
            const now = this.clock.now();
            const period = await this.effects.ensurePeriod(workspaceId, periodKey, now);
            const can = requirePeriodTransition(period.status, 'pending_approval');
            if (!can.ok) return can;
            const built = await this.effects.build(period, userId, now);
            if ((await this.repo.lineCounts(workspaceId, [built.id])).get(built.id) === undefined) {
                return err(DomainError.unprocessable('No approved timesheet falls in this pay period', { reason: 'no_lines' }));
            }
            const ticket = await this.approvals.request({
                workspaceId, subject: 'pay_period.approve', subjectId: built.id, projectId: null, amount: built.net, title: periodKey,
                requestedBy: userId, requesterRole: grant.value.role,
            });
            if (!ticket.ok) return ticket;
            const approved = ticket.value.status === 'approved';
            const next: PayPeriodRecord = {
                ...built, status: approved ? 'approved' : 'pending_approval', approvedBy: approved ? userId : null,
                approvedAt: approved ? now : null, updatedAt: now,
            };
            await this.repo.savePeriod(next);
            await this.audit.record({
                workspaceId, projectId: null, actor: userId, entityType: 'pay_period', entityId: built.id, action: approved ? 'approved' : 'submit',
                data: { status: [period.status, next.status], periodKey, net: built.net, approvalRequestId: ticket.value.requestId },
            });
            return ok({ period: next, pending: approved ? null : ticket.value.requestId });
        });
        if (!done.ok) return done;
        if (done.value.pending !== null) await this.approvals.notifyRequested(done.value.pending);
        return ok(await this.views.periodDetail(done.value.period, grant.value.role));
    }
}

/**
 * POST /workspaces/:workspaceId/pay-periods/:periodKey/pay — `labour.pay`: an approved period → paid. fin_events
 * `lb.wages_paid` per project (net cash split by the projects' share of the gross) and `lb.advance_recovered` per person
 * with a deduction. 409 `paid_via_payables` when a supplier bill of the period exists (payables pays it instead).
 */
@Injectable()
export class PayPayPeriodUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: LabourRepository,
        private readonly views: LabourViews,
        private readonly events: FinancialEvents,
        private readonly bills: PayPeriodBillChecks,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: {
        userId: UserId; workspaceId: WorkspaceId; periodKey: string; body: PayPayPeriodRequest;
    }): Promise<Result<PayPeriodDto, DomainError>> {
        const { userId, workspaceId: ws, periodKey, body } = input;
        const grant = await payAccess(this.access, userId, ws, periodKey);
        if (!grant.ok) return grant;
        const found = await this.repo.findPeriodByKey(ws, periodKey);
        if (found === undefined) return err(keyNotFound());

        const done = await transact(this.uow, async (): Promise<Result<PayPeriodRecord, DomainError>> => {
            const period = await this.repo.lockPeriod(ws, found.id);
            if (period === undefined) return err(keyNotFound());
            const can = requirePeriodTransition(period.status, 'paid');
            if (!can.ok) return can;
            if (await this.bills.hasBill(ws, period.id)) {
                return err(DomainError.conflict('This pay period is paid through payables', { reason: 'paid_via_payables' }));
            }
            const now = this.clock.now();
            const paidDate = body.paidDate ?? bangkokToday(now);
            const entries = await this.repo.entriesOfPeriod(ws, period.id);
            const lines = await this.repo.linesOf(ws, period.id);

            // Wages per project: the cost (gross) and the cash actually paid (period net spread by the gross).
            const byProject = new Map<ProjectId, number>();
            for (const e of entries) byProject.set(e.projectId, round2((byProject.get(e.projectId) ?? 0) + e.amount));
            const projects = [...byProject.keys()].sort();
            const cash = allocate(period.net, projects.map(p => byProject.get(p) ?? 0));
            const common = { eventDate: paidDate, counterpartyType: 'worker' as const, sourceType: PERIOD_SOURCE, sourceId: period.id, by: userId };
            for (const [i, projectId] of projects.entries()) {
                const posted = await this.events.post(ws, {
                    ...common, projectId, eventType: 'lb.wages_paid', direction: 'out', counterpartyName: '', net: byProject.get(projectId) ?? 0,
                    cash: cash[i] ?? 0, data: { periodKey, paymentMethod: body.paymentMethod },
                });
                if (!posted.ok) return posted;
            }
            for (const l of lines.filter(x => x.advanceDeduction > 0)) {
                const posted = await this.events.post(ws, {
                    ...common, projectId: null, eventType: 'lb.advance_recovered', direction: 'none', counterpartyId: l.personId,
                    counterpartyName: l.personName, net: l.advanceDeduction, cash: 0, data: { periodKey, payLineId: l.id },
                });
                if (!posted.ok) return posted;
            }

            await this.repo.markLinesPaid(ws, period.id);
            await this.repo.saveEntries(entries.map(e => ({ ...e, status: 'paid' as const, updatedAt: now })));
            const paid: PayPeriodRecord = {
                ...period, status: 'paid', paidDate, paidAt: now, paidBy: userId, paymentMethod: body.paymentMethod, updatedAt: now,
            };
            await this.repo.savePeriod(paid);
            await this.audit.record({
                workspaceId: ws, projectId: null, actor: userId, entityType: 'pay_period', entityId: period.id, action: 'pay',
                data: { status: [period.status, 'paid'], periodKey, net: period.net, paidDate, paymentMethod: body.paymentMethod },
            });
            return ok(paid);
        });
        if (!done.ok) return done;
        return ok(await this.views.periodDetail(done.value, grant.value.role));
    }
}

// ── wage advances ──

/** GET /workspaces/:workspaceId/wage-advances?personId=&status= — `labour.read` (amounts need `workforce.seeWages`). */
@Injectable()
export class ListWageAdvancesUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: LabourRepository, private readonly views: LabourViews) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: WageAdvanceListQuery): Promise<Result<WageAdvanceListDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, 'labour.read');
        if (!grant.ok) return grant;
        const wages = seesWages(grant.value.role);
        const list = await this.repo.listAdvances(workspaceId, { personId: query.personId?.toLowerCase(), status: query.status });
        const names = await this.views.names(workspaceId, list.map(a => a.personId));
        return ok({ items: list.map(a => advanceDto(a, names.get(a.personId) ?? '', wages)), wagesHidden: !wages });
    }
}

const WRITE_ADVANCES = ['labour.pay', 'workforce.seeWages'] as const;

/** fin_events `lb.advance_paid` (cash out to the person) of an advance being paid. */
function advancePaidEvent(a: WageAdvanceRecord, personName: string, by: UserId) {
    return {
        projectId: null, eventDate: a.advanceDate, eventType: 'lb.advance_paid' as const, direction: 'out' as const,
        counterpartyType: 'worker' as const, counterpartyId: a.personId, counterpartyName: personName, sourceType: ADVANCE_SOURCE,
        sourceId: a.id, net: a.amount, cash: a.amount, data: { paymentMethod: a.paymentMethod, reason: a.reason }, by,
    };
}

/** POST /workspaces/:workspaceId/wage-advances — `labour.pay` + `workforce.seeWages`; with `paymentMethod` it is paid at once. */
@Injectable()
export class CreateWageAdvanceUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: LabourRepository,
        private readonly people: PeopleDirectory,
        private readonly events: FinancialEvents,
        private readonly audit: AuditLog,
        private readonly ids: IdGenerator,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, body: CreateWageAdvanceRequest): Promise<Result<WageAdvanceDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, ...WRITE_ADVANCES);
        if (!grant.ok) return grant;
        const personId = body.personId.toLowerCase();
        const person = (await this.people.find(workspaceId, [personId], { wages: false })).get(personId);
        if (person === undefined) return err(DomainError.notFound('Person'));
        const now = this.clock.now();
        const paid = body.paymentMethod !== undefined;
        const row: WageAdvanceRecord = {
            id: this.ids.newId(), workspaceId, personId, advanceDate: body.advanceDate, amount: round2(body.amount), reason: body.reason ?? '',
            status: 'open', recoveredAmount: 0, paidAt: paid ? now : null, paidBy: paid ? userId : null, paymentMethod: body.paymentMethod ?? null,
            createdBy: userId, createdAt: now, updatedAt: now,
        };
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            await this.repo.insertAdvance(row);
            if (paid) {
                const posted = await this.events.post(workspaceId, advancePaidEvent(row, person.name, userId));
                if (!posted.ok) return posted;
            }
            await this.audit.record({
                workspaceId, projectId: null, actor: userId, entityType: 'wage_advance', entityId: row.id, action: 'create_advance',
                data: { personId, amount: row.amount, advanceDate: row.advanceDate, paid },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return ok(advanceDto(row, person.name, true));
    }
}

/**
 * PATCH /wage-advances/:advanceId — `labour.pay` + `workforce.seeWages`. Date / amount only while unpaid (409
 * `advance_paid`); `paymentMethod` pays it (`lb.advance_paid`; already paid → 409 `advance_paid`); `status: 'written_off'`
 * stops recovering it (written off already → 409 `invalid_transition`).
 */
@Injectable()
export class PatchWageAdvanceUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: LabourRepository,
        private readonly people: PeopleDirectory,
        private readonly events: FinancialEvents,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, advanceId: string, body: PatchWageAdvanceRequest): Promise<Result<WageAdvanceDto, DomainError>> {
        if (!isUuid(advanceId)) return err(advanceNotFound());
        const found = await this.repo.findAdvance(advanceId.toLowerCase());
        if (found === undefined) return err(advanceNotFound());
        const ws = found.workspaceId;
        const grant = await this.access.inWorkspace(userId, ws, MODULE, ...WRITE_ADVANCES);
        if (!grant.ok) return grant.error.code === 'not_found' ? err(advanceNotFound()) : grant;
        const name = (await this.people.find(ws, [found.personId], { wages: false })).get(found.personId)?.name ?? '';

        const done = await transact(this.uow, async (): Promise<Result<WageAdvanceRecord, DomainError>> => {
            const a = await this.repo.lockAdvance(ws, found.id);
            if (a === undefined) return err(advanceNotFound());
            if (a.status === 'written_off') {
                return err(DomainError.conflict('The advance is written off', { reason: 'invalid_transition', status: a.status }));
            }
            const advancePaid = (): DomainError => DomainError.conflict('The advance is already paid', { reason: 'advance_paid' });
            const now = this.clock.now();
            const changes: Record<string, [unknown, unknown]> = {};
            let next: WageAdvanceRecord = { ...a, updatedAt: now };
            if (body.advanceDate !== undefined && body.advanceDate !== a.advanceDate) {
                if (a.paidAt !== null) return err(advancePaid());
                next = { ...next, advanceDate: body.advanceDate };
                changes.advanceDate = [a.advanceDate, body.advanceDate];
            }
            if (body.amount !== undefined && round2(body.amount) !== a.amount) {
                if (a.paidAt !== null) return err(advancePaid());
                next = { ...next, amount: round2(body.amount) };
                changes.amount = [a.amount, next.amount];
            }
            if (body.reason !== undefined && body.reason !== a.reason) {
                next = { ...next, reason: body.reason };
                changes.reason = [a.reason, body.reason];
            }
            if (body.paymentMethod !== undefined) {
                if (a.paidAt !== null) return err(advancePaid());
                next = { ...next, paidAt: now, paidBy: userId, paymentMethod: body.paymentMethod };
                changes.paid = [false, true];
                const posted = await this.events.post(ws, advancePaidEvent(next, name, userId));
                if (!posted.ok) return posted;
            }
            if (body.status === 'written_off') {
                next = { ...next, status: 'written_off' };
                changes.status = [a.status, 'written_off'];
            }
            await this.repo.saveAdvance(next);
            const action = body.status === 'written_off' ? 'write_off' : body.paymentMethod !== undefined ? 'pay' : 'edit';
            await this.audit.record({ workspaceId: ws, projectId: null, actor: userId, entityType: 'wage_advance', entityId: a.id, action, data: changes });
            return ok(next);
        });
        if (!done.ok) return done;
        return ok(advanceDto(done.value, name, true));
    }
}
