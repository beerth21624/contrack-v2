// ─── Billing (module `billing`, docs/erp/02-domain-model.md §4, WP-29) ───
// Progress claims of a signed main contract (MainContracts, main-contracts) computed by src/domain/billing, submitted
// through the approval `claim.submit` (Approvals), certified by the customer's inspector and invoiced (DocumentNumbering
// `invoice`, FinancialEvents, CostCodeLookup.setCertifiedProgress, milestones via MainContracts.markMilestone); advance
// and retention release invoices; customer retention / advance ledgers. WP-30: receipts (`RC`), tax invoices (`TI`) per
// receipt or ahead, credit notes (`CN`), AR aging, customer statement, PromptPay payload.
// Registers ApprovalHandlers('claim.submit'), HubRollups (billedToDate, receivedToDate, overdueReceivable),
// BaselineUnlockGuards, ProjectDeletionGuards, ProjectDependents, CustomerLinkHandlers('invoice') and the daily sweeps
// `billing.invoice-due` / `billing.retention-release-due`, PortalSources (overdue invoices, claimable milestones; WP-35),
// CashPlanSources (open invoices, unbilled milestones with a due date; WP-47);
// provides the BillingTotals port (global).
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import {
    ApprovalHandlers, BaselineUnlockGuards, BillingTotals, CashPlanSources, CustomerLinkHandlers, DailySweeps, HubRollups, PortalSources, ProjectDeletionGuards,
    ProjectDependents,
} from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { BillingCashPlan } from './application/billing-cash-plan';
import { BillingPortal } from './application/billing-portal';
import { BillingViews } from './application/billing-views';
import { BillingAccess, BillingHandlers, ClaimCalculator, InvoiceIssuer, MODULE } from './application/billing.service';
import { BillingRepository } from './application/ports/billing.repository';
import {
    INVOICE_DUE_SWEEP, RETENTION_DUE_SWEEP, ReceiptViews, ReceivablesHandlers, RepositoryBillingTotals, TaxDocumentWriter,
} from './application/receivables.service';
import {
    CancelClaimUseCase, CertifyClaimUseCase, CreateClaimUseCase, GetClaimUseCase, InvoiceClaimUseCase, ListClaimsUseCase, PatchClaimUseCase,
    SubmitClaimUseCase,
} from './application/use-cases/claims.use-cases';
import {
    CreateAdvanceInvoiceUseCase, CreateRetentionReleaseInvoiceUseCase, GetContractAdvanceUseCase, GetContractRetentionUseCase,
    GetInvoiceUseCase, IssueInvoiceUseCase, ListProjectInvoicesUseCase, VoidInvoiceUseCase,
} from './application/use-cases/invoices.use-cases';
import {
    CreateCreditNoteUseCase, CustomerStatementUseCase, GetReceiptUseCase, InvoicePromptPayUseCase, IssueTaxInvoiceUseCase, ReceivablesAgingUseCase,
    RecordReceiptUseCase, VoidReceiptUseCase,
} from './application/use-cases/receipts.use-cases';
import { DrizzleBillingRepository } from './infrastructure/adapters/drizzle-billing.repository';
import { InMemoryBillingRepository } from './infrastructure/adapters/in-memory-billing.repository';
import { BillingController } from './presentation/billing.controller';

@Global()
@Module({
    controllers: [BillingController],
    providers: [
        persistence(BillingRepository, () => new InMemoryBillingRepository(), ctx => new DrizzleBillingRepository(ctx)),
        BillingAccess,
        ClaimCalculator,
        InvoiceIssuer,
        BillingViews,
        BillingHandlers,
        BillingPortal,
        BillingCashPlan,
        ListClaimsUseCase,
        GetClaimUseCase,
        CreateClaimUseCase,
        PatchClaimUseCase,
        SubmitClaimUseCase,
        CertifyClaimUseCase,
        InvoiceClaimUseCase,
        CancelClaimUseCase,
        ListProjectInvoicesUseCase,
        GetInvoiceUseCase,
        CreateAdvanceInvoiceUseCase,
        CreateRetentionReleaseInvoiceUseCase,
        IssueInvoiceUseCase,
        VoidInvoiceUseCase,
        GetContractRetentionUseCase,
        GetContractAdvanceUseCase,
        TaxDocumentWriter,
        ReceiptViews,
        ReceivablesHandlers,
        { provide: BillingTotals, useClass: RepositoryBillingTotals },
        RecordReceiptUseCase,
        GetReceiptUseCase,
        VoidReceiptUseCase,
        IssueTaxInvoiceUseCase,
        CreateCreditNoteUseCase,
        ReceivablesAgingUseCase,
        CustomerStatementUseCase,
        InvoicePromptPayUseCase,
    ],
    exports: [BillingTotals],
})
export class BillingModule implements OnModuleInit {
    constructor(
        private readonly approvals: ApprovalHandlers,
        private readonly rollups: HubRollups,
        private readonly unlockGuards: BaselineUnlockGuards,
        private readonly deletionGuards: ProjectDeletionGuards,
        private readonly dependents: ProjectDependents,
        private readonly repo: BillingRepository,
        private readonly handlers: BillingHandlers,
        private readonly links: CustomerLinkHandlers,
        private readonly sweeps: DailySweeps,
        private readonly receivables: ReceivablesHandlers,
        private readonly portal: PortalSources,
        private readonly portalTasks: BillingPortal,
        private readonly cashPlans: CashPlanSources,
        private readonly cashPlan: BillingCashPlan,
    ) {}

    onModuleInit(): void {
        this.approvals.register('claim.submit', { onDecided: e => this.handlers.onApprovalDecided(e) });
        this.rollups.register(MODULE, (ws, projectIds) => this.handlers.rollup(ws, projectIds));
        this.unlockGuards.register((ws, projectId) => this.handlers.unlockBlockers(ws, projectId));
        this.deletionGuards.register((ws, projectId) => this.handlers.deletionBlockers(ws, projectId));
        this.links.register('invoice', { permission: 'billing.read', view: (ws, id) => this.receivables.linkView(ws, id) });
        this.sweeps.register(INVOICE_DUE_SWEEP, ctx => this.receivables.invoiceDue(ctx));
        this.sweeps.register(RETENTION_DUE_SWEEP, ctx => this.receivables.retentionDue(ctx));
        this.portal.register(MODULE, 'billing.receive', ctx => this.portalTasks.overdueInvoices(ctx));
        this.portal.register(MODULE, 'billing.manage', ctx => this.portalTasks.claimableMilestones(ctx));
        this.cashPlans.register(MODULE, (ws, projectIds, from, to) => this.cashPlan.plan(ws, projectIds, from, to));
        // Memory adapter: forget a deleted project's billing rows (PostgreSQL drops them with the project).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
