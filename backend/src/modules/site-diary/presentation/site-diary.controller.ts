import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
    type PatchSiteIssueRequest, type PutSiteReportRequest, type SiteIssueDto, type SiteIssueListDto, type SiteIssueListQuery,
    type SiteProgressDto, type SiteReportDto, type SiteReportListDto, type SiteReportListQuery, businessDateSchema,
    patchSiteIssueRequestSchema, putSiteReportRequestSchema, siteIssueListQuerySchema, siteReportListQuerySchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    GetSiteProgressUseCase, GetSiteReportUseCase, ListSiteIssuesUseCase, ListSiteReportsUseCase, PatchSiteIssueUseCase,
    PutSiteReportUseCase, ReopenSiteReportUseCase, SubmitSiteReportUseCase,
} from '../application/use-cases/site-diary.use-cases';

const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));
const dateParam = new ZodPipe(businessDateSchema);

@Controller()
@RequiresModule('site-diary')
export class SiteDiaryController {
    constructor(
        private readonly list: ListSiteReportsUseCase,
        private readonly getOne: GetSiteReportUseCase,
        private readonly progress: GetSiteProgressUseCase,
        private readonly put: PutSiteReportUseCase,
        private readonly submit: SubmitSiteReportUseCase,
        private readonly reopen: ReopenSiteReportUseCase,
        private readonly issues: ListSiteIssuesUseCase,
        private readonly patchIssue: PatchSiteIssueUseCase,
    ) {}

    @Get('projects/:projectId/site-diary')
    async listReports(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Query(new ZodPipe(siteReportListQuerySchema)) query: SiteReportListQuery,
    ): Promise<SiteReportListDto> {
        return unwrap(await this.list.execute(user.userId, projectIdParam(projectId), query));
    }

    // Before `:date` so "progress" is not read as a date.
    @Get('projects/:projectId/site-diary/progress')
    async getProgress(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<SiteProgressDto> {
        return unwrap(await this.progress.execute(user.userId, projectIdParam(projectId)));
    }

    @Get('projects/:projectId/site-diary/:date')
    async getReport(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Param('date', dateParam) date: string,
    ): Promise<SiteReportDto> {
        return unwrap(await this.getOne.execute(user.userId, projectIdParam(projectId), date));
    }

    @Put('projects/:projectId/site-diary/:date')
    async putReport(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Param('date', dateParam) date: string,
        @Body(new ZodPipe(putSiteReportRequestSchema)) body: PutSiteReportRequest,
    ): Promise<SiteReportDto> {
        return unwrap(await this.put.execute({ userId: user.userId, projectId: projectIdParam(projectId), reportDate: date, body }));
    }

    @Post('projects/:projectId/site-diary/:date/submit')
    @HttpCode(200)
    async submitReport(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Param('date', dateParam) date: string,
    ): Promise<SiteReportDto> {
        return unwrap(await this.submit.execute({ userId: user.userId, projectId: projectIdParam(projectId), reportDate: date }));
    }

    @Post('projects/:projectId/site-diary/:date/reopen')
    @HttpCode(200)
    async reopenReport(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Param('date', dateParam) date: string,
    ): Promise<SiteReportDto> {
        return unwrap(await this.reopen.execute({ userId: user.userId, projectId: projectIdParam(projectId), reportDate: date }));
    }

    @Get('projects/:projectId/site-issues')
    async listIssues(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Query(new ZodPipe(siteIssueListQuerySchema)) query: SiteIssueListQuery,
    ): Promise<SiteIssueListDto> {
        return unwrap(await this.issues.execute(user.userId, projectIdParam(projectId), query));
    }

    @Patch('site-issues/:issueId')
    async patchSiteIssue(
        @CurrentUser() user: AuthenticatedUser,
        @Param('issueId') issueId: string,
        @Body(new ZodPipe(patchSiteIssueRequestSchema)) body: PatchSiteIssueRequest,
    ): Promise<SiteIssueDto> {
        return unwrap(await this.patchIssue.execute({ userId: user.userId, issueId, body }));
    }
}
