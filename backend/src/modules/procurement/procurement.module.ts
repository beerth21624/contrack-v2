// ─── Purchasing (module `procurement`, docs/erp/02-domain-model.md §7.2, WP-38 …) ───
// Purchase requests (site or BOQ, budget check per cost code against CostCodeLookup + CostLedger, numbering
// `purchase_request`, approval `purchase_request.approve`) and RFQs (suppliers through SupplierLookup, numbering `rfq`,
// quotes typed by the team, comparison, award). Registers ApprovalHandlers, PortalSources (approved PRs waiting for a
// PO) and ProjectDependents. Deleting a project with a PR / RFQ number is refused by numbering's guard.
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { ApprovalHandlers, PortalSources, ProjectDependents } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { PurchaseRequestRepository, RfqRepository } from './application/ports/procurement.repository';
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
import { ProcurementController } from './presentation/procurement.controller';

@Global()
@Module({
    controllers: [ProcurementController],
    providers: [
        persistence(PurchaseRequestRepository, () => new InMemoryPurchaseRequestRepository(), ctx => new DrizzlePurchaseRequestRepository(ctx)),
        persistence(RfqRepository, () => new InMemoryRfqRepository(), ctx => new DrizzleRfqRepository(ctx)),
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
    ],
})
export class ProcurementModule implements OnModuleInit {
    constructor(
        private readonly approvals: ApprovalHandlers,
        private readonly portal: PortalSources,
        private readonly dependents: ProjectDependents,
        private readonly requests: PurchaseRequestRepository,
        private readonly rfqs: RfqRepository,
        private readonly handlers: ProcurementHandlers,
    ) {}

    onModuleInit(): void {
        this.approvals.register('purchase_request.approve', { onDecided: e => this.handlers.onPurchaseRequestDecided(e) });
        this.portal.register(MODULE, 'procurement.manage', ctx => this.handlers.portalToOrder(ctx));
        // Memory adapters: forget a deleted project's documents (PostgreSQL drops them with the project).
        this.dependents.register(async (workspaceId, projectId) => {
            await this.rfqs.deleteByProject(workspaceId, projectId);
            await this.requests.deleteByProject(workspaceId, projectId);
        });
    }
}
