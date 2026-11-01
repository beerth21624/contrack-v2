// ─── Payment run use cases (docs/erp/04-implementation-plan.md WP-50, docs/erp/02-domain-model.md §10) ───
// Read `payables.read`; create / edit / send for approval / cancel `payables.manage`; pay `payables.pay`. Bills put in a
// run go approved → scheduled (back to approved when removed or the run is cancelled) and are paid in full.
import { Injectable } from '@nestjs/common';
import type {
    ApPaymentDto, CancelPaymentRunRequest, CreatePaymentRunRequest, PatchPaymentRunRequest, PaymentRunDto, PaymentRunListDto,
    PaymentRunListQuery, PayPaymentRunRequest, WhtCertificateDto,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { sumMoney } from '@contrack/domain/money';
import { type WorkspaceGrant, ModuleAccess } from '../../../../shared/application/module-access';
import { Approvals, AuditLog, Clock, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../../shared/domain/result';
import { requireRunDraft, requireRunTransition } from '../../domain/payables-state';
import { MANAGE, MODULE, READ, transact } from '../payables.service';
import {
    PAY, RUN_APPROVAL_SUBJECT, RUN_SOURCE, RunBills, RunPayment, RunViews, billCash, groupBills, paymentSummaryDto, runNotFound,
    runSummaryDto,
} from '../payment-runs.service';
import { type BillRecord, PayablesRepository, type PaymentRunRecord } from '../ports/payables.repository';

type RunPermission = typeof READ | typeof MANAGE | typeof PAY;

/** Loads a run by id and authorizes on its workspace (another tenant's id → 404). */
@Injectable()
export class RunAccess {
    constructor(private readonly access: ModuleAccess, private readonly repo: PayablesRepository) {}

    async run(userId: UserId, runId: string, permission: RunPermission): Promise<Result<{ grant: WorkspaceGrant; run: PaymentRunRecord }, DomainError>> {
        if (!isUuid(runId)) return err(runNotFound());
        const run = await this.repo.findRun(runId.toLowerCase());
        if (run === undefined) return err(runNotFound());
        const grant = await this.access.inWorkspace(userId, run.workspaceId, MODULE, permission);
        if (!grant.ok) return grant.error.code === 'not_found' ? err(runNotFound()) : grant;
        return ok({ grant: grant.value, run });
    }
}

/** Totals of a run from its bills. */
function withTotals(run: PaymentRunRecord, bills: readonly BillRecord[]): PaymentRunRecord {
    return { ...run, billIds: bills.map(b => b.id), totalCash: sumMoney(bills.map(billCash)), totalWht: sumMoney(bills.map(b => b.whtAmount)) };
}

async function freshDetail(repo: PayablesRepository, views: RunViews, grant: WorkspaceGrant, id: string): Promise<Result<PaymentRunDto, DomainError>> {
    const r = await repo.findRun(id);
    return r === undefined ? err(runNotFound()) : ok(await views.detail(r, grant.role));
}

// ── reads ──

/** GET /workspaces/:workspaceId/payment-runs?status= — `payables.read`, newest first. */
@Injectable()
export class ListPaymentRunsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: PayablesRepository) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: PaymentRunListQuery): Promise<Result<PaymentRunListDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, READ);
        if (!grant.ok) return grant;
        return ok({ items: (await this.repo.listRuns(workspaceId, query.status)).map(runSummaryDto) });
    }
}

/** GET /payment-runs/:runId — `payables.read`. */
@Injectable()
export class GetPaymentRunUseCase {
    constructor(private readonly access: RunAccess, private readonly views: RunViews) {}

    async execute(userId: UserId, runId: string): Promise<Result<PaymentRunDto, DomainError>> {
        const loaded = await this.access.run(userId, runId, READ);
        if (!loaded.ok) return loaded;
        return ok(await this.views.detail(loaded.value.run, loaded.value.grant.role));
    }
}

