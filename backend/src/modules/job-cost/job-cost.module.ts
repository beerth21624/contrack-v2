// ─── Job cost (module `job-cost`, docs/erp/02-domain-model.md §9, WP-46) ───
// Budget (cost codes of the baseline, CostCodeLookup) vs committed / actual (CostLedger) vs forecast at completion per
// cost code and BOQ section, projected profit from the main contract (MainContracts) and billing totals; subcontracts
// posted to the ledger through SubcontractCommitments (subcontracting) when the report opens and in the daily sweep
// `job-cost.alerts` (cost_overrun / commitment_over_budget / margin_drop → jc_alerts + `cost.overrun`). Registers
// HubRollups (committedOpen, actualCost, forecastAtCompletion, projectedProfit, alerts → portal risky projects),
// DailySweeps and ProjectDependents.
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { DailySweeps, HubRollups, ProjectDependents } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { ALERTS_SWEEP, JobCostHandlers } from './application/job-cost-handlers';
import { JobCostEngine, MODULE } from './application/job-cost.service';
import { JobCostRepository } from './application/ports/job-cost.repository';
import { SubcontractCostSync } from './application/subcontract-cost-sync';
import {
    GetJobCostLedgerUseCase, GetJobCostReportUseCase, ListJobCostAlertsUseCase, PutJobCostForecastUseCase,
} from './application/use-cases/job-cost.use-cases';
import { DrizzleJobCostRepository } from './infrastructure/adapters/drizzle-job-cost.repository';
import { InMemoryJobCostRepository } from './infrastructure/adapters/in-memory-job-cost.repository';
import { JobCostController } from './presentation/job-cost.controller';

@Global()
@Module({
    controllers: [JobCostController],
    providers: [
        persistence(JobCostRepository, () => new InMemoryJobCostRepository(), ctx => new DrizzleJobCostRepository(ctx)),
        SubcontractCostSync,
        JobCostEngine,
        JobCostHandlers,
        GetJobCostReportUseCase,
        GetJobCostLedgerUseCase,
        PutJobCostForecastUseCase,
        ListJobCostAlertsUseCase,
    ],
})
export class JobCostModule implements OnModuleInit {
    constructor(
        private readonly rollups: HubRollups,
        private readonly sweeps: DailySweeps,
        private readonly dependents: ProjectDependents,
        private readonly repo: JobCostRepository,
        private readonly engine: JobCostEngine,
        private readonly handlers: JobCostHandlers,
    ) {}

    onModuleInit(): void {
        this.rollups.register(MODULE, (ws, projectIds) => this.engine.rollup(ws, projectIds));
        this.sweeps.register(ALERTS_SWEEP, () => this.handlers.alertsSweep());
        // Memory adapter: forget a deleted project's forecasts and alerts (PostgreSQL drops them with the project).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
