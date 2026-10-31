import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
    type CertifyArClaimRequest, type ArClaimDto, type ArClaimSummaryDto, type ContractAdvanceDto, type ContractRetentionDto,
    type CreateAdvanceInvoiceRequest, type CreateArClaimRequest, type CreateRetentionReleaseInvoiceRequest, type InvoiceArClaimRequest,
    type InvoiceDto, type IssueInvoiceRequest, type PatchArClaimRequest, type VoidInvoiceRequest, certifyArClaimRequestSchema,
    createAdvanceInvoiceRequestSchema, createArClaimRequestSchema, createRetentionReleaseInvoiceRequestSchema, invoiceArClaimRequestSchema,
    issueInvoiceRequestSchema, patchArClaimRequestSchema, voidInvoiceRequestSchema,
    type ArAgingDto, type CreateCreditNoteRequest, type CreateReceiptRequest, type CustomerStatementDto, type CustomerStatementQuery,
    type InvoicePromptPayDto, type IssueTaxInvoiceRequest, type ReceiptDto, type VoidReceiptRequest, createCreditNoteRequestSchema,
    createReceiptRequestSchema, customerStatementQuerySchema, issueTaxInvoiceRequestSchema, voidReceiptRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    CancelClaimUseCase, CertifyClaimUseCase, CreateClaimUseCase, GetClaimUseCase, InvoiceClaimUseCase, ListClaimsUseCase, PatchClaimUseCase,
    SubmitClaimUseCase,
} from '../application/use-cases/claims.use-cases';
import {
    CreateAdvanceInvoiceUseCase, CreateRetentionReleaseInvoiceUseCase, GetContractAdvanceUseCase, GetContractRetentionUseCase,
    GetInvoiceUseCase, IssueInvoiceUseCase, ListProjectInvoicesUseCase, VoidInvoiceUseCase,
} from '../application/use-cases/invoices.use-cases';
import {
    CreateCreditNoteUseCase, CustomerStatementUseCase, GetReceiptUseCase, InvoicePromptPayUseCase, IssueTaxInvoiceUseCase, ReceivablesAgingUseCase,
    RecordReceiptUseCase, VoidReceiptUseCase,
} from '../application/use-cases/receipts.use-cases';

const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));
const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

@Controller()
@RequiresModule('billing')
export class BillingController {
    constructor(
        private readonly listClaims: ListClaimsUseCase,
        private readonly getClaim: GetClaimUseCase,
        private readonly createClaim: CreateClaimUseCase,
        private readonly patchClaim: PatchClaimUseCase,
        private readonly submitClaim: SubmitClaimUseCase,
        private readonly certifyClaim: CertifyClaimUseCase,
        private readonly invoiceClaim: InvoiceClaimUseCase,
        private readonly cancelClaim: CancelClaimUseCase,
        private readonly listInvoices: ListProjectInvoicesUseCase,
        private readonly getInvoice: GetInvoiceUseCase,
        private readonly advanceInvoice: CreateAdvanceInvoiceUseCase,
        private readonly retentionInvoice: CreateRetentionReleaseInvoiceUseCase,
        private readonly issueInvoice: IssueInvoiceUseCase,
        private readonly voidInvoice: VoidInvoiceUseCase,
        private readonly retention: GetContractRetentionUseCase,
        private readonly advance: GetContractAdvanceUseCase,
        private readonly recordReceipt: RecordReceiptUseCase,
        private readonly getReceipt: GetReceiptUseCase,
        private readonly voidReceipt: VoidReceiptUseCase,
        private readonly taxInvoice: IssueTaxInvoiceUseCase,
        private readonly creditNote: CreateCreditNoteUseCase,
        private readonly aging: ReceivablesAgingUseCase,
        private readonly statement: CustomerStatementUseCase,
        private readonly promptPay: InvoicePromptPayUseCase,
    ) {}

    // ── claims ──

    @Get('main-contracts/:contractId/claims')
    async claims(@CurrentUser() user: AuthenticatedUser, @Param('contractId') contractId: string): Promise<ArClaimSummaryDto[]> {
        return unwrap(await this.listClaims.execute(user.userId, contractId));
    }

