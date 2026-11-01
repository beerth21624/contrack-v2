// ─── Cash plan source of labour (WP-47): wages still to pay, per project and pay period ───
// Recorded but unpaid timesheets (draft / approved) are paid on the day after their half-month period ends (the 16th
// and the 1st); the days still to come are forecast at the project's average labour cost per calendar day of the last
// 14 days. A period already billed through payables is left to payables (no double count).
import { Injectable } from '@nestjs/common';
import { addDays, payPeriodOf } from '@contrack/domain/dates/business-date';
import { payPeriodRange } from '@contrack/domain/labour/pay-period';
import { round2 } from '@contrack/domain/money';
import { type CashPlanItem, ModuleFlags, PayPeriodBillChecks } from '../../../shared/application/ports';
import type { ProjectId, WorkspaceId } from '../../../shared/domain/ids';
import { MODULE } from './labour.service';
import { LabourRepository } from './ports/labour.repository';

/** Days of history behind the forecast rate. */
const RATE_DAYS = 14;
/** How far back unpaid timesheets are looked for. */
const UNPAID_LOOKBACK_DAYS = 120;

/** Pay day of a period: the day after it ends (A → the 16th, B → the 1st of the next month). */
const payDateOf = (periodKey: string): string => addDays(payPeriodRange(periodKey).endDate, 1);

@Injectable()
export class LabourCashPlan {
    constructor(
        private readonly repo: LabourRepository,
        private readonly flags: ModuleFlags,
        private readonly billChecks: PayPeriodBillChecks,
    ) {}

    async plan(workspaceId: WorkspaceId, projectIds: readonly ProjectId[] | 'all', today: string, to: string): Promise<CashPlanItem[]> {
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return [];
        const wanted = projectIds === 'all' ? null : new Set<string>(projectIds);
        const mine = <T extends { projectId: ProjectId }>(rows: readonly T[]): T[] => rows.filter(r => wanted === null || wanted.has(r.projectId));
        // project|period → amount
        const sums = new Map<string, { projectId: ProjectId; periodKey: string; amount: number }>();
        const add = (projectId: ProjectId, periodKey: string, amount: number): void => {
            const key = `${projectId}|${periodKey}`;
            const row = sums.get(key) ?? { projectId, periodKey, amount: 0 };
            row.amount += amount;
            sums.set(key, row);
        };

        const unpaid = mine(await this.repo.entriesInRange(workspaceId, {
            from: addDays(today, -UNPAID_LOOKBACK_DAYS), to: today, statuses: ['draft', 'approved'],
        }));
        const billed = new Map<string, boolean>();
        for (const e of unpaid) {
            if (e.payPeriodId !== null) {
                let hasBill = billed.get(e.payPeriodId);
                if (hasBill === undefined) {
                    hasBill = await this.billChecks.hasBill(workspaceId, e.payPeriodId);
                    billed.set(e.payPeriodId, hasBill);
                }
                if (hasBill) continue;
            }
            add(e.projectId, payPeriodOf(e.workDate), e.amount);
        }

        const recent = mine(await this.repo.entriesInRange(workspaceId, { from: addDays(today, -RATE_DAYS), to: addDays(today, -1) }));
        const rate = new Map<ProjectId, number>();
        for (const e of recent) rate.set(e.projectId, (rate.get(e.projectId) ?? 0) + e.amount);
        for (const [projectId, total] of rate) {
            const perDay = total / RATE_DAYS;
            if (perDay <= 0) continue;
            for (let d = addDays(today, 1); payDateOf(payPeriodOf(d)) <= to; d = addDays(d, 1)) add(projectId, payPeriodOf(d), perDay);
        }

        const out: CashPlanItem[] = [];
        for (const { projectId, periodKey, amount } of sums.values()) {
            const date = payDateOf(periodKey);
            const rounded = round2(amount);
            if (date > to || rounded <= 0) continue;
            out.push({ projectId, date, direction: 'out', amount: rounded, source: 'labour', ref: periodKey });
        }
        return out;
    }
}