/** GET /payments/:paymentId — `payables.read`: a payment voucher with what it settled. */
@Injectable()
export class GetPaymentUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: PayablesRepository) {}

    async execute(userId: UserId, paymentId: string): Promise<Result<ApPaymentDto, DomainError>> {
        const notFound = (): DomainError => DomainError.notFound('Payment');
        if (!isUuid(paymentId)) return err(notFound());
        const p = await this.repo.findPayment(paymentId.toLowerCase());
        if (p === undefined) return err(notFound());
        const grant = await this.access.inWorkspace(userId, p.workspaceId, MODULE, READ);
        if (!grant.ok) return grant.error.code === 'not_found' ? err(notFound()) : grant;
        const ws = p.workspaceId;
        const allocations = await this.repo.allocationsOf(ws, p.id);
        const bills = new Map((await this.repo.findMany(ws, allocations.map(a => a.billId))).map(b => [b.id, b]));
        const cert = p.whtCertificateId === null ? undefined : (await this.repo.certificatesOf(ws, [p.whtCertificateId]))[0];
        return ok({
            ...paymentSummaryDto(p, cert?.number ?? null),
            allocations: allocations.map(a => ({
                billId: a.billId, billNumber: bills.get(a.billId)?.number ?? null, supplierInvoiceNo: bills.get(a.billId)?.supplierInvoiceNo ?? '',
                settled: a.settled, wht: a.wht, cash: a.cash,
            })),
            fileIds: [...p.fileIds],
            createdBy: p.createdBy,
        });
    }
}

/** GET /wht-certificates/:certificateId — `payables.read`: the 50 ทวิ as issued (snapshots). */
@Injectable()
export class GetWhtCertificateUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: PayablesRepository) {}

    async execute(userId: UserId, certificateId: string): Promise<Result<WhtCertificateDto, DomainError>> {
        const notFound = (): DomainError => DomainError.notFound('WhtCertificate');
        if (!isUuid(certificateId)) return err(notFound());
        const c = await this.repo.findCertificate(certificateId.toLowerCase());
        if (c === undefined) return err(notFound());
        const grant = await this.access.inWorkspace(userId, c.workspaceId, MODULE, READ);
        if (!grant.ok) return grant.error.code === 'not_found' ? err(notFound()) : grant;
        const payment = await this.repo.findPayment(c.paymentId);
        return ok({
            id: c.id, workspaceId: c.workspaceId, number: c.number, bookNo: c.bookNo, paymentId: c.paymentId, paymentNumber: payment?.number ?? '',
            payee: { ...c.payeeSnapshot }, payer: { ...c.payerSnapshot }, form: c.form, incomeType: c.incomeType, incomeDesc: c.incomeDesc,
            payDate: c.payDate, baseAmount: c.baseAmount, whtRate: c.whtRate, whtAmount: c.whtAmount, condition: c.condition, status: c.status,
            issuedAt: c.issuedAt.toISOString(),
        });
    }
}

// ── writes ──

/** POST /workspaces/:workspaceId/payment-runs — `payables.manage`: approved bills → scheduled, a draft run. */
@Injectable()
export class CreatePaymentRunUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: PayablesRepository,
        private readonly runBills: RunBills,
        private readonly views: RunViews,
        private readonly audit: AuditLog,
        private readonly ids: IdGenerator,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, body: CreatePaymentRunRequest): Promise<Result<PaymentRunDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, MANAGE);
        if (!grant.ok) return grant;
        const now = this.clock.now();
        const id = this.ids.newId();
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            await this.repo.lockWorkspace(workspaceId);
            const bills = await this.runBills.load(workspaceId, body.billIds, []);
            if (!bills.ok) return bills;
            const scheduled = await this.runBills.schedule(bills.value);
            if (!scheduled.ok) return scheduled;
            const run = withTotals({
                id, workspaceId, number: null, status: 'draft', billIds: [], payDate: body.payDate ?? bangkokToday(now), method: body.method,
                note: body.note ?? '', totalCash: 0, totalWht: 0, approvedBy: null, approvedAt: null, paidAt: null, paidBy: null, cancelledAt: null,
                createdBy: userId, createdAt: now, updatedAt: now,
            }, bills.value);
            await this.repo.insertRun(run);
            await this.audit.record({
                workspaceId, projectId: null, actor: userId, entityType: RUN_SOURCE, entityId: id, action: 'create',
                data: { bills: run.billIds.length, totalCash: run.totalCash, totalWht: run.totalWht, payDate: run.payDate },
            });
            return okVoid();
        });
        if (!done.ok) return done;
        return freshDetail(this.repo, this.views, grant.value, id);
    }
}

