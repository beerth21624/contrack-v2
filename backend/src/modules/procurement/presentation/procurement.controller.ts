import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
    type AwardRfqRequest, type CreatePurchaseRequestRequest, type CreateRfqRequest, type PatchPurchaseRequestRequest, type PatchRfqRequest,
    type PurchaseRequestDto, type PurchaseRequestSummaryDto, type PutRfqQuoteRequest, type PutRfqSuppliersRequest, type RfqAwardDto,
    type RfqCompareDto, type RfqDto, type RfqSummaryDto, type SubmitPurchaseRequestRequest, awardRfqRequestSchema,
    createPurchaseRequestRequestSchema, createRfqRequestSchema, patchPurchaseRequestRequestSchema, patchRfqRequestSchema,
    putRfqQuoteRequestSchema, putRfqSuppliersRequestSchema, submitPurchaseRequestRequestSchema,
} from '@contrack/contract';
import {
    type CreateGoodsReceiptRequest, type CreatePurchaseOrderRequest, type GoodsReceiptDto, type IssuePurchaseOrderRequest,
    type PatchPurchaseOrderRequest, type PurchaseOrderDto, type PurchaseOrderListQuery, type PurchaseOrderSummaryDto,
    type SupplierPriceHistoryItem, type SupplierPriceHistoryQuery, createGoodsReceiptRequestSchema, createPurchaseOrderRequestSchema,
    issuePurchaseOrderRequestSchema, patchPurchaseOrderRequestSchema, purchaseOrderListQuerySchema, supplierPriceHistoryQuerySchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, type WorkspaceId, parseId } from '../../../shared/domain';
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
import {
    CancelGoodsReceiptUseCase, ConfirmGoodsReceiptUseCase, CreateGoodsReceiptUseCase, ListGoodsReceiptsUseCase,
} from '../application/use-cases/goods-receipts.use-cases';
import {
    CancelPurchaseOrderUseCase, ClosePurchaseOrderUseCase, CreatePurchaseOrderUseCase, GetPurchaseOrderUseCase, IssuePurchaseOrderUseCase,
    ListProjectPurchaseOrdersUseCase, ListWorkspacePurchaseOrdersUseCase, PatchPurchaseOrderUseCase, SupplierPriceHistoryUseCase,
} from '../application/use-cases/purchase-orders.use-cases';

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
        private readonly listProjectOrders: ListProjectPurchaseOrdersUseCase,
        private readonly listWorkspaceOrders: ListWorkspacePurchaseOrdersUseCase,
        private readonly getOrder: GetPurchaseOrderUseCase,
        private readonly createOrder: CreatePurchaseOrderUseCase,
        private readonly patchOrder: PatchPurchaseOrderUseCase,
        private readonly issueOrder: IssuePurchaseOrderUseCase,
        private readonly cancelOrder: CancelPurchaseOrderUseCase,
        private readonly closeOrder: ClosePurchaseOrderUseCase,
        private readonly priceHistory: SupplierPriceHistoryUseCase,
        private readonly listReceipts: ListGoodsReceiptsUseCase,
        private readonly createReceipt: CreateGoodsReceiptUseCase,
        private readonly confirmReceipt: ConfirmGoodsReceiptUseCase,
        private readonly cancelReceipt: CancelGoodsReceiptUseCase,
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

    // ── purchase orders ──

    @Get('projects/:projectId/purchase-orders')
    async listProjectPurchaseOrders(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<PurchaseOrderSummaryDto[]> {
        return unwrap(await this.listProjectOrders.execute(user.userId, projectIdParam(projectId)));
    }

    @Post('projects/:projectId/purchase-orders')
    async createPurchaseOrder(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(createPurchaseOrderRequestSchema)) body: CreatePurchaseOrderRequest,
    ): Promise<PurchaseOrderDto> {
        return unwrap(await this.createOrder.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    @Get('workspaces/:workspaceId/purchase-orders')
    async listWorkspacePurchaseOrders(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(purchaseOrderListQuerySchema)) query: PurchaseOrderListQuery,
    ): Promise<PurchaseOrderSummaryDto[]> {
        const id: WorkspaceId = unwrap(parseId<'WorkspaceId'>(workspaceId, 'Workspace'));
        return unwrap(await this.listWorkspaceOrders.execute(user.userId, id, query));
    }

    @Get('purchase-orders/:orderId')
    async getPurchaseOrder(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string): Promise<PurchaseOrderDto> {
        return unwrap(await this.getOrder.execute(user.userId, orderId));
    }

    @Patch('purchase-orders/:orderId')
    async patchPurchaseOrder(
        @CurrentUser() user: AuthenticatedUser,
        @Param('orderId') orderId: string,
        @Body(new ZodPipe(patchPurchaseOrderRequestSchema)) body: PatchPurchaseOrderRequest,
    ): Promise<PurchaseOrderDto> {
        return unwrap(await this.patchOrder.execute({ userId: user.userId, orderId, body }));
    }

    @Post('purchase-orders/:orderId/issue')
    @HttpCode(200)
    async issuePurchaseOrder(
        @CurrentUser() user: AuthenticatedUser,
        @Param('orderId') orderId: string,
        @Body(new ZodPipe(issuePurchaseOrderRequestSchema)) body: IssuePurchaseOrderRequest,
    ): Promise<PurchaseOrderDto> {
        return unwrap(await this.issueOrder.execute({ userId: user.userId, orderId, body }));
    }

    @Post('purchase-orders/:orderId/cancel')
    @HttpCode(200)
    async cancelPurchaseOrder(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string): Promise<PurchaseOrderDto> {
        return unwrap(await this.cancelOrder.execute({ userId: user.userId, orderId }));
    }

    @Post('purchase-orders/:orderId/close')
    @HttpCode(200)
    async closePurchaseOrder(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string): Promise<PurchaseOrderDto> {
        return unwrap(await this.closeOrder.execute({ userId: user.userId, orderId }));
    }

    @Get('suppliers/:supplierId/price-history')
    async supplierPriceHistory(
        @CurrentUser() user: AuthenticatedUser,
        @Param('supplierId') supplierId: string,
        @Query(new ZodPipe(supplierPriceHistoryQuerySchema)) query: SupplierPriceHistoryQuery,
    ): Promise<SupplierPriceHistoryItem[]> {
        return unwrap(await this.priceHistory.execute(user.userId, supplierId, query.q));
    }

    // ── goods receipts ──

    @Get('purchase-orders/:orderId/receipts')
    async listGoodsReceipts(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string): Promise<GoodsReceiptDto[]> {
        return unwrap(await this.listReceipts.execute(user.userId, orderId));
    }

    @Post('purchase-orders/:orderId/receipts')
    async createGoodsReceipt(
        @CurrentUser() user: AuthenticatedUser,
        @Param('orderId') orderId: string,
        @Body(new ZodPipe(createGoodsReceiptRequestSchema)) body: CreateGoodsReceiptRequest,
    ): Promise<GoodsReceiptDto> {
        return unwrap(await this.createReceipt.execute({ userId: user.userId, orderId, body }));
    }

    @Post('goods-receipts/:receiptId/confirm')
    @HttpCode(200)
    async confirmGoodsReceipt(@CurrentUser() user: AuthenticatedUser, @Param('receiptId') receiptId: string): Promise<GoodsReceiptDto> {
        return unwrap(await this.confirmReceipt.execute({ userId: user.userId, receiptId }));
    }

    @Post('goods-receipts/:receiptId/cancel')
    @HttpCode(200)
    async cancelGoodsReceipt(@CurrentUser() user: AuthenticatedUser, @Param('receiptId') receiptId: string): Promise<GoodsReceiptDto> {
        return unwrap(await this.cancelReceipt.execute({ userId: user.userId, receiptId }));
    }
}
