// ─── PayPeriodPayments (shared/application/ports.ts, WP-49): pay periods as payables bills and pays them (markPaid WP-50) ───
import { Injectable } from '@nestjs/common';
import type { LabourPaymentMethod } from '@contrack/contract';
import { round2 } from '@contrack/domain/money';
import {
    AuditLog, Clock, FinancialEvents, type PayPeriodPaymentInfo, PayPeriodBillChecks, PayPeriodPayments,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../shared/domain/result';
import { requirePeriodTransition } from '../domain/labour-state';
import { markPeriodPaid } from './pay-period-paid';
import { LabourRepository, type PayPeriodRecord } from './ports/labour.repository';

@Injectable()
export class LabourPayPeriodPayments extends PayPeriodPayments {
    constructor(
        private readonly repo: LabourRepository,
        private readonly bills: PayPeriodBillChecks,
        private readonly events: FinancialEvents,
        private readonly audit: AuditLog,
        private readonly clock: Clock,
    ) {
        super();
    }

    private async info(p: PayPeriodRecord): Promise<PayPeriodPaymentInfo> {
        const byProject = new Map<ProjectId, number>();
        for (const e of await this.repo.entriesOfPeriod(p.workspaceId, p.id)) {
            byProject.set(e.projectId, round2((byProject.get(e.projectId) ?? 0) + e.amount));
        }
        return {
            id: p.id, periodKey: p.periodKey, status: p.status, startDate: p.startDate, endDate: p.endDate, gross: p.gross,
            advanceDeduction: p.advanceDeduction, net: p.net,
            byProject: [...byProject.keys()].sort().map(projectId => ({ projectId, gross: byProject.get(projectId) ?? 0 })),
        };
    }

    async approvedUnbilled(workspaceId: WorkspaceId): Promise<PayPeriodPaymentInfo[]> {
        const out: PayPeriodPaymentInfo[] = [];
        const periods = (await this.repo.listPeriods(workspaceId, { statuses: ['approved'] }))
            .sort((a, b) => (a.periodKey < b.periodKey ? -1 : a.periodKey > b.periodKey ? 1 : 0));
        for (const p of periods) {
            if (await this.bills.hasBill(workspaceId, p.id)) continue;
            out.push(await this.info(p));
        }
        return out;
    }

    async find(workspaceId: WorkspaceId, periodId: string): Promise<PayPeriodPaymentInfo | undefined> {
        if (!isUuid(periodId)) return undefined;
        const p = await this.repo.findPeriod(periodId.toLowerCase());
        return p?.workspaceId === workspaceId ? this.info(p) : undefined;
    }

    async markPaid(workspaceId: WorkspaceId, periodId: string, input: { paidAt: string; method: LabourPaymentMethod; by: UserId }): Promise<Result<void, DomainError>> {
        if (!isUuid(periodId)) return err(DomainError.notFound('PayPeriod'));
        const period = await this.repo.lockPeriod(workspaceId, periodId.toLowerCase());
        if (period === undefined) return err(DomainError.notFound('PayPeriod'));
        const can = requirePeriodTransition(period.status, 'paid');
        if (!can.ok) return can;
        const paid = await markPeriodPaid({ repo: this.repo, events: this.events, audit: this.audit }, period, {
            paidDate: input.paidAt, paymentMethod: input.method, by: input.by, now: this.clock.now(), data: { via: 'payables' },
        });
        return paid.ok ? okVoid() : paid;
    }
}