/** PATCH /payment-runs/:runId — `payables.manage`, draft only; `billIds` replaces the bills. */
@Injectable()
export class PatchPaymentRunUseCase {
    constructor(
        private readonly access: RunAccess,
        private readonly repo: PayablesRepository,
        private readonly runBills: RunBills,
        private readonly views: RunViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, runId: string, body: PatchPaymentRunRequest): Promise<Result<PaymentRunDto, DomainError>> {
        const loaded = await this.access.run(userId, runId, MANAGE);
        if (!loaded.ok) return loaded;
        const { grant, run: found } = loaded.value;
        const ws = found.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            await this.repo.lockWorkspace(ws);
            const run = await this.repo.lockRun(ws, found.id);
            if (run === undefined) return err(runNotFound());
            const draft = requireRunDraft(run.status);
            if (!draft.ok) return draft;
            let next: PaymentRunRecord = { ...run, updatedAt: this.clock.now() };
            if (body.payDate !== undefined) next.payDate = body.payDate;
            if (body.method !== undefined) next.method = body.method;
            if (body.note !== undefined) next.note = body.note;
            if (body.billIds !== undefined) {
                const bills = await this.runBills.load(ws, body.billIds, run.billIds);
                if (!bills.ok) return bills;
                const keep = new Set(bills.value.map(b => b.id));
                await this.runBills.release(ws, run.billIds.filter(id => !keep.has(id)));
                const scheduled = await this.runBills.schedule(bills.value);
                if (!scheduled.ok) return scheduled;
                next = withTotals(next, bills.value);
            }
            await this.repo.saveRun(next);
            await this.audit.record({
                workspaceId: ws, projectId: null, actor: userId, entityType: RUN_SOURCE, entityId: run.id, action: 'update',
                data: { bills: [run.billIds.length, next.billIds.length], totalCash: [run.totalCash, next.totalCash], payDate: next.payDate },
            });
            return okVoid();
        });
        if (!done.ok) return done;
        return freshDetail(this.repo, this.views, grant, found.id);
    }
}

/** POST /payment-runs/:runId/approve — `payables.manage`: asks `payment_run.approve` (skipped → approved at once). */
@Injectable()
export class ApprovePaymentRunUseCase {
    constructor(
        private readonly access: RunAccess,
        private readonly repo: PayablesRepository,
        private readonly runBills: RunBills,
        private readonly views: RunViews,
        private readonly approvals: Approvals,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, runId: string): Promise<Result<PaymentRunDto, DomainError>> {
        const loaded = await this.access.run(userId, runId, MANAGE);
        if (!loaded.ok) return loaded;
        const { grant, run: found } = loaded.value;
        const ws = found.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<string | null, DomainError>> => {
            await this.repo.lockWorkspace(ws);
            const run = await this.repo.lockRun(ws, found.id);
            if (run === undefined) return err(runNotFound());
            const draft = requireRunDraft(run.status);
            if (!draft.ok) return draft;
            // The bills must still be scheduled in this run (and have something to pay).
            const bills = await this.runBills.load(ws, run.billIds, run.billIds);
            if (!bills.ok) return bills;
            const now = this.clock.now();
            const current = withTotals(run, bills.value);
            const payees = groupBills(bills.value).length;
            const ticket = await this.approvals.request({
                workspaceId: ws, subject: RUN_APPROVAL_SUBJECT, subjectId: run.id, projectId: null, amount: current.totalCash,
                title: `${current.payDate} · ${current.billIds.length} / ${payees}`, requestedBy: userId, requesterRole: grant.role,
            });
            if (!ticket.ok) return ticket;
            const approved = ticket.value.status === 'approved';
            const next: PaymentRunRecord = approved
                ? { ...current, status: 'approved', approvedBy: userId, approvedAt: now, updatedAt: now }
                : { ...current, status: 'pending_approval', updatedAt: now };
            await this.repo.saveRun(next);
            await this.audit.record({
                workspaceId: ws, projectId: null, actor: userId, entityType: RUN_SOURCE, entityId: run.id, action: approved ? 'approved' : 'submit',
                data: { status: [run.status, next.status], totalCash: next.totalCash, approvalRequestId: ticket.value.requestId },
            });
            return ok(approved ? null : ticket.value.requestId);
        });
        if (!done.ok) return done;
        if (done.value !== null) await this.approvals.notifyRequested(done.value);
        return freshDetail(this.repo, this.views, grant, found.id);
    }
}

