// ─── Purchasing (module `procurement`, docs/erp/02-domain-model.md §7.2, WP-38 …) ───
// Purchase requests (site or BOQ, budget check per cost code against CostCodeLookup + CostLedger, numbering
// `purchase_request`, approval `purchase_request.approve`) and RFQs (suppliers through SupplierLookup, numbering `rfq`,
// quotes typed by the team, comparison, award → PO draft), purchase orders (budget check, approval
// `purchase_order.issue`, numbering `purchase_order`, cost commitments) and goods receipts (numbering `goods_receipt`,
// actual cost). Registers ApprovalHandlers, HubRollups (open POs), PortalSources (approved PRs waiting for a PO, POs
// waiting for goods), CashPlanSources (issued POs not billed, WP-47) and ProjectDependents; provides the PurchaseOrders
// port. Deleting a project with a numbered document is refused by numbering's guard.
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { ApprovalHandlers, CashPlanSources, HubRollups, PortalSources, ProjectDependents, PurchaseOrders } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import {
    GoodsReceiptRepository, PurchaseOrderRepository, PurchaseRequestRepository, RfqRepository,
} from './application/ports/procurement.repository';
import { ProcurementPurchaseOrders, PurchasingHandlers } from './application/purchasing-handlers';
import { PurchasingViews } from './application/purchasing-views';
import { PurchaseOrderLines, PurchaseOrderWorkflow } from './application/purchasing.service';
import {
    CancelGoodsReceiptUseCase, ConfirmGoodsReceiptUseCase, CreateGoodsReceiptUseCase, ListGoodsReceiptsUseCase,
} from './application/use-cases/goods-receipts.use-cases';
import {
    CancelPurchaseOrderUseCase, ClosePurchaseOrderUseCase, CreatePurchaseOrderUseCase, GetPurchaseOrderUseCase, IssuePurchaseOrderUseCase,
    ListProjectPurchaseOrdersUseCase, ListWorkspacePurchaseOrdersUseCase, PatchPurchaseOrderUseCase, SupplierPriceHistoryUseCase,
} from './application/use-cases/purchase-orders.use-cases';
import { ProcurementCashPlan } from './application/procurement-cash-plan';
import { ProcurementHandlers } from './application/procurement-handlers';
import { ProcurementViews } from './application/procurement-views';
import { MODULE, ProcurementAccess, PurchaseRequestLines } from './application/procurement.service';
import {
    CancelPurchaseRequestUseCase, CreatePurchaseRequestUseCase, GetPurchaseRequestUseCase, ListPurchaseRequestsUseCase,
    PatchPurchaseRequestUseCase, SubmitPurchaseRequestUseCase,
} from './application/use-cases/purchase-requests.use-cases';
import {
    AwardRfqUseCase, CancelRfqUseCase, CompareRfqUseCase, CreateRfqUseCase, GetRfqUseCase, ListRfqsUseCase, PatchRfqUseCase,
    PutRfqQuoteUseCase, PutRfqSuppliersUseCase, SendRfqUseCase,
} from './application/use-cases/rfqs.use-cases';
import {
    DrizzlePurchaseRequestRepository, DrizzleRfqRepository,
} from './infrastructure/adapters/drizzle-procurement.repository';
import {
    InMemoryPurchaseRequestRepository, InMemoryRfqRepository,
} from './infrastructure/adapters/in-memory-procurement.repository';
import {
    DrizzleGoodsReceiptRepository, DrizzlePurchaseOrderRepository,
} from './infrastructure/adapters/drizzle-purchasing.repository';
import {
    InMemoryGoodsReceiptRepository, InMemoryPurchaseOrderRepository,
} from './infrastructure/adapters/in-memory-purchasing.repository';
import { ProcurementController } from './presentation/procurement.controller';

