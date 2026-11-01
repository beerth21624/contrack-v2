// ─── Payables as other modules call it: approval outcomes, portal tasks, the due-soon sweep, the cash plan, pay period checks ───
import { Injectable, Logger } from '@nestjs/common';
import { SUPPLIER_BILL_DUE_SOON_DAYS, SUPPLIER_BILL_OPEN_STATUSES, SUPPLIER_BILL_PORTAL_DAYS } from '@contrack/contract';
import { addDays } from '@contrack/domain/dates/business-date';
import { allocate, round2 } from '@contrack/domain/money';
import {
    type ApprovalDecidedEvent, AuditLog, type CashPlanItem, Clock, ModuleFlags, Notifier, PayPeriodPayments, type PortalContext,
    type PortalTaskItem, type SweepContext, SweepMarks, SupplierLookup, UnitOfWork, WorkspaceDirectory,
} from '../../../shared/application/ports';
import type { DomainError } from '../../../shared/domain/domain-error';
import type { ProjectId, WorkspaceId } from '../../../shared/domain/ids';
import { can } from '../../../shared/domain/permissions';
import { type Result, okVoid } from '../../../shared/domain/result';
import { BILL_SOURCE, BillPosting, MODULE, supplierDisplayName, transact } from './payables.service';
import { RUN_SOURCE } from './payment-runs.service';
import { type BillRecord, PayablesRepository } from './ports/payables.repository';

export const DUE_SOON_SWEEP = 'payables.due';

export const billHref = (billId: string): string => `/payables/bills/${billId}`;

const outstanding = (b: BillRecord): number => round2(b.payable - b.paidAmount);

@Injectable()
export class PayablesHandlers {
    private readonly logger = new Logger(PayablesHandlers.name);

