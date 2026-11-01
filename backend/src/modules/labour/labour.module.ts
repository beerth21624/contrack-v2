// ─── Labour (module `labour`, docs/erp/02-domain-model.md §8.2, WP-44) ───
// Timesheets per person / project / day (people and wages from workforce through PeopleDirectory, prefilled from the
// crews of the day's site report through SiteDiaryManpower), approval `timesheet.approve` → actual labour cost
// (CostLedger, source `timesheet`); half-month pay periods (build with wage advances recovered oldest first → approval
// `pay_period.approve` → pay: FinancialEvents `lb.wages_paid` / `lb.advance_recovered`, refused while payables holds a
// bill of the period through PayPeriodBillChecks); wage advances (`lb.advance_paid`). Registers ApprovalHandlers,
// PortalSources (approved periods to pay), DailySweeps (`labour.pay-period-ready`), CashPlanSources (wages to pay, WP-47)
// and ProjectDependents; provides PayPeriodPayments to payables (WP-49).
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import {
    ApprovalHandlers, CashPlanSources, DailySweeps, PayPeriodPayments, PortalSources, ProjectDependents,
} from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { LabourCashPlan } from './application/labour-cash-plan';
import { LabourHandlers, PAY_PERIOD_READY_SWEEP } from './application/labour-handlers';
import { LabourPayPeriodPayments } from './application/labour-payments';
import { LabourEffects, LabourViews, MODULE } from './application/labour.service';
import { LabourRepository } from './application/ports/labour.repository';
import {
    ApprovePayPeriodUseCase, BuildPayPeriodUseCase, CreateWageAdvanceUseCase, GetPayPeriodUseCase, ListPayPeriodsUseCase,
    ListWageAdvancesUseCase, PatchWageAdvanceUseCase, PayPayPeriodUseCase,
} from './application/use-cases/pay-periods.use-cases';
import {
    ApproveTimesheetsUseCase, GetTimesheetDayUseCase, PutTimesheetDayUseCase, TimesheetDayView,
} from './application/use-cases/timesheets.use-cases';
import { DrizzleLabourRepository } from './infrastructure/adapters/drizzle-labour.repository';
import { InMemoryLabourRepository } from './infrastructure/adapters/in-memory-labour.repository';
import { LabourController } from './presentation/labour.controller';

@Global()
@Module({
    controllers: [LabourController],
    providers: [
        persistence(LabourRepository, () => new InMemoryLabourRepository(), ctx => new DrizzleLabourRepository(ctx)),
        LabourViews,
        LabourEffects,
        LabourHandlers,
        LabourCashPlan,
        { provide: PayPeriodPayments, useClass: LabourPayPeriodPayments },
        TimesheetDayView,
        GetTimesheetDayUseCase,
        PutTimesheetDayUseCase,
        ApproveTimesheetsUseCase,
        ListPayPeriodsUseCase,
        GetPayPeriodUseCase,
        BuildPayPeriodUseCase,
        ApprovePayPeriodUseCase,
        PayPayPeriodUseCase,
        ListWageAdvancesUseCase,
        CreateWageAdvanceUseCase,
        PatchWageAdvanceUseCase,
    ],
    exports: [PayPeriodPayments],
})
export class LabourModule implements OnModuleInit {
    constructor(
        private readonly approvals: ApprovalHandlers,
        private readonly portal: PortalSources,
        private readonly sweeps: DailySweeps,
        private readonly dependents: ProjectDependents,
        private readonly repo: LabourRepository,
        private readonly handlers: LabourHandlers,
        private readonly cashPlans: CashPlanSources,
        private readonly cashPlan: LabourCashPlan,
    ) {}

    onModuleInit(): void {
        this.approvals.register('timesheet.approve', { onDecided: e => this.handlers.onTimesheetsDecided(e) });
        this.approvals.register('pay_period.approve', { onDecided: e => this.handlers.onPayPeriodDecided(e) });
        this.portal.register(MODULE, 'labour.pay', ctx => this.handlers.portalReadyToPay(ctx));
        this.sweeps.register(PAY_PERIOD_READY_SWEEP, ctx => this.handlers.payPeriodReady(ctx));
        this.cashPlans.register(MODULE, (ws, projectIds, from, to) => this.cashPlan.plan(ws, projectIds, from, to));
        // Memory adapter: forget a deleted project's timesheets (PostgreSQL drops them with the project).
        this.dependents.register((workspaceId, projectId) => this.repo.deleteByProject(workspaceId, projectId));
    }
}