@Global()
@Module({
    controllers: [ProcurementController],
    providers: [
        persistence(PurchaseRequestRepository, () => new InMemoryPurchaseRequestRepository(), ctx => new DrizzlePurchaseRequestRepository(ctx)),
        persistence(RfqRepository, () => new InMemoryRfqRepository(), ctx => new DrizzleRfqRepository(ctx)),
        persistence(PurchaseOrderRepository, () => new InMemoryPurchaseOrderRepository(), ctx => new DrizzlePurchaseOrderRepository(ctx)),
        persistence(GoodsReceiptRepository, () => new InMemoryGoodsReceiptRepository(), ctx => new DrizzleGoodsReceiptRepository(ctx)),
        ProcurementAccess,
        PurchaseRequestLines,
        ProcurementViews,
        ProcurementHandlers,
        ListPurchaseRequestsUseCase,
        GetPurchaseRequestUseCase,
        CreatePurchaseRequestUseCase,
        PatchPurchaseRequestUseCase,
        SubmitPurchaseRequestUseCase,
        CancelPurchaseRequestUseCase,
        ListRfqsUseCase,
        GetRfqUseCase,
        CompareRfqUseCase,
        CreateRfqUseCase,
        PatchRfqUseCase,
        PutRfqSuppliersUseCase,
        SendRfqUseCase,
        CancelRfqUseCase,
        PutRfqQuoteUseCase,
        AwardRfqUseCase,
        PurchaseOrderLines,
        PurchaseOrderWorkflow,
        PurchasingViews,
        PurchasingHandlers,
        ProcurementCashPlan,
        { provide: PurchaseOrders, useClass: ProcurementPurchaseOrders },
        ListProjectPurchaseOrdersUseCase,
        ListWorkspacePurchaseOrdersUseCase,
        GetPurchaseOrderUseCase,
        CreatePurchaseOrderUseCase,
        PatchPurchaseOrderUseCase,
        IssuePurchaseOrderUseCase,
        CancelPurchaseOrderUseCase,
        ClosePurchaseOrderUseCase,
        SupplierPriceHistoryUseCase,
        ListGoodsReceiptsUseCase,
        CreateGoodsReceiptUseCase,
        ConfirmGoodsReceiptUseCase,
        CancelGoodsReceiptUseCase,
    ],
    exports: [PurchaseOrders],
})
export class ProcurementModule implements OnModuleInit {
    constructor(
        private readonly approvals: ApprovalHandlers,
        private readonly portal: PortalSources,
        private readonly rollups: HubRollups,
        private readonly dependents: ProjectDependents,
        private readonly requests: PurchaseRequestRepository,
        private readonly rfqs: RfqRepository,
        private readonly orders: PurchaseOrderRepository,
        private readonly receipts: GoodsReceiptRepository,
        private readonly handlers: ProcurementHandlers,
        private readonly purchasing: PurchasingHandlers,
        private readonly cashPlans: CashPlanSources,
        private readonly cashPlan: ProcurementCashPlan,
    ) {}

    onModuleInit(): void {
        this.approvals.register('purchase_request.approve', { onDecided: e => this.handlers.onPurchaseRequestDecided(e) });
        this.approvals.register('purchase_order.issue', { onDecided: e => this.purchasing.onPurchaseOrderDecided(e) });
        this.portal.register(MODULE, 'procurement.manage', ctx => this.handlers.portalToOrder(ctx));
        this.portal.register(MODULE, 'procurement.receive', ctx => this.purchasing.portalToReceive(ctx));
        this.rollups.register(MODULE, (ws, projectIds) => this.purchasing.rollup(ws, projectIds));
        this.cashPlans.register(MODULE, (ws, projectIds, from, to) => this.cashPlan.plan(ws, projectIds, from, to));
        // Memory adapters: forget a deleted project's documents (PostgreSQL drops them with the project).
        this.dependents.register(async (workspaceId, projectId) => {
            await this.receipts.deleteByProject(workspaceId, projectId);
            await this.orders.deleteByProject(workspaceId, projectId);
            await this.rfqs.deleteByProject(workspaceId, projectId);
            await this.requests.deleteByProject(workspaceId, projectId);
        });
    }
}
