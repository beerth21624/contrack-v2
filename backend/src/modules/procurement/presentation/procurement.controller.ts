import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import {
    type AwardRfqRequest, type CreatePurchaseRequestRequest, type CreateRfqRequest, type PatchPurchaseRequestRequest, type PatchRfqRequest,
    type PurchaseRequestDto, type PurchaseRequestSummaryDto, type PutRfqQuoteRequest, type PutRfqSuppliersRequest, type RfqAwardDto,
    type RfqCompareDto, type RfqDto, type RfqSummaryDto, type SubmitPurchaseRequestRequest, awardRfqRequestSchema,
    createPurchaseRequestRequestSchema, createRfqRequestSchema, patchPurchaseRequestRequestSchema, patchRfqRequestSchema,
    putRfqQuoteRequestSchema, putRfqSuppliersRequestSchema, submitPurchaseRequestRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    CancelPurchaseRequestUseCase, CreatePurchaseRequestUseCase, GetPurchaseRequestUseCase, ListPurchaseRequestsUseCase,
    PatchPurchaseRequestUseCase, SubmitPurchaseRequestUseCase,
} from '../application/use-cases/purchase-requests.use-cases';
import {
    AwardRfqUseCase, CancelRfqUseCase, CompareRfqUseCase, CreateRfqUseCase, GetRfqUseCase, ListRfqsUseCase, PatchRfqUseCase,
    PutRfqQuoteUseCase, PutRfqSuppliersUseCase, SendRfqUseCase,
} from '../application/use-cases/rfqs.use-cases';

const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));

@Controller()
@RequiresModule('procurement')
export class ProcurementController {
    constructor(
        private readonly listRequests: ListPurchaseRequestsUseCase,
        private readonly getRequest: GetPurchaseRequestUseCase,
        private readonly createRequest: CreatePurchaseRequestUseCase,
        private readonly patchRequest: PatchPurchaseRequestUseCase,
        private readonly submitRequest: SubmitPurchaseRequestUseCase,
        private readonly cancelRequest: CancelPurchaseRequestUseCase,
        private readonly listRfqs: ListRfqsUseCase,
        private readonly getRfq: GetRfqUseCase,
        private readonly compareRfq: CompareRfqUseCase,
        private readonly createRfq: CreateRfqUseCase,
        private readonly patchRfq: PatchRfqUseCase,
        private readonly putSuppliers: PutRfqSuppliersUseCase,
        private readonly sendRfq: SendRfqUseCase,
        private readonly cancelRfq: CancelRfqUseCase,
        private readonly putQuote: PutRfqQuoteUseCase,
        private readonly awardRfq: AwardRfqUseCase,
    ) {}

    // ── purchase requests ──