    @Post('main-contracts/:contractId/claims')
    async addClaim(
        @CurrentUser() user: AuthenticatedUser,
        @Param('contractId') contractId: string,
        @Body(new ZodPipe(createArClaimRequestSchema)) body: CreateArClaimRequest,
    ): Promise<ArClaimDto> {
        return unwrap(await this.createClaim.execute({ userId: user.userId, contractId, body }));
    }

    @Get('claims/:claimId')
    async claim(@CurrentUser() user: AuthenticatedUser, @Param('claimId') claimId: string): Promise<ArClaimDto> {
        return unwrap(await this.getClaim.execute(user.userId, claimId));
    }

    @Patch('claims/:claimId')
    async updateClaim(
        @CurrentUser() user: AuthenticatedUser,
        @Param('claimId') claimId: string,
        @Body(new ZodPipe(patchArClaimRequestSchema)) body: PatchArClaimRequest,
    ): Promise<ArClaimDto> {
        return unwrap(await this.patchClaim.execute({ userId: user.userId, claimId, body }));
    }

    @Post('claims/:claimId/submit')
    @HttpCode(200)
    async submit(@CurrentUser() user: AuthenticatedUser, @Param('claimId') claimId: string): Promise<ArClaimDto> {
        return unwrap(await this.submitClaim.execute({ userId: user.userId, claimId }));
    }

    @Post('claims/:claimId/certify')
    @HttpCode(200)
    async certify(
        @CurrentUser() user: AuthenticatedUser,
        @Param('claimId') claimId: string,
        @Body(new ZodPipe(certifyArClaimRequestSchema)) body: CertifyArClaimRequest,
    ): Promise<ArClaimDto> {
        return unwrap(await this.certifyClaim.execute({ userId: user.userId, claimId, body }));
    }

    @Post('claims/:claimId/invoice')
    @HttpCode(200)
    async invoice(
        @CurrentUser() user: AuthenticatedUser,
        @Param('claimId') claimId: string,
        @Body(new ZodPipe(invoiceArClaimRequestSchema)) body: InvoiceArClaimRequest,
    ): Promise<InvoiceDto> {
        return unwrap(await this.invoiceClaim.execute({ userId: user.userId, claimId, body }));
    }

    @Post('claims/:claimId/cancel')
    @HttpCode(200)
    async cancel(@CurrentUser() user: AuthenticatedUser, @Param('claimId') claimId: string): Promise<ArClaimDto> {
        return unwrap(await this.cancelClaim.execute({ userId: user.userId, claimId }));
    }

    // ── invoices ──

