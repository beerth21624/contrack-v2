import {
    type ApPaymentDto, type ApproveSupplierBillRequest, type CancelPaymentRunRequest, type CreateBillFromOrderRequest, type CreateBillFromPayPeriodRequest,
    type CreateBillFromScClaimRequest, type CreatePaymentRunRequest, type CreateSupplierBillRequest, type PatchPaymentRunRequest, type PatchSupplierBillRequest,
    type PayablesDueDto, type PayPaymentRunRequest, type PaymentRunDto, type PaymentRunStatus, type PaymentRunSummaryDto, type SupplierBillDto,
    type SupplierBillListQuery, type SupplierBillSummaryDto, type VoidSupplierBillRequest, type WhtCertificateDto,
    apPaymentDtoSchema, payablesDueDtoSchema, paymentRunDtoSchema, paymentRunListDtoSchema, supplierBillDtoSchema, supplierBillListDtoSchema, whtCertificateDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, workspacePath } from '../shared/apiPaths';

const bill = { schema: supplierBillDtoSchema };
const run = { schema: paymentRunDtoSchema };

function qs(params: Record<string, string | undefined>): string {
    const parts = Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`);
    return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

export const payablesApi = {
    due: (workspaceId: string, within: number): Promise<PayablesDueDto> =>
        apiClient.request('GET', `${workspacePath(workspaceId, 'payables', 'due')}${qs({ within: String(within) })}`, { schema: payablesDueDtoSchema }),
    // bills
    listBills: (workspaceId: string, q: SupplierBillListQuery): Promise<SupplierBillSummaryDto[]> =>
        apiClient.request('GET', `${workspacePath(workspaceId, 'supplier-bills')}${qs({
            status: q.status?.join(','), kind: q.kind, supplierId: q.supplierId, projectId: q.projectId,
        })}`, { schema: supplierBillListDtoSchema }).then(r => r.items),
    getBill: (billId: string): Promise<SupplierBillDto> => apiClient.request('GET', apiPath('supplier-bills', billId), bill),
    createBill: (workspaceId: string, body: CreateSupplierBillRequest): Promise<SupplierBillDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'supplier-bills'), { body, ...bill }),
    billFromOrder: (orderId: string, body: CreateBillFromOrderRequest): Promise<SupplierBillDto> =>
        apiClient.request('POST', apiPath('purchase-orders', orderId, 'bill'), { body, ...bill }),
    billFromScClaim: (workspaceId: string, body: CreateBillFromScClaimRequest): Promise<SupplierBillDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'supplier-bills', 'from-sc-claim'), { body, ...bill }),
    billFromPayPeriod: (workspaceId: string, body: CreateBillFromPayPeriodRequest): Promise<SupplierBillDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'supplier-bills', 'from-pay-period'), { body, ...bill }),
    patchBill: (billId: string, body: PatchSupplierBillRequest): Promise<SupplierBillDto> =>
        apiClient.request('PATCH', apiPath('supplier-bills', billId), { body, ...bill }),
    approveBill: (billId: string, body: ApproveSupplierBillRequest): Promise<SupplierBillDto> =>
        apiClient.request('POST', apiPath('supplier-bills', billId, 'approve'), { body, ...bill }),
    voidBill: (billId: string, body: VoidSupplierBillRequest): Promise<SupplierBillDto> =>
        apiClient.request('POST', apiPath('supplier-bills', billId, 'void'), { body, ...bill }),
    // payment runs
    listRuns: (workspaceId: string, statuses: readonly PaymentRunStatus[]): Promise<PaymentRunSummaryDto[]> =>
        apiClient.request('GET', `${workspacePath(workspaceId, 'payment-runs')}${qs({ status: statuses.join(',') })}`, { schema: paymentRunListDtoSchema }).then(r => r.items),
    createRun: (workspaceId: string, body: CreatePaymentRunRequest): Promise<PaymentRunDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'payment-runs'), { body, ...run }),
    getRun: (runId: string): Promise<PaymentRunDto> => apiClient.request('GET', apiPath('payment-runs', runId), run),
    patchRun: (runId: string, body: PatchPaymentRunRequest): Promise<PaymentRunDto> =>
        apiClient.request('PATCH', apiPath('payment-runs', runId), { body, ...run }),
    approveRun: (runId: string): Promise<PaymentRunDto> => apiClient.request('POST', apiPath('payment-runs', runId, 'approve'), { body: {}, ...run }),
    payRun: (runId: string, body: PayPaymentRunRequest): Promise<PaymentRunDto> =>
        apiClient.request('POST', apiPath('payment-runs', runId, 'pay'), { body, ...run }),
    cancelRun: (runId: string, body: CancelPaymentRunRequest): Promise<PaymentRunDto> =>
        apiClient.request('POST', apiPath('payment-runs', runId, 'cancel'), { body, ...run }),
    // vouchers and certificates
    getPayment: (paymentId: string): Promise<ApPaymentDto> => apiClient.request('GET', apiPath('payments', paymentId), { schema: apPaymentDtoSchema }),
    getCertificate: (certificateId: string): Promise<WhtCertificateDto> =>
        apiClient.request('GET', apiPath('wht-certificates', certificateId), { schema: whtCertificateDtoSchema }),
};