    constructor(
        private readonly repo: PayablesRepository,
        private readonly posting: BillPosting,
        private readonly suppliers: SupplierLookup,
        private readonly periods: PayPeriodPayments,
        private readonly flags: ModuleFlags,
        private readonly audit: AuditLog,
        private readonly directory: WorkspaceDirectory,
        private readonly notifier: Notifier,
        private readonly marks: SweepMarks,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    /** `supplier_bill.approve`: approved → posted (number, fin_events, cost); rejected → back to draft. */
    async onBillDecided(e: ApprovalDecidedEvent): Promise<Result<void, DomainError>> {
        if (!(await this.flags.isEnabled(e.workspaceId, MODULE))) return okVoid();
        return transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            await this.repo.lockWorkspace(e.workspaceId);
            const b = await this.repo.lock(e.workspaceId, e.subjectId.toLowerCase());
            // Voided meanwhile: nothing to apply.
            if (b?.status !== 'pending_approval') return okVoid();
            if (e.decision === 'approved') {
                const posted = await this.posting.post(b, e.decidedBy);
                return posted.ok ? okVoid() : posted;
            }
            await this.repo.save({ ...b, status: 'draft', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: e.workspaceId, projectId: b.projectId, actor: e.decidedBy, entityType: BILL_SOURCE, entityId: b.id,
                action: 'approval_rejected', data: { status: ['pending_approval', 'draft'], note: e.note },
            });
            return okVoid();
        });
    }

    /** `payment_run.approve`: approved → the run may be paid; rejected → back to draft (bills stay scheduled). */
    async onRunDecided(e: ApprovalDecidedEvent): Promise<Result<void, DomainError>> {
        if (!(await this.flags.isEnabled(e.workspaceId, MODULE))) return okVoid();
        return transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.repo.lockRun(e.workspaceId, e.subjectId.toLowerCase());
            // Cancelled meanwhile: nothing to apply.
            if (r?.status !== 'pending_approval') return okVoid();
            const now = this.clock.now();
            const approved = e.decision === 'approved';
            await this.repo.saveRun(approved
                ? { ...r, status: 'approved', approvedBy: e.decidedBy, approvedAt: now, updatedAt: now }
                : { ...r, status: 'draft', updatedAt: now });
            await this.audit.record({
                workspaceId: e.workspaceId, projectId: null, actor: e.decidedBy, entityType: RUN_SOURCE, entityId: r.id,
                action: approved ? 'approved' : 'approval_rejected', data: { status: ['pending_approval', approved ? 'approved' : 'draft'], note: e.note },
            });
            return okVoid();
        });
    }

    /** PayPeriodBillChecks: the period has a bill that is not voided. */
    async hasPayPeriodBill(workspaceId: WorkspaceId, periodId: string): Promise<boolean> {
        return (await this.repo.findByPayPeriod(workspaceId, periodId.toLowerCase())) !== undefined;
    }

    /** Posted bills not paid, due within 7 days (overdue too), of live projects or of the company. */
    async portalDue(ctx: PortalContext): Promise<PortalTaskItem[]> {
        if (!(await this.flags.isEnabled(ctx.workspaceId, MODULE))) return [];
        const bills = (await this.repo.list(ctx.workspaceId, {
            statuses: SUPPLIER_BILL_OPEN_STATUSES, dueTo: addDays(ctx.today, SUPPLIER_BILL_PORTAL_DAYS),
        })).filter(b => (b.projectId === null || ctx.projects.has(b.projectId)) && outstanding(b) > 0);
        const names = await this.names(ctx.workspaceId, bills);
        return bills.map(b => ({
            kind: 'supplier_bill_due' as const,
            params: { number: b.number ?? '', supplierName: b.supplierId === null ? '' : names.get(b.supplierId) ?? '', kind: b.kind },
            href: billHref(b.id),
            dueDate: b.dueDate,
            amount: outstanding(b),
            projectId: b.projectId,
        }));
    }

    /**
     * `supplier_bill.due_soon` 3 days before the due date, once per bill, to the members with `payables.pay` of every
     * workspace with payables active.
     */
    async dueSoon(ctx: SweepContext): Promise<void> {
        if (!this.flags.platformEnabled(MODULE)) return;
        const due = addDays(ctx.today, SUPPLIER_BILL_DUE_SOON_DAYS);
        const byWorkspace = new Map<WorkspaceId, BillRecord[]>();
        for (const b of await this.repo.dueOn(due, SUPPLIER_BILL_OPEN_STATUSES, 5000)) {
            if (outstanding(b) > 0) byWorkspace.set(b.workspaceId, [...(byWorkspace.get(b.workspaceId) ?? []), b]);
        }
        for (const [ws, bills] of byWorkspace) {
            try {
                if (!(await this.flags.isEnabled(ws, MODULE))) continue;
                const toUserIds = (await this.directory.members(ws)).filter(m => can(m.role, 'payables.pay')).map(m => m.userId);
                if (toUserIds.length === 0) continue;
                const names = await this.names(ws, bills);
                for (const b of bills) {
                    if (!(await this.marks.markOnce(DUE_SOON_SWEEP, b.id, ctx.today))) continue;
                    await this.notifier.notify({
                        template: 'supplier_bill.due_soon', toUserIds,
                        payload: {
                            docNumber: b.number ?? '', supplierName: b.supplierId === null ? '' : names.get(b.supplierId) ?? '',
                            amount: outstanding(b), date: b.dueDate, href: billHref(b.id),
                        },
                    });
                }
            } catch (e) {
                this.logger.error(`${DUE_SOON_SWEEP} ${ws}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }

    /**
     * Cash plan source `supplier_bill`: bills not paid at their due date (outstanding = payable − paid). Left out:
     * subcontract bills (the subcontracting source counts the claim until it is paid), drafts of a PO bill (the PO source
     * counts the PO until it is billed) and company bills without a project. A labour bill is spread over the projects
     * by their share of the period's wages.
     */
    async cashPlan(workspaceId: WorkspaceId, projectIds: readonly ProjectId[] | 'all', _from: string, to: string): Promise<CashPlanItem[]> {
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return [];
        const wanted = projectIds === 'all' ? null : new Set<string>(projectIds);
        const bills = await this.repo.list(workspaceId, { statuses: ['draft', 'pending_approval', 'approved', 'scheduled'], dueTo: to });
        const out: CashPlanItem[] = [];
        const push = (projectId: ProjectId, b: BillRecord, amount: number): void => {
            const rounded = round2(amount);
            if (rounded <= 0 || (wanted !== null && !wanted.has(projectId))) return;
            out.push({ projectId, date: b.dueDate, direction: 'out', amount: rounded, source: 'supplier_bill', ref: b.number ?? b.supplierInvoiceNo });
        };
        for (const b of bills) {
            if (b.kind === 'subcontract') continue;
            const posted = b.status === 'approved' || b.status === 'scheduled';
            if (!posted && b.orderId !== null) continue;
            const amount = outstanding(b);
            if (amount <= 0) continue;
            if (b.kind === 'labour' && b.payPeriodId !== null) {
                const period = await this.periods.find(workspaceId, b.payPeriodId);
                const shares = period?.byProject ?? [];
                const parts = allocate(amount, shares.map(s => s.gross));
                for (const [i, s] of shares.entries()) push(s.projectId, b, parts[i] ?? 0);
                continue;
            }
            if (b.projectId !== null) push(b.projectId, b, amount);
        }
        return out;
    }

    private async names(workspaceId: WorkspaceId, bills: readonly BillRecord[]): Promise<Map<string, string>> {
        const ids = [...new Set(bills.flatMap(b => (b.supplierId === null ? [] : [b.supplierId])))];
        if (ids.length === 0) return new Map();
        return new Map((await this.suppliers.findMany(workspaceId, ids)).map(s => [s.id, supplierDisplayName(s)]));
    }
}