    @Get('projects/:projectId/invoices')
    async invoices(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<InvoiceDto[]> {
        return unwrap(await this.listInvoices.execute(user.userId, projectIdParam(projectId)));
    }

    @Get('invoices/:invoiceId')
    async getOne(@CurrentUser() user: AuthenticatedUser, @Param('invoiceId') invoiceId: string): Promise<InvoiceDto> {
        return unwrap(await this.getInvoice.execute(user.userId, invoiceId));
    }

    @Post('main-contracts/:contractId/advance-invoice')
    async addAdvanceInvoice(
        @CurrentUser() user: AuthenticatedUser,
        @Param('contractId') contractId: string,
        @Body(new ZodPipe(createAdvanceInvoiceRequestSchema)) body: CreateAdvanceInvoiceRequest,
    ): Promise<InvoiceDto> {
        return unwrap(await this.advanceInvoice.execute({ userId: user.userId, contractId, body }));
    }

    @Post('main-contracts/:contractId/retention-release-invoice')
    async addRetentionReleaseInvoice(
        @CurrentUser() user: AuthenticatedUser,
        @Param('contractId') contractId: string,
        @Body(new ZodPipe(createRetentionReleaseInvoiceRequestSchema)) body: CreateRetentionReleaseInvoiceRequest,
    ): Promise<InvoiceDto> {
        return unwrap(await this.retentionInvoice.execute({ userId: user.userId, contractId, body }));
    }

    @Post('invoices/:invoiceId/issue')
    @HttpCode(200)
    async issue(
        @CurrentUser() user: AuthenticatedUser,
        @Param('invoiceId') invoiceId: string,
        @Body(new ZodPipe(issueInvoiceRequestSchema)) body: IssueInvoiceRequest,
    ): Promise<InvoiceDto> {
        return unwrap(await this.issueInvoice.execute({ userId: user.userId, invoiceId, body }));
    }

    @Post('invoices/:invoiceId/void')
    @HttpCode(200)
    async void(
        @CurrentUser() user: AuthenticatedUser,
        @Param('invoiceId') invoiceId: string,
        @Body(new ZodPipe(voidInvoiceRequestSchema)) body: VoidInvoiceRequest,
    ): Promise<InvoiceDto> {
        return unwrap(await this.voidInvoice.execute({ userId: user.userId, invoiceId, body }));
    }

    // ── ledgers ──

    @Get('main-contracts/:contractId/retention')
    async contractRetention(@CurrentUser() user: AuthenticatedUser, @Param('contractId') contractId: string): Promise<ContractRetentionDto> {
        return unwrap(await this.retention.execute(user.userId, contractId));
    }

    @Get('main-contracts/:contractId/advance')
    async contractAdvance(@CurrentUser() user: AuthenticatedUser, @Param('contractId') contractId: string): Promise<ContractAdvanceDto> {
        return unwrap(await this.advance.execute(user.userId, contractId));
    }

    // ── receipts, tax invoices, credit notes, receivables (WP-30) ──

    @Post('workspaces/:workspaceId/receipts')
    async addReceipt(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createReceiptRequestSchema)) body: CreateReceiptRequest,
    ): Promise<ReceiptDto> {
        return unwrap(await this.recordReceipt.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId), body }));
    }

    @Get('receipts/:receiptId')
    async receipt(@CurrentUser() user: AuthenticatedUser, @Param('receiptId') receiptId: string): Promise<ReceiptDto> {
        return unwrap(await this.getReceipt.execute(user.userId, receiptId));
    }

    @Post('receipts/:receiptId/void')
    @HttpCode(200)
    async cancelReceipt(
        @CurrentUser() user: AuthenticatedUser,
        @Param('receiptId') receiptId: string,
        @Body(new ZodPipe(voidReceiptRequestSchema)) body: VoidReceiptRequest,
    ): Promise<ReceiptDto> {
        return unwrap(await this.voidReceipt.execute({ userId: user.userId, receiptId, body }));
    }

    @Post('invoices/:invoiceId/tax-invoice')
    async addTaxInvoice(
        @CurrentUser() user: AuthenticatedUser,
        @Param('invoiceId') invoiceId: string,
        @Body(new ZodPipe(issueTaxInvoiceRequestSchema)) body: IssueTaxInvoiceRequest,
    ): Promise<InvoiceDto> {
        return unwrap(await this.taxInvoice.execute({ userId: user.userId, invoiceId, body }));
    }

    @Post('invoices/:invoiceId/credit-note')
    async addCreditNote(
        @CurrentUser() user: AuthenticatedUser,
        @Param('invoiceId') invoiceId: string,
        @Body(new ZodPipe(createCreditNoteRequestSchema)) body: CreateCreditNoteRequest,
    ): Promise<InvoiceDto> {
        return unwrap(await this.creditNote.execute({ userId: user.userId, invoiceId, body }));
    }

    @Get('invoices/:invoiceId/promptpay')
    async invoicePromptPay(@CurrentUser() user: AuthenticatedUser, @Param('invoiceId') invoiceId: string): Promise<InvoicePromptPayDto> {
        return unwrap(await this.promptPay.execute(user.userId, invoiceId));
    }

    @Get('workspaces/:workspaceId/receivables/aging')
    async receivablesAging(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<ArAgingDto> {
        return unwrap(await this.aging.execute(user.userId, workspaceIdParam(workspaceId)));
    }

    @Get('customers/:customerId/statement')
    async customerStatement(
        @CurrentUser() user: AuthenticatedUser,
        @Param('customerId') customerId: string,
        @Query(new ZodPipe(customerStatementQuerySchema)) query: CustomerStatementQuery,
    ): Promise<CustomerStatementDto> {
        return unwrap(await this.statement.execute(user.userId, customerId, query));
    }
}
