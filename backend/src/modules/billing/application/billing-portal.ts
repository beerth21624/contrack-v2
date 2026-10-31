// ─── Portal task sources of billing (WP-35): overdue invoices (`billing.receive`), claimable milestones (`billing.manage`) ───
import { Injectable } from '@nestjs/common';
import { invoiceOutstanding } from '@contrack/domain/billing';
import { daysBetween } from '@contrack/domain/dates/business-date';
import { CostCodeLookup, MainContracts, ModuleFlags, type PortalContext, type PortalTaskItem } from '../../../shared/application/ports';
import { BILLABLE_CONTRACT, effectiveMilestoneStatus, weightedProgress } from '../domain/billing-rules';
import { MODULE, OPEN_RECEIVABLE } from './billing.service';
import { BillingRepository } from './ports/billing.repository';

@Injectable()
export class BillingPortal {
    constructor(
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly costCodes: CostCodeLookup,
        private readonly flags: ModuleFlags,
    ) {}

    /** Open invoices past their due date, of the workspace's live projects. */
    async overdueInvoices(ctx: PortalContext): Promise<PortalTaskItem[]> {
        if (!(await this.flags.isEnabled(ctx.workspaceId, MODULE))) return [];
        const out: PortalTaskItem[] = [];
        for (const i of await this.repo.openInvoices(ctx.workspaceId)) {
            if (!OPEN_RECEIVABLE(i) || i.dueDate >= ctx.today || i.projectId === null || !ctx.projects.has(i.projectId)) continue;
            const amount = invoiceOutstanding(i, i.paidAmount);
            if (amount <= 0) continue;
            out.push({
                kind: 'invoice_overdue',
                params: { number: i.number ?? '', customer: i.customerSnapshot?.name ?? '', daysOverdue: daysBetween(i.dueDate, ctx.today) },
                href: `/p/${i.projectId}/billing`,
                dueDate: i.dueDate,
                amount,
                projectId: i.projectId,
            });
        }
        return out;
    }

    /** Milestones of signed / completed contracts whose trigger is met and that have no claim yet. */
    async claimableMilestones(ctx: PortalContext): Promise<PortalTaskItem[]> {
        if (!(await this.flags.isEnabled(ctx.workspaceId, MODULE))) return [];
        const out: PortalTaskItem[] = [];
        for (const projectId of ctx.projects.keys()) {
            const contract = await this.contracts.forProject(ctx.workspaceId, projectId);
            if (contract === undefined || !BILLABLE_CONTRACT.includes(contract.status)) continue;
            const needsProgress = contract.milestones.some(m => m.status === 'planned' && m.trigger === 'progress');
            const progress = needsProgress ? weightedProgress(await this.costCodes.listByProject(ctx.workspaceId, projectId)) : null;
            for (const m of contract.milestones) {
                if (effectiveMilestoneStatus(m, { contractStatus: contract.status, today: ctx.today, progress }) !== 'claimable') continue;
                out.push({
                    kind: 'milestone_claimable',
                    params: { contract: contract.number ?? contract.title, no: m.no, labelTh: m.labelTh, labelEn: m.labelEn },
                    href: `/p/${projectId}/billing`,
                    dueDate: m.dueDate,
                    amount: m.amount,
                    projectId,
                });
            }
        }
        return out;
    }
}