    @Get('projects/:projectId/purchase-requests')
    async listPurchaseRequests(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<PurchaseRequestSummaryDto[]> {
        return unwrap(await this.listRequests.execute(user.userId, projectIdParam(projectId)));
    }

    @Post('projects/:projectId/purchase-requests')
    async createPurchaseRequest(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(createPurchaseRequestRequestSchema)) body: CreatePurchaseRequestRequest,
    ): Promise<PurchaseRequestDto> {
        return unwrap(await this.createRequest.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    @Get('purchase-requests/:requestId')
    async getPurchaseRequest(@CurrentUser() user: AuthenticatedUser, @Param('requestId') requestId: string): Promise<PurchaseRequestDto> {
        return unwrap(await this.getRequest.execute(user.userId, requestId));
    }

    @Patch('purchase-requests/:requestId')
    async patchPurchaseRequest(
        @CurrentUser() user: AuthenticatedUser,
        @Param('requestId') requestId: string,
        @Body(new ZodPipe(patchPurchaseRequestRequestSchema)) body: PatchPurchaseRequestRequest,
    ): Promise<PurchaseRequestDto> {
        return unwrap(await this.patchRequest.execute({ userId: user.userId, requestId, body }));
    }

    @Post('purchase-requests/:requestId/submit')
    @HttpCode(200)
    async submitPurchaseRequest(
        @CurrentUser() user: AuthenticatedUser,
        @Param('requestId') requestId: string,
        @Body(new ZodPipe(submitPurchaseRequestRequestSchema)) body: SubmitPurchaseRequestRequest,
    ): Promise<PurchaseRequestDto> {
        return unwrap(await this.submitRequest.execute({ userId: user.userId, requestId, body }));
    }

    @Post('purchase-requests/:requestId/cancel')
    @HttpCode(200)
    async cancelPurchaseRequest(@CurrentUser() user: AuthenticatedUser, @Param('requestId') requestId: string): Promise<PurchaseRequestDto> {
        return unwrap(await this.cancelRequest.execute({ userId: user.userId, requestId }));
    }

    // ── RFQs ──

    @Get('projects/:projectId/rfqs')
    async listProjectRfqs(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<RfqSummaryDto[]> {
        return unwrap(await this.listRfqs.execute(user.userId, projectIdParam(projectId)));
    }

    @Post('projects/:projectId/rfqs')
    async createProjectRfq(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(createRfqRequestSchema)) body: CreateRfqRequest,
    ): Promise<RfqDto> {
        return unwrap(await this.createRfq.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    @Get('rfqs/:rfqId')
    async getOneRfq(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string): Promise<RfqDto> {
        return unwrap(await this.getRfq.execute(user.userId, rfqId));
    }

    @Patch('rfqs/:rfqId')
    async patchOneRfq(
        @CurrentUser() user: AuthenticatedUser,
        @Param('rfqId') rfqId: string,
        @Body(new ZodPipe(patchRfqRequestSchema)) body: PatchRfqRequest,
    ): Promise<RfqDto> {
        return unwrap(await this.patchRfq.execute({ userId: user.userId, rfqId, body }));
    }

    @Put('rfqs/:rfqId/suppliers')
    async putRfqSuppliers(
        @CurrentUser() user: AuthenticatedUser,
        @Param('rfqId') rfqId: string,
        @Body(new ZodPipe(putRfqSuppliersRequestSchema)) body: PutRfqSuppliersRequest,
    ): Promise<RfqDto> {
        return unwrap(await this.putSuppliers.execute({ userId: user.userId, rfqId, body }));
    }

    @Post('rfqs/:rfqId/send')
    @HttpCode(200)
    async sendOneRfq(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string): Promise<RfqDto> {
        return unwrap(await this.sendRfq.execute({ userId: user.userId, rfqId }));
    }

    @Post('rfqs/:rfqId/cancel')
    @HttpCode(200)
    async cancelOneRfq(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string): Promise<RfqDto> {
        return unwrap(await this.cancelRfq.execute({ userId: user.userId, rfqId }));
    }

    @Put('rfqs/:rfqId/quotes/:supplierId')
    async putRfqQuote(
        @CurrentUser() user: AuthenticatedUser,
        @Param('rfqId') rfqId: string,
        @Param('supplierId') supplierId: string,
        @Body(new ZodPipe(putRfqQuoteRequestSchema)) body: PutRfqQuoteRequest,
    ): Promise<RfqDto> {
        return unwrap(await this.putQuote.execute({ userId: user.userId, rfqId, supplierId, body }));
    }

    @Get('rfqs/:rfqId/compare')
    async compareOneRfq(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string): Promise<RfqCompareDto> {
        return unwrap(await this.compareRfq.execute(user.userId, rfqId));
    }

    @Post('rfqs/:rfqId/award')
    @HttpCode(200)
    async awardOneRfq(
        @CurrentUser() user: AuthenticatedUser,
        @Param('rfqId') rfqId: string,
        @Body(new ZodPipe(awardRfqRequestSchema)) body: AwardRfqRequest,
    ): Promise<RfqAwardDto> {
        return unwrap(await this.awardRfq.execute({ userId: user.userId, rfqId, body }));
    }
}
