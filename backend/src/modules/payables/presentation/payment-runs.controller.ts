import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
    type ApPaymentDto, type CancelPaymentRunRequest, type CreatePaymentRunRequest, type PatchPaymentRunRequest, type PaymentRunDto,
    type PaymentRunListDto, type PaymentRunListQuery, type PayPaymentRunRequest, type WhtCertificateDto, cancelPaymentRunRequestSchema,
    createPaymentRunRequestSchema, patchPaymentRunRequestSchema, paymentRunListQuerySchema, payPaymentRunRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    ApprovePaymentRunUseCase, CancelPaymentRunUseCase, CreatePaymentRunUseCase, GetPaymentRunUseCase, GetPaymentUseCase,
    GetWhtCertificateUseCase, ListPaymentRunsUseCase, PatchPaymentRunUseCase, PayPaymentRunUseCase,
} from '../application/use-cases/payment-runs.use-cases';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

/** Payment runs, payment vouchers and WHT certificates (WP-50). */
@Controller()
@RequiresModule('payables')
export class PaymentRunsController {
    constructor(
        private readonly listRuns: ListPaymentRunsUseCase,
        private readonly getRun: GetPaymentRunUseCase,
        private readonly createRun: CreatePaymentRunUseCase,
        private readonly patchRun: PatchPaymentRunUseCase,
        private readonly approveRun: ApprovePaymentRunUseCase,
        private readonly payRun: PayPaymentRunUseCase,
        private readonly cancelRun: CancelPaymentRunUseCase,
        private readonly getPayment: GetPaymentUseCase,
        private readonly getCertificate: GetWhtCertificateUseCase,
    ) {}

    @Get('workspaces/:workspaceId/payment-runs')
    async list(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(paymentRunListQuerySchema)) query: PaymentRunListQuery,
    ): Promise<PaymentRunListDto> {
        return unwrap(await this.listRuns.execute(user.userId, workspaceIdParam(workspaceId), query));
    }

    @Post('workspaces/:workspaceId/payment-runs')
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createPaymentRunRequestSchema)) body: CreatePaymentRunRequest,
    ): Promise<PaymentRunDto> {
        return unwrap(await this.createRun.execute(user.userId, workspaceIdParam(workspaceId), body));
    }

    @Get('payment-runs/:runId')
    async get(@CurrentUser() user: AuthenticatedUser, @Param('runId') runId: string): Promise<PaymentRunDto> {
        return unwrap(await this.getRun.execute(user.userId, runId));
    }

    @Patch('payment-runs/:runId')
    async patch(
        @CurrentUser() user: AuthenticatedUser,
        @Param('runId') runId: string,
        @Body(new ZodPipe(patchPaymentRunRequestSchema)) body: PatchPaymentRunRequest,
    ): Promise<PaymentRunDto> {
        return unwrap(await this.patchRun.execute(user.userId, runId, body));
    }

    @Post('payment-runs/:runId/approve')
    @HttpCode(200)
    async approve(@CurrentUser() user: AuthenticatedUser, @Param('runId') runId: string): Promise<PaymentRunDto> {
        return unwrap(await this.approveRun.execute(user.userId, runId));
    }

    @Post('payment-runs/:runId/pay')
    @HttpCode(200)
    async pay(
        @CurrentUser() user: AuthenticatedUser,
        @Param('runId') runId: string,
        @Body(new ZodPipe(payPaymentRunRequestSchema)) body: PayPaymentRunRequest,
    ): Promise<PaymentRunDto> {
        return unwrap(await this.payRun.execute(user.userId, runId, body));
    }

    @Post('payment-runs/:runId/cancel')
    @HttpCode(200)
    async cancel(
        @CurrentUser() user: AuthenticatedUser,
        @Param('runId') runId: string,
        @Body(new ZodPipe(cancelPaymentRunRequestSchema)) body: CancelPaymentRunRequest,
    ): Promise<PaymentRunDto> {
        return unwrap(await this.cancelRun.execute(user.userId, runId, body));
    }

    @Get('payments/:paymentId')
    async payment(@CurrentUser() user: AuthenticatedUser, @Param('paymentId') paymentId: string): Promise<ApPaymentDto> {
        return unwrap(await this.getPayment.execute(user.userId, paymentId));
    }

    @Get('wht-certificates/:certificateId')
    async certificate(@CurrentUser() user: AuthenticatedUser, @Param('certificateId') certificateId: string): Promise<WhtCertificateDto> {
        return unwrap(await this.getCertificate.execute(user.userId, certificateId));
    }
}
