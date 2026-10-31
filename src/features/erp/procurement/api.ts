import {
    type AwardRfqRequest, type CreatePurchaseRequestRequest, type CreateRfqRequest, type PatchPurchaseRequestRequest, type PatchRfqRequest,
    type PurchaseOrderSummaryDto, type PurchaseRequestDto, type PurchaseRequestSummaryDto, type PutRfqQuoteRequest, type PutRfqSuppliersRequest,
    type RfqAwardDto, type RfqCompareDto, type RfqDto, type RfqSummaryDto, type SubmitPurchaseRequestRequest,
    purchaseOrderListDtoSchema, purchaseRequestDtoSchema, purchaseRequestListDtoSchema, rfqAwardDtoSchema, rfqCompareDtoSchema, rfqDtoSchema,
    rfqListDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, projectPath } from '../shared/apiPaths';

const request = { schema: purchaseRequestDtoSchema };
const rfq = { schema: rfqDtoSchema };

export const procurementApi = {
    // purchase requests
    listRequests: (projectId: string): Promise<PurchaseRequestSummaryDto[]> =>
        apiClient.request('GET', projectPath(projectId, 'purchase-requests'), { schema: purchaseRequestListDtoSchema }),
    createRequest: (projectId: string, body: CreatePurchaseRequestRequest): Promise<PurchaseRequestDto> =>
        apiClient.request('POST', projectPath(projectId, 'purchase-requests'), { body, ...request }),
    getRequest: (requestId: string): Promise<PurchaseRequestDto> =>
        apiClient.request('GET', apiPath('purchase-requests', requestId), request),
    patchRequest: (requestId: string, body: PatchPurchaseRequestRequest): Promise<PurchaseRequestDto> =>
        apiClient.request('PATCH', apiPath('purchase-requests', requestId), { body, ...request }),
    submitRequest: (requestId: string, body: SubmitPurchaseRequestRequest): Promise<PurchaseRequestDto> =>
        apiClient.request('POST', apiPath('purchase-requests', requestId, 'submit'), { body, ...request }),
    cancelRequest: (requestId: string): Promise<PurchaseRequestDto> =>
        apiClient.request('POST', apiPath('purchase-requests', requestId, 'cancel'), { body: {}, ...request }),
    // RFQs
    listRfqs: (projectId: string): Promise<RfqSummaryDto[]> =>
        apiClient.request('GET', projectPath(projectId, 'rfqs'), { schema: rfqListDtoSchema }),
    createRfq: (projectId: string, body: CreateRfqRequest): Promise<RfqDto> =>
        apiClient.request('POST', projectPath(projectId, 'rfqs'), { body, ...rfq }),
    getRfq: (rfqId: string): Promise<RfqDto> => apiClient.request('GET', apiPath('rfqs', rfqId), rfq),
    patchRfq: (rfqId: string, body: PatchRfqRequest): Promise<RfqDto> =>
        apiClient.request('PATCH', apiPath('rfqs', rfqId), { body, ...rfq }),
    putSuppliers: (rfqId: string, body: PutRfqSuppliersRequest): Promise<RfqDto> =>
        apiClient.request('PUT', apiPath('rfqs', rfqId, 'suppliers'), { body, ...rfq }),
    sendRfq: (rfqId: string): Promise<RfqDto> => apiClient.request('POST', apiPath('rfqs', rfqId, 'send'), { body: {}, ...rfq }),
    cancelRfq: (rfqId: string): Promise<RfqDto> => apiClient.request('POST', apiPath('rfqs', rfqId, 'cancel'), { body: {}, ...rfq }),
    putQuote: (rfqId: string, supplierId: string, body: PutRfqQuoteRequest): Promise<RfqDto> =>
        apiClient.request('PUT', apiPath('rfqs', rfqId, 'quotes', supplierId), { body, ...rfq }),
    compare: (rfqId: string): Promise<RfqCompareDto> =>
        apiClient.request('GET', apiPath('rfqs', rfqId, 'compare'), { schema: rfqCompareDtoSchema }),
    award: (rfqId: string, body: AwardRfqRequest): Promise<RfqAwardDto> =>
        apiClient.request('POST', apiPath('rfqs', rfqId, 'award'), { body, schema: rfqAwardDtoSchema }),
    // purchase orders (read-only list here; the screens are WP-41)
    listOrders: (projectId: string): Promise<PurchaseOrderSummaryDto[]> =>
        apiClient.request('GET', projectPath(projectId, 'purchase-orders'), { schema: purchaseOrderListDtoSchema }),
};
