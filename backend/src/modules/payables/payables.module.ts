// ─── Payables (module `payables`, docs/erp/02-domain-model.md §10, WP-49) ───
// Supplier bills: from a PO + goods received with the 3-way match (PurchaseOrders), from an approved subcontract claim
// (SubcontractPayables), from an approved pay period (PayPeriodPayments), or typed. Approval `supplier_bill.approve` →
// posted: number `AP`, fin_events `ap.bill_posted`, cost ledger (price differences, bills without a PO), PO billed
// quantities. Payment runs (WP-50): approved bills → scheduled → approval `payment_run.approve` → paid: vouchers `PV` per
// supplier, 50 ทวิ `WHT`, fin_events `ap.payment` / `ap.wht_withheld`, subcontract claims and pay periods marked paid
// through SubcontractClaimPayer / PayPeriodPayments. Registers ApprovalHandlers, PayPeriodBillChecks (labour refuses to pay a billed period), CashPlanSources
// (bills to pay), PortalSources (bills due within 7 days), DailySweeps (`payables.due`) and ProjectDependents.
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import {
    ApprovalHandlers, CashPlanSources, DailySweeps, PayPeriodBillChecks, PortalSources, ProjectDependents,
} from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { DUE_SOON_SWEEP, PayablesHandlers } from './application/payables-handlers';
import { APPROVAL_SUBJECT, BillLines, BillPosting, BillViews, MODULE, PayablesAccess } from './application/payables.service';
import { RUN_APPROVAL_SUBJECT, RunBills, RunPayment, RunViews } from './application/payment-runs.service';
import { PayablesRepository } from './application/ports/payables.repository';
import {
    ApproveSupplierBillUseCase, CreateBillFromOrderUseCase, CreateBillFromPayPeriodUseCase, CreateBillFromScClaimUseCase,
    CreateSupplierBillUseCase, GetPayablesDueUseCase, GetSupplierBillUseCase, ListSupplierBillsUseCase, PatchSupplierBillUseCase,
    VoidSupplierBillUseCase,
} from './application/use-cases/bills.use-cases';
import {
    ApprovePaymentRunUseCase, CancelPaymentRunUseCase, CreatePaymentRunUseCase, GetPaymentRunUseCase, GetPaymentUseCase,
    GetWhtCertificateUseCase, ListPaymentRunsUseCase, PatchPaymentRunUseCase, PayPaymentRunUseCase, RunAccess,
} from './application/use-cases/payment-runs.use-cases';
import { DrizzlePayablesRepository } from './infrastructure/adapters/drizzle-payables.repository';
import { InMemoryPayablesRepository } from './infrastructure/adapters/in-memory-payables.repository';
import { PayablesController } from './presentation/payables.controller';
import { PaymentRunsController } from './presentation/payment-runs.controller';

@Global()
@Module({
    controllers: [PayablesController, PaymentRunsController],
    providers: [
        persistence(PayablesRepository, () => new InMemoryPayablesRepository(), ctx => new DrizzlePayablesRepository(ctx)),
        PayablesAccess,
        BillLines,
        BillViews,
        BillPosting,
        PayablesHandlers,
        ListSupplierBillsUseCase,
        GetSupplierBillUseCase,
        GetPayablesDueUseCase,
        CreateSupplierBillUseCase,
        CreateBillFromOrderUseCase,
        CreateBillFromScClaimUseCase,
        CreateBillFromPayPeriodUseCase,
        PatchSupplierBillUseCase,
        ApproveSupplierBillUseCase,
        VoidSupplierBillUseCase,
        RunAccess,
        RunViews,
        RunBills,
        RunPayment,
        ListPaymentRunsUseCase,
        GetPaymentRunUseCase,
        GetPaymentUseCase,
        GetWhtCertificateUseCase,
        CreatePaymentRunUseCase,
        PatchPaymentRunUseCase,
        ApprovePaymentRunUseCase,
        PayPaymentRunUseCase,
        CancelPaymentRunUseCase,
    ],
})
export class PayablesModule implements OnModuleInit {
    constructor(
        private readonly approvals: ApprovalHandlers,
        private readonly billChecks: PayPeriodBillChecks,
        private readonly cashPlans: CashPlanSources,
        private readonly portal: PortalSources,
        private readonly sweeps: DailySweeps,
        private readonly dependents: ProjectDependents,
        private readonly repo: PayablesRepository,
        private readonly handlers: PayablesHandlers,
    ) {}

    onModuleInit(): void {
        this.approvals.register(APPROVAL_SUBJECT, { onDecided: e => this.handlers.onBillDecided(e) });
        this.approvals.register(RUN_APPROVAL_SUBJECT, { onDecided: e => this.handlers.onRunDecided(e) });
        this.billChecks.register((ws, periodId) => this.handlers.hasPayPeriodBill(ws, periodId));
        this.cashPlans.register(MODULE, (ws, projectIds, from, to) => this.handlers.cashPlan(ws, projectIds, from, to));
        this.portal.register(MODULE, 'payables.pay', ctx => this.handlers.portalDue(ctx));
        this.sweeps.register(DUE_SOON_SWEEP, ctx => this.handlers.dueSoon(ctx));
        // Memory adapter: forget a deleted project's bills (PostgreSQL drops them with the project).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
