// ─── Quotations (module `quotations`, docs/erp/02-domain-model.md §2, WP-23) ───
// Quotations of a project built from a BOQ version (BoqVersionSource, boq-control) and priced by src/domain/quotation;
// issue through the approval `quotation.issue` (Approvals) and numbering (DocumentNumbering, docType `quotation`);
// answers from customer links (CustomerLinkHandlers 'quotation') or recorded by the team; project status through
// ProjectLifecycle (hub). Registers ApprovalHandlers, CustomerLinkHandlers, DailySweeps and ProjectDependents.
// Provides QuotationLookup (accepted versions for main-contracts, WP-26) and QuotationPricingLookup (VO prices, WP-33).
// Deleting a project with an issued number is refused by numbering's guard, so no ProjectDeletionGuards entry here.
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import {
    ApprovalHandlers, CustomerLinkHandlers, DailySweeps, ProjectDependents, QuotationLookup, QuotationPricingLookup,
} from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { QuotationRepository } from './application/ports/quotation.repository';
import { EXPIRE_SWEEP, QuotationHandlers } from './application/quotation-handlers';
import { RepositoryQuotationLookup, RepositoryQuotationPricingLookup } from './application/quotation-lookup';
import { QuotationAccess, QuotationWorkflow } from './application/quotation.service';
import {
    CancelQuotationVersionUseCase, CompareQuotationVersionsUseCase, CreateQuotationUseCase, GetQuotationUseCase, GetQuotationVersionUseCase,
    IssueQuotationVersionUseCase, ListQuotationsUseCase, NewQuotationVersionUseCase, PatchQuotationVersionUseCase, QuotationVersionViews,
    RecordQuotationResponseUseCase,
} from './application/use-cases/quotations.use-cases';
import { DrizzleQuotationRepository } from './infrastructure/adapters/drizzle-quotation.repository';
import { InMemoryQuotationRepository } from './infrastructure/adapters/in-memory-quotation.repository';
import { QuotationsController } from './presentation/quotations.controller';

@Global()
@Module({
    controllers: [QuotationsController],
    providers: [
        persistence(QuotationRepository, () => new InMemoryQuotationRepository(), ctx => new DrizzleQuotationRepository(ctx)),
        QuotationAccess,
        QuotationWorkflow,
        QuotationVersionViews,
        QuotationHandlers,
        ListQuotationsUseCase,
        GetQuotationUseCase,
        GetQuotationVersionUseCase,
        CompareQuotationVersionsUseCase,
        CreateQuotationUseCase,
        PatchQuotationVersionUseCase,
        NewQuotationVersionUseCase,
        IssueQuotationVersionUseCase,
        CancelQuotationVersionUseCase,
        RecordQuotationResponseUseCase,
        RepositoryQuotationLookup,
        { provide: QuotationLookup, useExisting: RepositoryQuotationLookup },
        RepositoryQuotationPricingLookup,
        { provide: QuotationPricingLookup, useExisting: RepositoryQuotationPricingLookup },
    ],
    exports: [QuotationLookup, QuotationPricingLookup],
})
export class QuotationsModule implements OnModuleInit {
    constructor(
        private readonly approvals: ApprovalHandlers,
        private readonly links: CustomerLinkHandlers,
        private readonly sweeps: DailySweeps,
        private readonly dependents: ProjectDependents,
        private readonly repo: QuotationRepository,
        private readonly handlers: QuotationHandlers,
    ) {}

    onModuleInit(): void {
        this.approvals.register('quotation.issue', { onDecided: e => this.handlers.onApprovalDecided(e) });
        this.links.register('quotation', {
            permission: 'quotations.issue',
            view: (ws, id) => this.handlers.linkView(ws, id),
            respond: i => this.handlers.linkRespond(i),
            afterRespond: i => this.handlers.afterLinkRespond(i),
            onViewed: i => this.handlers.onLinkViewed(i),
        });
        this.sweeps.register(EXPIRE_SWEEP, ctx => this.handlers.expire(ctx));
        // Memory adapter: forget a deleted project's quotations (PostgreSQL drops them with the project).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
