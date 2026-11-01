import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
    type ApproveTimesheetsRequest, type ApproveTimesheetsResultDto, type CreateWageAdvanceRequest, type PatchWageAdvanceRequest,
    type PayPayPeriodRequest, type PayPeriodDto, type PayPeriodListDto, type PayPeriodListQuery, type PutTimesheetDayRequest,
    type TimesheetDayDto, type WageAdvanceDto, type WageAdvanceListDto, type WageAdvanceListQuery, approveTimesheetsRequestSchema,
    businessDateSchema, createWageAdvanceRequestSchema, patchWageAdvanceRequestSchema, payPayPeriodRequestSchema, payPeriodListQuerySchema,
    putTimesheetDayRequestSchema, wageAdvanceListQuerySchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    ApprovePayPeriodUseCase, BuildPayPeriodUseCase, CreateWageAdvanceUseCase, GetPayPeriodUseCase, ListPayPeriodsUseCase,
    ListWageAdvancesUseCase, PatchWageAdvanceUseCase, PayPayPeriodUseCase,
} from '../application/use-cases/pay-periods.use-cases';
import { ApproveTimesheetsUseCase, GetTimesheetDayUseCase, PutTimesheetDayUseCase } from '../application/use-cases/timesheets.use-cases';

const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));
const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));
const dateParam = new ZodPipe(businessDateSchema);

@Controller()
@RequiresModule('labour')
export class LabourController {
    constructor(
        private readonly getDay: GetTimesheetDayUseCase,
        private readonly putDay: PutTimesheetDayUseCase,
        private readonly approveDays: ApproveTimesheetsUseCase,
        private readonly listPeriods: ListPayPeriodsUseCase,
        private readonly getPeriod: GetPayPeriodUseCase,
        private readonly buildPeriod: BuildPayPeriodUseCase,
        private readonly approvePeriod: ApprovePayPeriodUseCase,
        private readonly payPeriod: PayPayPeriodUseCase,
        private readonly listAdvances: ListWageAdvancesUseCase,
        private readonly createAdvance: CreateWageAdvanceUseCase,
        private readonly patchAdvance: PatchWageAdvanceUseCase,
    ) {}

    // Before `:date` so "approve" is not read as a date (POST only, but keep the order explicit).
    @Post('projects/:projectId/timesheets/approve')
    @HttpCode(200)
    async approveTimesheets(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(approveTimesheetsRequestSchema)) body: ApproveTimesheetsRequest,
    ): Promise<ApproveTimesheetsResultDto> {
        return unwrap(await this.approveDays.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    @Get('projects/:projectId/timesheets/:date')
    async getTimesheetDay(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Param('date', dateParam) date: string,
    ): Promise<TimesheetDayDto> {
        return unwrap(await this.getDay.execute(user.userId, projectIdParam(projectId), date));
    }

    @Put('projects/:projectId/timesheets/:date')
    async putTimesheetDay(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Param('date', dateParam) date: string,
        @Body(new ZodPipe(putTimesheetDayRequestSchema)) body: PutTimesheetDayRequest,
    ): Promise<TimesheetDayDto> {
        return unwrap(await this.putDay.execute({ userId: user.userId, projectId: projectIdParam(projectId), workDate: date, body }));
    }

    @Get('workspaces/:workspaceId/pay-periods')
    async listPayPeriods(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(payPeriodListQuerySchema)) query: PayPeriodListQuery,
    ): Promise<PayPeriodListDto> {
        return unwrap(await this.listPeriods.execute(user.userId, workspaceIdParam(workspaceId), query));
    }

    @Post('workspaces/:workspaceId/pay-periods/:periodKey/build')
    @HttpCode(200)
    async buildPayPeriod(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('periodKey') periodKey: string,
    ): Promise<PayPeriodDto> {
        return unwrap(await this.buildPeriod.execute(user.userId, workspaceIdParam(workspaceId), periodKey));
    }

    @Post('workspaces/:workspaceId/pay-periods/:periodKey/approve')
    @HttpCode(200)
    async approvePayPeriod(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('periodKey') periodKey: string,
    ): Promise<PayPeriodDto> {
        return unwrap(await this.approvePeriod.execute(user.userId, workspaceIdParam(workspaceId), periodKey));
    }

    @Post('workspaces/:workspaceId/pay-periods/:periodKey/pay')
    @HttpCode(200)
    async payPayPeriod(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('periodKey') periodKey: string,
        @Body(new ZodPipe(payPayPeriodRequestSchema)) body: PayPayPeriodRequest,
    ): Promise<PayPeriodDto> {
        return unwrap(await this.payPeriod.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId), periodKey, body }));
    }

    @Get('pay-periods/:periodId')
    async getPayPeriod(@CurrentUser() user: AuthenticatedUser, @Param('periodId') periodId: string): Promise<PayPeriodDto> {
        return unwrap(await this.getPeriod.execute(user.userId, periodId));
    }

    @Get('workspaces/:workspaceId/wage-advances')
    async listWageAdvances(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(wageAdvanceListQuerySchema)) query: WageAdvanceListQuery,
    ): Promise<WageAdvanceListDto> {
        return unwrap(await this.listAdvances.execute(user.userId, workspaceIdParam(workspaceId), query));
    }

    @Post('workspaces/:workspaceId/wage-advances')
    async createWageAdvance(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createWageAdvanceRequestSchema)) body: CreateWageAdvanceRequest,
    ): Promise<WageAdvanceDto> {
        return unwrap(await this.createAdvance.execute(user.userId, workspaceIdParam(workspaceId), body));
    }

    @Patch('wage-advances/:advanceId')
    async patchWageAdvance(
        @CurrentUser() user: AuthenticatedUser,
        @Param('advanceId') advanceId: string,
        @Body(new ZodPipe(patchWageAdvanceRequestSchema)) body: PatchWageAdvanceRequest,
    ): Promise<WageAdvanceDto> {
        return unwrap(await this.patchAdvance.execute(user.userId, advanceId, body));
    }
}
