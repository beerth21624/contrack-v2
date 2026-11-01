// ─── Job cost (module `job-cost`, docs/erp/02-domain-model.md §9, WP-46) ───
// Budget (cost codes of the baseline, CostCodeLookup) vs committed / actual (CostLedger) vs forecast at completion per
// cost code and BOQ section, projected profit from the main contract (MainContracts) and billing totals; subcontracts
// posted to the ledger through SubcontractCommitments (subcontracting) when the report opens and in the daily sweep
// `job-cost.alerts` (cost_overrun / commitment_over_budget / margin_drop → jc_alerts + `cost.overrun`). Registers
// HubRollups (committedOpen, actualCost, forecastAtCompletion, projectedProfit, alerts → portal risky projects),
// DailySweeps and ProjectDependents. WP-47: cash flow per project / company (CashPlanSources of the modules +
// FinancialEvents cash; registers the `subcontracting` source through SubcontractCashPlan), cash settings, the daily
// sweep `job-cost.cash` (negative_cash alerts, `cash.negative_forecast`) and the portal's cash outlook (PortalCashOutlook).
// WP-55: provides UnitRateHistory (`jc_unit_rates`, written by the closeout) and GET /workspaces/:id/unit-rates.
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import {
    CashPlanSources, DailySweeps, HubRollups, PortalCashOutlook, ProjectDependents, SubcontractCashPlan, UnitRateHistory,
} from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { CASH_SWEEP, CashFlowEngine } from './application/cash-flow.service';
import { ALERTS_SWEEP, JobCostHandlers } from './application/job-cost-handlers';
import { JobCostEngine, MODULE } from './application/job-cost.service';
import { JobCostRepository } from './application/ports/job-cost.repository';
import { SubcontractCostSync } from './application/subcontract-cost-sync';
import { GetUnitRatesUseCase, RepositoryUnitRateHistory } from './application/unit-rates';
import {
    GetCashSettingsUseCase, GetCompanyCashFlowUseCase, GetProjectCashFlowUseCase, PutCashSettingsUseCase,
} from './application/use-cases/cash-flow.use-cases';
import {
    GetJobCostLedgerUseCase, GetJobCostReportUseCase, ListJobCostAlertsUseCase, PutJobCostForecastUseCase,
} from './application/use-cases/job-cost.use-cases';
import { DrizzleJobCostRepository } from './infrastructure/adapters/drizzle-job-cost.repository';
import { InMemoryJobCostRepository } from './infrastructure/adapters/in-memory-job-cost.repository';
import { JobCostController } from './presentation/job-cost.controller';
import { UnitRatesController } from './presentation/unit-rates.controller';

@Global()
@Module({
    controllers: [JobCostController, UnitRatesController],
    providers: [
        persistence(JobCostRepository, () => new InMemoryJobCostRepository(), ctx => new DrizzleJobCostRepository(ctx)),
        SubcontractCostSync,
        JobCostEngine,
        JobCostHandlers,
        GetJobCostReportUseCase,
        GetJobCostLedgerUseCase,
        PutJobCostForecastUseCase,
        ListJobCostAlertsUseCase,
        CashFlowEngine,
        GetProjectCashFlowUseCase,
        GetCompanyCashFlowUseCase,
        GetCashSettingsUseCase,
        PutCashSettingsUseCase,
        { provide: UnitRateHistory, useClass: RepositoryUnitRateHistory },
        GetUnitRatesUseCase,
    ],
    exports: [UnitRateHistory],
})
export class JobCostModule implements OnModuleInit {
    constructor(
        private readonly rollups: HubRollups,
        private readonly sweeps: DailySweeps,
        private readonly dependents: ProjectDependents,
        private readonly repo: JobCostRepository,
        private readonly engine: JobCostEngine,
        private readonly handlers: JobCostHandlers,
        private readonly cashPlans: CashPlanSources,
        private readonly subcontractCash: SubcontractCashPlan,
        private readonly cash: CashFlowEngine,
        private readonly outlook: PortalCashOutlook,
    ) {}

    onModuleInit(): void {
        this.rollups.register(MODULE, (ws, projectIds) => this.engine.rollup(ws, projectIds));
        this.sweeps.register(ALERTS_SWEEP, () => this.handlers.alertsSweep());
        this.sweeps.register(CASH_SWEEP, ctx => this.cash.sweep(ctx));
        this.cashPlans.register('subcontracting', (ws, projectIds, from, to) => this.subcontractCash.plan(ws, projectIds, from, to));
        this.outlook.register(MODULE, 'cost.read', (ws, now) => this.cash.outlook(ws, now));
        // Memory adapter: forget a deleted project's forecasts and alerts (PostgreSQL drops them with the project).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
