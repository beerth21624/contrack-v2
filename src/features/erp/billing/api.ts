import {
    type ArAgingDto, type ArClaimDto, type ArClaimSummaryDto, type CertifyArClaimRequest, type ContractAdvanceDto, type ContractRetentionDto,
    type CreateAdvanceInvoiceRequest, type CreateArClaimRequest, type CreateCreditNoteRequest, type CreateReceiptRequest,
    type CreateRetentionReleaseInvoiceRequest, type CustomerStatementDto, type InvoiceArClaimRequest, type InvoiceDto,
    type IssueInvoiceRequest, type IssueTaxInvoiceRequest, type PatchArClaimRequest, type ReceiptDto, type VoidInvoiceRequest,
    type VoidReceiptRequest, arAgingDtoSchema, arClaimDtoSchema, arClaimListDtoSchema, contractAdvanceDtoSchema, contractRetentionDtoSchema,
    customerStatementDtoSchema, invoiceDtoSchema, invoiceListDtoSchema, receiptDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, projectPath, workspacePath } from '../shared/apiPaths';

export const billingApi = {
    claims: (contractId: string): Promise<ArClaimSummaryDto[]> =>
        apiClient.request('GET', apiPath('main-contracts', contractId, 'claims'), { schema: arClaimListDtoSchema }),
    createClaim: (contractId: string, body: CreateArClaimRequest): Promise<ArClaimDto> =>
        apiClient.request('POST', apiPath('main-contracts', contractId, 'claims'), { body, schema: arClaimDtoSchema }),
    claim: (claimId: string): Promise<ArClaimDto> =>
        apiClient.request('GET', apiPath('claims', claimId), { schema: arClaimDtoSchema }),
    patchClaim: (claimId: string, body: PatchArClaimRequest): Promise<ArClaimDto> =>
        apiClient.request('PATCH', apiPath('claims', claimId), { body, schema: arClaimDtoSchema }),
    submitClaim: (claimId: string): Promise<ArClaimDto> =>
        apiClient.request('POST', apiPath('claims', claimId, 'submit'), { body: {}, schema: arClaimDtoSchema }),
    certifyClaim: (claimId: string, body: CertifyArClaimRequest): Promise<ArClaimDto> =>
        apiClient.request('POST', apiPath('claims', claimId, 'certify'), { body, schema: arClaimDtoSchema }),
    invoiceClaim: (claimId: string, body: InvoiceArClaimRequest): Promise<InvoiceDto> =>
        apiClient.request('POST', apiPath('claims', claimId, 'invoice'), { body, schema: invoiceDtoSchema }),
    cancelClaim: (claimId: string): Promise<ArClaimDto> =>
        apiClient.request('POST', apiPath('claims', claimId, 'cancel'), { body: {}, schema: arClaimDtoSchema }),

    invoices: (projectId: string): Promise<InvoiceDto[]> =>
        apiClient.request('GET', projectPath(projectId, 'invoices'), { schema: invoiceListDtoSchema }),
    invoice: (invoiceId: string): Promise<InvoiceDto> =>
        apiClient.request('GET', apiPath('invoices', invoiceId), { schema: invoiceDtoSchema }),
    advanceInvoice: (contractId: string, body: CreateAdvanceInvoiceRequest): Promise<InvoiceDto> =>
        apiClient.request('POST', apiPath('main-contracts', contractId, 'advance-invoice'), { body, schema: invoiceDtoSchema }),
    retentionInvoice: (contractId: string, body: CreateRetentionReleaseInvoiceRequest): Promise<InvoiceDto> =>
        apiClient.request('POST', apiPath('main-contracts', contractId, 'retention-release-invoice'), { body, schema: invoiceDtoSchema }),
    issueInvoice: (invoiceId: string, body: IssueInvoiceRequest): Promise<InvoiceDto> =>
        apiClient.request('POST', apiPath('invoices', invoiceId, 'issue'), { body, schema: invoiceDtoSchema }),
    voidInvoice: (invoiceId: string, body: VoidInvoiceRequest): Promise<InvoiceDto> =>
        apiClient.request('POST', apiPath('invoices', invoiceId, 'void'), { body, schema: invoiceDtoSchema }),
    retention: (contractId: string): Promise<ContractRetentionDto> =>
        apiClient.request('GET', apiPath('main-contracts', contractId, 'retention'), { schema: contractRetentionDtoSchema }),
    advance: (contractId: string): Promise<ContractAdvanceDto> =>
        apiClient.request('GET', apiPath('main-contracts', contractId, 'advance'), { schema: contractAdvanceDtoSchema }),

    createReceipt: (workspaceId: string, body: CreateReceiptRequest): Promise<ReceiptDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'receipts'), { body, schema: receiptDtoSchema }),
    receipt: (receiptId: string): Promise<ReceiptDto> =>
        apiClient.request('GET', apiPath('receipts', receiptId), { schema: receiptDtoSchema }),
    voidReceipt: (receiptId: string, body: VoidReceiptRequest): Promise<ReceiptDto> =>
        apiClient.request('POST', apiPath('receipts', receiptId, 'void'), { body, schema: receiptDtoSchema }),
    taxInvoice: (invoiceId: string, body: IssueTaxInvoiceRequest): Promise<InvoiceDto> =>
        apiClient.request('POST', apiPath('invoices', invoiceId, 'tax-invoice'), { body, schema: invoiceDtoSchema }),
    creditNote: (invoiceId: string, body: CreateCreditNoteRequest): Promise<InvoiceDto> =>
        apiClient.request('POST', apiPath('invoices', invoiceId, 'credit-note'), { body, schema: invoiceDtoSchema }),
    aging: (workspaceId: string): Promise<ArAgingDto> =>
        apiClient.request('GET', workspacePath(workspaceId, 'receivables', 'aging'), { schema: arAgingDtoSchema }),
    statement: (customerId: string, from?: string, to?: string): Promise<CustomerStatementDto> => {
        const qs = new URLSearchParams();
        if (from !== undefined && from !== '') qs.set('from', from);
        if (to !== undefined && to !== '') qs.set('to', to);
        const query = qs.toString();
        return apiClient.request('GET', `${apiPath('customers', customerId, 'statement')}${query === '' ? '' : `?${query}`}`, { schema: customerStatementDtoSchema });
    },
};
