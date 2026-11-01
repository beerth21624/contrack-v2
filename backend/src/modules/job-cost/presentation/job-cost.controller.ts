import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import {
    type CostLedgerDto, type CostLedgerQuery, type JobCostAlertDto, type JobCostAlertListQuery, type JobCostReportDto,
    type PutJobCostForecastRequest, costLedgerQuerySchema, jobCostAlertListQuerySchema, putJobCostForecastRequestSchema, uuidSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    GetJobCostLedgerUseCase, GetJobCostReportUseCase, ListJobCostAlertsUseCase, PutJobCostForecastUseCase,
} from '../application/use-cases/job-cost.use-cases';

const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));
const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

@Controller()
@RequiresModule('job-cost')
export class JobCostController {
    constructor(
        private readonly report: GetJobCostReportUseCase,
        private readonly ledger: GetJobCostLedgerUseCase,
        private readonly forecast: PutJobCostForecastUseCase,
        private readonly alerts: ListJobCostAlertsUseCase,
    ) {}

    @Get('projects/:projectId/job-cost')
    async getReport(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<JobCostReportDto> {
        return unwrap(await this.report.execute(user.userId, projectIdParam(projectId)));
    }

    @Get('projects/:projectId/job-cost/ledger')
    async getLedger(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Query(new ZodPipe(costLedgerQuerySchema)) query: CostLedgerQuery,
    ): Promise<CostLedgerDto> {
        return unwrap(await this.ledger.execute(user.userId, projectIdParam(projectId), query));
    }

    @Put('projects/:projectId/job-cost/forecasts/:costCodeId')
    async putForecast(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Param('costCodeId', new ZodPipe(uuidSchema)) costCodeId: string,
        @Body(new ZodPipe(putJobCostForecastRequestSchema)) body: PutJobCostForecastRequest,
    ): Promise<JobCostReportDto> {
        return unwrap(await this.forecast.execute(user.userId, projectIdParam(projectId), costCodeId, body));
    }

    @Get('workspaces/:workspaceId/job-cost/alerts')
    async listAlerts(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(jobCostAlertListQuerySchema)) query: JobCostAlertListQuery,
    ): Promise<JobCostAlertDto[]> {
        return unwrap(await this.alerts.execute(user.userId, workspaceIdParam(workspaceId), query));
    }
}
