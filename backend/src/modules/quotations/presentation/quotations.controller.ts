import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
    type CreateQuotationRequest, type IssueQuotationVersionRequest, type NewQuotationVersionRequest, type PatchQuotationVersionRequest,
    type QuotationCompareDto, type QuotationCompareQuery, type QuotationDto, type QuotationVersionDto, type RecordQuotationResponseRequest,
    createQuotationRequestSchema, issueQuotationVersionRequestSchema, newQuotationVersionRequestSchema, patchQuotationVersionRequestSchema,
    quotationCompareQuerySchema, recordQuotationResponseRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    CancelQuotationVersionUseCase, CompareQuotationVersionsUseCase, CreateQuotationUseCase, GetQuotationUseCase, GetQuotationVersionUseCase,
    IssueQuotationVersionUseCase, ListQuotationsUseCase, NewQuotationVersionUseCase, PatchQuotationVersionUseCase,
    RecordQuotationResponseUseCase,
} from '../application/use-cases/quotations.use-cases';

const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));

@Controller()
@RequiresModule('quotations')
export class QuotationsController {
    constructor(
        private readonly list: ListQuotationsUseCase,
        private readonly create: CreateQuotationUseCase,
        private readonly get: GetQuotationUseCase,
        private readonly getVersion: GetQuotationVersionUseCase,
        private readonly patch: PatchQuotationVersionUseCase,
        private readonly newVersion: NewQuotationVersionUseCase,
        private readonly issue: IssueQuotationVersionUseCase,
        private readonly cancel: CancelQuotationVersionUseCase,
        private readonly recordResponse: RecordQuotationResponseUseCase,
        private readonly compare: CompareQuotationVersionsUseCase,
    ) {}

    @Get('projects/:projectId/quotations')
    async listQuotations(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<QuotationDto[]> {
        return unwrap(await this.list.execute(user.userId, projectIdParam(projectId)));
    }

    @Post('projects/:projectId/quotations')
    async createQuotation(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(createQuotationRequestSchema)) body: CreateQuotationRequest,
    ): Promise<QuotationVersionDto> {
        return unwrap(await this.create.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    @Get('quotations/:quotationId')
    async getQuotation(@CurrentUser() user: AuthenticatedUser, @Param('quotationId') quotationId: string): Promise<QuotationDto> {
        return unwrap(await this.get.execute(user.userId, quotationId));
    }

    @Get('quotations/:quotationId/compare')
    async compareVersions(
        @CurrentUser() user: AuthenticatedUser,
        @Param('quotationId') quotationId: string,
        @Query(new ZodPipe(quotationCompareQuerySchema)) query: QuotationCompareQuery,
    ): Promise<QuotationCompareDto> {
        return unwrap(await this.compare.execute(user.userId, quotationId, query));
    }

    @Post('quotations/:quotationId/versions')
    async createVersion(
        @CurrentUser() user: AuthenticatedUser,
        @Param('quotationId') quotationId: string,
        @Body(new ZodPipe(newQuotationVersionRequestSchema)) body: NewQuotationVersionRequest,
    ): Promise<QuotationVersionDto> {
        return unwrap(await this.newVersion.execute({ userId: user.userId, quotationId, body }));
    }

    @Get('quotation-versions/:versionId')
    async getQuotationVersion(@CurrentUser() user: AuthenticatedUser, @Param('versionId') versionId: string): Promise<QuotationVersionDto> {
        return unwrap(await this.getVersion.execute(user.userId, versionId));
    }

    @Patch('quotation-versions/:versionId')
    async patchQuotationVersion(
        @CurrentUser() user: AuthenticatedUser,
        @Param('versionId') versionId: string,
        @Body(new ZodPipe(patchQuotationVersionRequestSchema)) body: PatchQuotationVersionRequest,
    ): Promise<QuotationVersionDto> {
        return unwrap(await this.patch.execute({ userId: user.userId, versionId, body }));
    }

    @Post('quotation-versions/:versionId/issue')
    @HttpCode(200)
    async issueVersion(
        @CurrentUser() user: AuthenticatedUser,
        @Param('versionId') versionId: string,
        @Body(new ZodPipe(issueQuotationVersionRequestSchema)) body: IssueQuotationVersionRequest,
    ): Promise<QuotationVersionDto> {
        return unwrap(await this.issue.execute({ userId: user.userId, versionId, body }));
    }

    @Post('quotation-versions/:versionId/cancel')
    @HttpCode(200)
    async cancelVersion(@CurrentUser() user: AuthenticatedUser, @Param('versionId') versionId: string): Promise<QuotationVersionDto> {
        return unwrap(await this.cancel.execute({ userId: user.userId, versionId }));
    }

    @Post('quotation-versions/:versionId/record-response')
    @HttpCode(200)
    async recordVersionResponse(
        @CurrentUser() user: AuthenticatedUser,
        @Param('versionId') versionId: string,
        @Body(new ZodPipe(recordQuotationResponseRequestSchema)) body: RecordQuotationResponseRequest,
    ): Promise<QuotationVersionDto> {
        return unwrap(await this.recordResponse.execute({ userId: user.userId, versionId, body }));
    }
}
