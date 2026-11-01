// ─── PayPeriodPayments (shared/application/ports.ts, WP-49): pay periods as payables bills them (WP-50 adds markPaid) ───
import { Injectable } from '@nestjs/common';
import { round2 } from '@contrack/domain/money';
import { type PayPeriodPaymentInfo, PayPeriodBillChecks, PayPeriodPayments } from '../../../shared/application/ports';
import { type ProjectId, type WorkspaceId, isUuid } from '../../../shared/domain/ids';
import { LabourRepository, type PayPeriodRecord } from './ports/labour.repository';

@Injectable()
export class LabourPayPeriodPayments extends PayPeriodPayments {
    constructor(private readonly repo: LabourRepository, private readonly bills: PayPeriodBillChecks) {
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
}
