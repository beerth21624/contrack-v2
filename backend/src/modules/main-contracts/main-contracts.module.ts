// ─── Main contracts (module `contracts`, docs/erp/02-domain-model.md §3, WP-26) ───
// The contract with the project owner, made from an accepted quotation (QuotationLookup, quotations) or empty; signing
// issues the `CT` number (DocumentNumbering), locks the baseline (BaselineControl) when needed, spreads the value over
// the cost codes (CostCodeLookup) and moves the project to `in_progress` (ProjectLifecycle). Provides MainContracts.
// Registers HubRollups, BaselineUnlockGuards, DailySweeps ('contracts.guarantee-expiring') and ProjectDependents.
// Deleting a project with a contract number is refused by numbering's guard, so no ProjectDeletionGuards entry here.
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { BaselineUnlockGuards, DailySweeps, HubRollups, MainContracts, ProjectDependents } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { MainContractViews } from './application/main-contract-views';
import {
    GUARANTEE_SWEEP, MODULE, MainContractAccess, MainContractHandlers, MainContractsService,
} from './application/main-contract.service';
import { MainContractRepository } from './application/ports/main-contract.repository';
import { CreateGuaranteeUseCase, ListGuaranteesUseCase, PatchGuaranteeUseCase } from './application/use-cases/guarantees.use-cases';
import {
    AddSignedScanUseCase, CancelMainContractUseCase, CloseMainContractUseCase, ContractSettings, CreateMainContractUseCase,
    GetMainContractUseCase, GetProjectMainContractUseCase, PatchMainContractUseCase, PutContractMilestonesUseCase, SignMainContractUseCase,
    TerminateMainContractUseCase,
} from './application/use-cases/main-contracts.use-cases';
import { DrizzleMainContractRepository } from './infrastructure/adapters/drizzle-main-contract.repository';
import { InMemoryMainContractRepository } from './infrastructure/adapters/in-memory-main-contract.repository';
import { MainContractsController } from './presentation/main-contracts.controller';

@Global()
@Module({
    controllers: [MainContractsController],
    providers: [
        persistence(MainContractRepository, () => new InMemoryMainContractRepository(), ctx => new DrizzleMainContractRepository(ctx)),
        MainContractAccess,
        MainContractViews,
        MainContractHandlers,
        MainContractsService,
        { provide: MainContracts, useExisting: MainContractsService },
        ContractSettings,
        GetProjectMainContractUseCase,
        GetMainContractUseCase,
        CreateMainContractUseCase,
        PatchMainContractUseCase,
        PutContractMilestonesUseCase,
        SignMainContractUseCase,
        TerminateMainContractUseCase,
        CancelMainContractUseCase,
        CloseMainContractUseCase,
        AddSignedScanUseCase,
        ListGuaranteesUseCase,
        CreateGuaranteeUseCase,
        PatchGuaranteeUseCase,
    ],
    exports: [MainContracts],
})
export class MainContractsModule implements OnModuleInit {
    constructor(
        private readonly rollups: HubRollups,
        private readonly unlockGuards: BaselineUnlockGuards,
        private readonly sweeps: DailySweeps,
        private readonly dependents: ProjectDependents,
        private readonly repo: MainContractRepository,
        private readonly handlers: MainContractHandlers,
    ) {}

    onModuleInit(): void {
        this.rollups.register(MODULE, (ws, projectIds) => this.handlers.rollup(ws, projectIds));
        this.unlockGuards.register((ws, projectId) => this.handlers.unlockBlockers(ws, projectId));
        this.sweeps.register(GUARANTEE_SWEEP, ctx => this.handlers.guaranteeExpiring(ctx));
        // Memory adapter: forget a deleted project's contracts (PostgreSQL drops them with the project).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
