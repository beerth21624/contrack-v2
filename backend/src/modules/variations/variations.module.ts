// ─── Variation orders (module `variations`, docs/erp/02-domain-model.md §5, WP-33) ───
// VOs of a signed main contract: lines typed or computed from the calculators over the baseline snapshot
// (BaselineControl), priced with the accepted quotation's sell factors (QuotationPricingLookup); submit through the
// approval `variation.submit` (Approvals) and numbering (docType `variation`); answers from customer links or recorded
// with evidence; acceptance applies to the contract (MainContracts), the cost codes (CostCodeLookup) and the project's
// planned finish (ProjectLifecycle). Registers ApprovalHandlers, CustomerLinkHandlers, HubRollups, BaselineUnlockGuards
// and ProjectDependents. Deleting a project with a VO number is refused by numbering's guard.
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import {
    ApprovalHandlers, BaselineUnlockGuards, CustomerLinkHandlers, HubRollups, ProjectDependents,
} from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { VariationRepository } from './application/ports/variation.repository';
import {
    AddVariationEvidenceUseCase, CancelVariationUseCase, ComputeVariationUseCase, CreateVariationUseCase, DeleteVariationEvidenceUseCase,
    GetVariationUseCase, ListVariationsUseCase, PatchVariationUseCase, PutVariationLinesUseCase, RecordVariationResponseUseCase,
    SubmitVariationUseCase, WithdrawVariationUseCase,
} from './application/use-cases/variations.use-cases';
import { VariationHandlers } from './application/variation-handlers';
import { VariationViews } from './application/variation-views';
import { MODULE, VariationAccess, VariationWorkflow } from './application/variation.service';
import { DrizzleVariationRepository } from './infrastructure/adapters/drizzle-variation.repository';
import { InMemoryVariationRepository } from './infrastructure/adapters/in-memory-variation.repository';
import { VariationsController } from './presentation/variations.controller';

@Global()
@Module({
    controllers: [VariationsController],
    providers: [
        persistence(VariationRepository, () => new InMemoryVariationRepository(), ctx => new DrizzleVariationRepository(ctx)),
        VariationAccess,
        VariationViews,
        VariationWorkflow,
        VariationHandlers,
        ListVariationsUseCase,
        GetVariationUseCase,
        CreateVariationUseCase,
        PatchVariationUseCase,
        PutVariationLinesUseCase,
        ComputeVariationUseCase,
        AddVariationEvidenceUseCase,
        DeleteVariationEvidenceUseCase,
        SubmitVariationUseCase,
        RecordVariationResponseUseCase,
        WithdrawVariationUseCase,
        CancelVariationUseCase,
    ],
})
export class VariationsModule implements OnModuleInit {
    constructor(
        private readonly approvals: ApprovalHandlers,
        private readonly links: CustomerLinkHandlers,
        private readonly rollups: HubRollups,
        private readonly unlockGuards: BaselineUnlockGuards,
        private readonly dependents: ProjectDependents,
        private readonly repo: VariationRepository,
        private readonly handlers: VariationHandlers,
    ) {}

    onModuleInit(): void {
        this.approvals.register('variation.submit', { onDecided: e => this.handlers.onApprovalDecided(e) });
        this.links.register('variation', {
            permission: 'variations.manage',
            view: (ws, id) => this.handlers.linkView(ws, id),
            respond: i => this.handlers.linkRespond(i),
            afterRespond: i => this.handlers.afterLinkRespond(i),
        });
        this.rollups.register(MODULE, (ws, projectIds) => this.handlers.rollup(ws, projectIds));
        this.unlockGuards.register((ws, projectId) => this.handlers.unlockBlockers(ws, projectId));
        // Memory adapter: forget a deleted project's variations (PostgreSQL drops them with the project).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
