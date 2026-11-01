import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
    type ApproveSupplierBillRequest, type CreateBillFromOrderRequest, type CreateBillFromPayPeriodRequest, type CreateBillFromScClaimRequest,
    type CreateSupplierBillRequest, type PatchSupplierBillRequest, type PayablesDueDto, type PayablesDueQuery, type SupplierBillDto,
    type SupplierBillListDto, type SupplierBillListQuery, type VoidSupplierBillRequest, approveSupplierBillRequestSchema,
    createBillFromOrderRequestSchema, createBillFromPayPeriodRequestSchema, createBillFromScClaimRequestSchema, createSupplierBillRequestSchema,
    patchSupplierBillRequestSchema, payablesDueQuerySchema, supplierBillListQuerySchema, voidSupplierBillRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    ApproveSupplierBillUseCase, CreateBillFromOrderUseCase, CreateBillFromPayPeriodUseCase, CreateBillFromScClaimUseCase,
    CreateSupplierBillUseCase, GetPayablesDueUseCase, GetSupplierBillUseCase, ListSupplierBillsUseCase, PatchSupplierBillUseCase,
    VoidSupplierBillUseCase,
} from '../application/use-cases/bills.use-cases';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

@Controller()
@RequiresModule('payables')
export class PayablesController {
    constructor(
        private readonly listBills: ListSupplierBillsUseCase,
        private readonly getBill: GetSupplierBillUseCase,
        private readonly due: GetPayablesDueUseCase,
        private readonly createBill: CreateSupplierBillUseCase,
        private readonly fromOrder: CreateBillFromOrderUseCase,
        private readonly fromScClaim: CreateBillFromScClaimUseCase,
        private readonly fromPayPeriod: CreateBillFromPayPeriodUseCase,
        private readonly patchBill: PatchSupplierBillUseCase,
        private readonly approveBill: ApproveSupplierBillUseCase,
        private readonly voidBill: VoidSupplierBillUseCase,
    ) {}

    @Get('workspaces/:workspaceId/supplier-bills')
    async list(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(supplierBillListQuerySchema)) query: SupplierBillListQuery,
    ): Promise<SupplierBillListDto> {
        return unwrap(await this.listBills.execute(user.userId, workspaceIdParam(workspaceId), query));
    }

    @Post('workspaces/:workspaceId/supplier-bills')
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createSupplierBillRequestSchema)) body: CreateSupplierBillRequest,
    ): Promise<SupplierBillDto> {
        return unwrap(await this.createBill.execute(user.userId, workspaceIdParam(workspaceId), body));
    }

    @Post('workspaces/:workspaceId/supplier-bills/from-sc-claim')
    async createFromScClaim(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createBillFromScClaimRequestSchema)) body: CreateBillFromScClaimRequest,
    ): Promise<SupplierBillDto> {
        return unwrap(await this.fromScClaim.execute(user.userId, workspaceIdParam(workspaceId), body));
    }

    @Post('workspaces/:workspaceId/supplier-bills/from-pay-period')
    async createFromPayPeriod(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createBillFromPayPeriodRequestSchema)) body: CreateBillFromPayPeriodRequest,
    ): Promise<SupplierBillDto> {
        return unwrap(await this.fromPayPeriod.execute(user.userId, workspaceIdParam(workspaceId), body));
    }

    @Get('workspaces/:workspaceId/payables/due')
    async getDue(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(payablesDueQuerySchema)) query: PayablesDueQuery,
    ): Promise<PayablesDueDto> {
        return unwrap(await this.due.execute(user.userId, workspaceIdParam(workspaceId), query));
    }

    @Post('purchase-orders/:orderId/bill')
    async createFromOrder(
        @CurrentUser() user: AuthenticatedUser,
        @Param('orderId') orderId: string,
        @Body(new ZodPipe(createBillFromOrderRequestSchema)) body: CreateBillFromOrderRequest,
    ): Promise<SupplierBillDto> {
        return unwrap(await this.fromOrder.execute(user.userId, orderId, body));
    }

    @Get('supplier-bills/:billId')
    async get(@CurrentUser() user: AuthenticatedUser, @Param('billId') billId: string): Promise<SupplierBillDto> {
        return unwrap(await this.getBill.execute(user.userId, billId));
    }

    @Patch('supplier-bills/:billId')
    async patch(
        @CurrentUser() user: AuthenticatedUser,
        @Param('billId') billId: string,
        @Body(new ZodPipe(patchSupplierBillRequestSchema)) body: PatchSupplierBillRequest,
    ): Promise<SupplierBillDto> {
        return unwrap(await this.patchBill.execute(user.userId, billId, body));
    }

    @Post('supplier-bills/:billId/approve')
    @HttpCode(200)
    async approve(
        @CurrentUser() user: AuthenticatedUser,
        @Param('billId') billId: string,
        @Body(new ZodPipe(approveSupplierBillRequestSchema)) body: ApproveSupplierBillRequest,
    ): Promise<SupplierBillDto> {
        return unwrap(await this.approveBill.execute(user.userId, billId, body));
    }

    @Post('supplier-bills/:billId/void')
    @HttpCode(200)
    async void(
        @CurrentUser() user: AuthenticatedUser,
        @Param('billId') billId: string,
        @Body(new ZodPipe(voidSupplierBillRequestSchema)) body: VoidSupplierBillRequest,
    ): Promise<SupplierBillDto> {
        return unwrap(await this.voidBill.execute(user.userId, billId, body));
    }
}
