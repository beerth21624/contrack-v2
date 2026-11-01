// ─── Cash plan source of billing (WP-47): open invoices (cash still to receive) and unbilled milestones with a due date ───
import { Injectable } from '@nestjs/common';
import { invoiceDue, invoiceOutstanding } from '@contrack/domain/billing';
import { round2 } from '@contrack/domain/money';
import type { ContractMilestoneStatus } from '@contrack/contract';
import { type CashPlanItem, MainContracts, ModuleFlags, ProjectCatalog } from '../../../shared/application/ports';
import { type ProjectId, type WorkspaceId, asProjectId } from '../../../shared/domain/ids';
import { BILLABLE_CONTRACT } from '../domain/billing-rules';
import { MODULE, OPEN_RECEIVABLE } from './billing.service';
import { BillingRepository } from './ports/billing.repository';

/** Milestones without an issued invoice yet. */
const UNBILLED: readonly ContractMilestoneStatus[] = ['planned', 'claimable', 'claimed'];

@Injectable()
export class BillingCashPlan {
    constructor(
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly catalog: ProjectCatalog,
        private readonly flags: ModuleFlags,
    ) {}

    async plan(workspaceId: WorkspaceId, projectIds: readonly ProjectId[] | 'all', _from: string, to: string): Promise<CashPlanItem[]> {
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return [];
        const ids = projectIds === 'all'
            ? (await this.catalog.list(workspaceId, { archived: false })).map(p => asProjectId(p.id))
            : [...new Set(projectIds)];
        const wanted = new Set<string>(ids);
        const out: CashPlanItem[] = [];
        for (const i of await this.repo.openInvoices(workspaceId)) {
            if (!OPEN_RECEIVABLE(i) || i.projectId === null || !wanted.has(i.projectId) || i.dueDate > to) continue;
            const outstanding = invoiceOutstanding(i, i.paidAmount);
            const due = invoiceDue(i);
            // The customer withholds WHT: only the payable share of what is left arrives as cash.
            const amount = due > 0 ? round2(outstanding * (i.payable / due)) : 0;
            if (amount <= 0) continue;
            out.push({ projectId: i.projectId, date: i.dueDate, direction: 'in', amount, source: 'invoice', ref: i.number ?? '' });
        }
        for (const projectId of ids) {
            const contract = await this.contracts.forProject(workspaceId, projectId);
            if (contract === undefined || !BILLABLE_CONTRACT.includes(contract.status)) continue;
            for (const m of contract.milestones) {
                if (!UNBILLED.includes(m.status) || m.dueDate === null || m.dueDate > to || m.amount <= 0) continue;
                out.push({
                    projectId, date: m.dueDate, direction: 'in', amount: round2(m.amount * (1 + contract.vatRate)), source: 'milestone',
                    ref: `${contract.number ?? contract.title} #${m.no}`,
                });
            }
        }
        return out;
    }
}
