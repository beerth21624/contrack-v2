// ─── Handover and warranty (module `handover`, docs/erp/02-domain-model.md §11, WP-53) ───
// The handover of a project with a signed main contract: schedule (project → `handover`, ProjectLifecycle), inspect,
// accept (number `HO` via DocumentNumbering, contract completed via MainContracts, project → `warranty`, warranty
// period), and the warranty claims (number `WC`, cost of a closed claim → CostLedger). Registers HubRollups (alerts),
// PortalSources (claims being worked on), DailySweeps ('handover.warranty') and ProjectDependents. WP-55: the closeout
// (summary from CostCodeLookup / CostLedger / MainContracts / BillingTotals; finalize → project `closed`, UnitRateHistory). Deleting a project
// with a handover / claim number is refused by numbering's guard, so no ProjectDeletionGuards entry here.
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { DailySweeps, HubRollups, PortalSources, ProjectDependents } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import {
    HandoverAccess, HandoverHandlers, HandoverNotices, HandoverViews, MODULE, WARRANTY_SWEEP,
} from './application/handover.service';
import { HandoverRepository } from './application/ports/handover.repository';
import {
    AcceptHandoverUseCase, AddHandoverDocumentUseCase, CreateHandoverUseCase, GetProjectHandoverUseCase, InspectHandoverUseCase,
    PatchHandoverUseCase, RejectHandoverUseCase, ScheduleHandoverUseCase,
} from './application/use-cases/handover.use-cases';
import {
    CloseoutCalculator, CloseoutViews, FinalizeCloseoutUseCase, GetCloseoutUseCase, PatchCloseoutUseCase,
} from './application/use-cases/closeout.use-cases';
import {
    ClaimWriter, CreateWarrantyClaimUseCase, GetProjectWarrantyUseCase, ListWarrantyClaimsUseCase, PatchWarrantyClaimUseCase,
    WarrantyClaimActions,
} from './application/use-cases/warranty.use-cases';
import { DrizzleHandoverRepository } from './infrastructure/adapters/drizzle-handover.repository';
import { InMemoryHandoverRepository } from './infrastructure/adapters/in-memory-handover.repository';
import { HandoverController } from './presentation/handover.controller';

@Global()
@Module({
    controllers: [HandoverController],
    providers: [
        persistence(HandoverRepository, () => new InMemoryHandoverRepository(), ctx => new DrizzleHandoverRepository(ctx)),
        HandoverAccess,
        HandoverViews,
        HandoverNotices,
        HandoverHandlers,
        GetProjectHandoverUseCase,
        CreateHandoverUseCase,
        PatchHandoverUseCase,
        ScheduleHandoverUseCase,
        InspectHandoverUseCase,
        AcceptHandoverUseCase,
        RejectHandoverUseCase,
        AddHandoverDocumentUseCase,
        GetProjectWarrantyUseCase,
        ListWarrantyClaimsUseCase,
        CreateWarrantyClaimUseCase,
        ClaimWriter,
        PatchWarrantyClaimUseCase,
        WarrantyClaimActions,
        CloseoutCalculator,
        CloseoutViews,
        GetCloseoutUseCase,
        PatchCloseoutUseCase,
        FinalizeCloseoutUseCase,
    ],
})
export class HandoverModule implements OnModuleInit {
    constructor(
        private readonly rollups: HubRollups,
        private readonly portal: PortalSources,
        private readonly sweeps: DailySweeps,
        private readonly dependents: ProjectDependents,
        private readonly repo: HandoverRepository,
        private readonly handlers: HandoverHandlers,
    ) {}

    onModuleInit(): void {
        this.rollups.register(MODULE, (ws, projectIds) => this.handlers.rollup(ws, projectIds));
        this.portal.register(MODULE, 'handover.manage', ctx => this.handlers.portalClaims(ctx));
        this.sweeps.register(WARRANTY_SWEEP, ctx => this.handlers.warrantySweep(ctx));
        // Memory adapter: forget a deleted project's handover rows (PostgreSQL drops them with the project).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