/** POST /payment-runs/:runId/pay — `payables.pay`, approved only (a second pay → 409 `invalid_transition`). */
@Injectable()
export class PayPaymentRunUseCase {
    constructor(
        private readonly access: RunAccess,
        private readonly repo: PayablesRepository,
        private readonly payment: RunPayment,
        private readonly views: RunViews,
        private readonly uow: UnitOfWork,
    ) {}

    async execute(userId: UserId, runId: string, body: PayPaymentRunRequest): Promise<Result<PaymentRunDto, DomainError>> {
        const loaded = await this.access.run(userId, runId, PAY);
        if (!loaded.ok) return loaded;
        const { grant, run: found } = loaded.value;
        const ws = found.workspaceId;
        const done = await transact(this.uow, async () => {
            await this.repo.lockWorkspace(ws);
            const run = await this.repo.lockRun(ws, found.id);
            if (run === undefined) return err(runNotFound());
            const can = requireRunTransition(run.status, 'paid');
            if (!can.ok) return can;
            return this.payment.pay(run, { payDate: body.payDate ?? run.payDate, bankRef: body.bankRef ?? '', by: userId });
        });
        if (!done.ok) return done;
        for (const after of done.value.afterCommit) await after();
        return freshDetail(this.repo, this.views, grant, found.id);
    }
}

/** POST /payment-runs/:runId/cancel — `payables.manage`: draft / pending (request withdrawn) / approved; bills → approved. */
@Injectable()
export class CancelPaymentRunUseCase {
    constructor(
        private readonly access: RunAccess,
        private readonly repo: PayablesRepository,
        private readonly runBills: RunBills,
        private readonly views: RunViews,
        private readonly approvals: Approvals,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, runId: string, body: CancelPaymentRunRequest): Promise<Result<PaymentRunDto, DomainError>> {
        const loaded = await this.access.run(userId, runId, MANAGE);
        if (!loaded.ok) return loaded;
        const { grant, run: found } = loaded.value;
        const ws = found.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            await this.repo.lockWorkspace(ws);
            const run = await this.repo.lockRun(ws, found.id);
            if (run === undefined) return err(runNotFound());
            const can = requireRunTransition(run.status, 'cancelled');
            if (!can.ok) return can;
            if (run.status === 'pending_approval') await this.approvals.cancel(ws, RUN_APPROVAL_SUBJECT, run.id, userId);
            await this.runBills.release(ws, run.billIds);
            const now = this.clock.now();
            await this.repo.saveRun({ ...run, status: 'cancelled', cancelledAt: now, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: null, actor: userId, entityType: RUN_SOURCE, entityId: run.id, action: 'cancel',
                data: { status: [run.status, 'cancelled'], reason: body.reason ?? '' },
            });
            return okVoid();
        });
        if (!done.ok) return done;
        return freshDetail(this.repo, this.views, grant, found.id);
    }
}
