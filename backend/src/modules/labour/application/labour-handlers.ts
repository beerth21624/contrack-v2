// ─── Labour as other modules call it: approval outcomes, portal tasks, the pay-period-ready sweep ───
import { Injectable, Logger } from '@nestjs/common';
import { addDays, payPeriodOf } from '@contrack/domain/dates/business-date';
import { payPeriodRange } from '@contrack/domain/labour/pay-period';
import { sumMoney } from '@contrack/domain/money';
import {
    type ApprovalDecidedEvent, AuditLog, Clock, ModuleFlags, Notifier, type PortalContext, type PortalTaskItem, type SweepContext, SweepMarks,
    UnitOfWork, WorkspaceDirectory,
} from '../../../shared/application/ports';
import type { DomainError } from '../../../shared/domain/domain-error';
import { can } from '../../../shared/domain/permissions';
import { type Result, okVoid } from '../../../shared/domain/result';
import { LabourEffects, MODULE, transact } from './labour.service';
import { LabourRepository } from './ports/labour.repository';

export const PAY_PERIOD_READY_SWEEP = 'labour.pay-period-ready';

export const payPeriodHref = (periodKey: string): string => `/labour/pay-periods/${periodKey}`;

@Injectable()
export class LabourHandlers {
    private readonly logger = new Logger(LabourHandlers.name);

    constructor(
        private readonly repo: LabourRepository,
        private readonly effects: LabourEffects,
        private readonly flags: ModuleFlags,
        private readonly audit: AuditLog,
        private readonly directory: WorkspaceDirectory,
        private readonly notifier: Notifier,
        private readonly marks: SweepMarks,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    /** `timesheet.approve`: approved → the batch's drafts approved + labour cost posted; rejected → the drafts editable again. */
    async onTimesheetsDecided(e: ApprovalDecidedEvent): Promise<Result<void, DomainError>> {
        if (!(await this.flags.isEnabled(e.workspaceId, MODULE))) return okVoid();
        return transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const drafts = (await this.repo.entriesByBatch(e.workspaceId, e.subjectId.toLowerCase())).filter(x => x.status === 'draft');
            if (drafts.length === 0) return okVoid();
            const now = this.clock.now();
            if (e.decision === 'approved') {
                const applied = await this.effects.approveEntries(e.workspaceId, drafts, e.decidedBy, now);
                if (!applied.ok) return applied;
            } else {
                await this.repo.saveEntries(drafts.map(x => ({ ...x, approvalBatchId: null, updatedAt: now })));
            }
            await this.audit.record({
                workspaceId: e.workspaceId, projectId: e.projectId, actor: e.decidedBy, entityType: 'timesheet', entityId: e.subjectId.toLowerCase(),
                action: e.decision === 'approved' ? 'approved' : 'approval_rejected',
                data: { entries: drafts.length, amount: sumMoney(drafts.map(x => x.amount)), note: e.note },
            });
            return okVoid();
        });
    }

    /** `pay_period.approve`: pending_approval → approved, or back to open when rejected. */
    async onPayPeriodDecided(e: ApprovalDecidedEvent): Promise<Result<void, DomainError>> {
        if (!(await this.flags.isEnabled(e.workspaceId, MODULE))) return okVoid();
        return transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const p = await this.repo.lockPeriod(e.workspaceId, e.subjectId.toLowerCase());
            if (p?.status !== 'pending_approval') return okVoid();
            const now = this.clock.now();
            const approved = e.decision === 'approved';
            const status = approved ? 'approved' : 'open';
            await this.repo.savePeriod({ ...p, status, approvedBy: approved ? e.decidedBy : null, approvedAt: approved ? now : null, updatedAt: now });
            await this.audit.record({
                workspaceId: e.workspaceId, projectId: null, actor: e.decidedBy, entityType: 'pay_period', entityId: p.id,
                action: approved ? 'approved' : 'approval_rejected', data: { status: ['pending_approval', status], note: e.note },
            });
            return okVoid();
        });
    }

    /** Approved pay periods waiting to be paid (workspace-wide, no project). */
    async portalReadyToPay(ctx: PortalContext): Promise<PortalTaskItem[]> {
        if (!(await this.flags.isEnabled(ctx.workspaceId, MODULE))) return [];
        return (await this.repo.listPeriods(ctx.workspaceId, { statuses: ['approved'] })).map(p => ({
            kind: 'pay_period_ready' as const,
            params: { periodKey: p.periodKey },
            href: payPeriodHref(p.periodKey),
            dueDate: p.endDate,
            amount: p.net,
            projectId: null,
        }));
    }

    /**
     * On the 15th and on the last day of a month: `pay_period.ready` (once per workspace and period) to the members with
     * `labour.pay` of every workspace with labour active and timesheets in the period that is not paid yet. Amount =
     * the built net, else Σ approved timesheet amounts.
     */
    async payPeriodReady(ctx: SweepContext): Promise<void> {
        if (!this.flags.platformEnabled(MODULE)) return;
        const day = Number(ctx.today.slice(8));
        const lastDay = addDays(ctx.today, 1).slice(8) === '01';
        if (day !== 15 && !lastDay) return;
        const periodKey = payPeriodOf(ctx.today);
        const { startDate, endDate } = payPeriodRange(periodKey);
        for (const ws of await this.repo.workspacesWithEntries(startDate, endDate, 5000)) {
            try {
                if (!(await this.flags.isEnabled(ws, MODULE))) continue;
                const period = await this.repo.findPeriodByKey(ws, periodKey);
                if (period?.status === 'paid') continue;
                const toUserIds = (await this.directory.members(ws)).filter(m => can(m.role, 'labour.pay')).map(m => m.userId);
                if (toUserIds.length === 0) continue;
                if (!(await this.marks.markOnce(PAY_PERIOD_READY_SWEEP, `${ws}:${periodKey}`, ctx.today))) continue;
                const amount = period?.builtAt != null
                    ? period.net
                    : sumMoney((await this.repo.entriesInRange(ws, { from: startDate, to: endDate, statuses: ['approved'] })).map(x => x.amount));
                await this.notifier.notify({
                    template: 'pay_period.ready', toUserIds, payload: { title: periodKey, amount, date: endDate, href: payPeriodHref(periodKey) },
                });
            } catch (e) {
                this.logger.error(`${PAY_PERIOD_READY_SWEEP} ${ws}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
}
