import {
    type AwardRfqRequest, type CreateGoodsReceiptRequest, type CreatePurchaseOrderRequest, type CreatePurchaseRequestRequest, type CreateRfqRequest,
    type GoodsReceiptDto, type IssuePurchaseOrderRequest, type PatchPurchaseOrderRequest, type PatchPurchaseRequestRequest, type PatchRfqRequest,
    type PurchaseOrderDto, type PurchaseOrderStatus, type PurchaseOrderSummaryDto, type SupplierPriceHistoryItem,
    goodsReceiptDtoSchema, goodsReceiptListDtoSchema, purchaseOrderDtoSchema, supplierPriceHistoryDtoSchema, type PurchaseRequestDto, type PurchaseRequestSummaryDto, type PutRfqQuoteRequest, type PutRfqSuppliersRequest,
    type RfqAwardDto, type RfqCompareDto, type RfqDto, type RfqSummaryDto, type SubmitPurchaseRequestRequest,
    purchaseOrderListDtoSchema, purchaseRequestDtoSchema, purchaseRequestListDtoSchema, rfqAwardDtoSchema, rfqCompareDtoSchema, rfqDtoSchema,
    rfqListDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, projectPath, workspacePath } from '../shared/apiPaths';

const request = { schema: purchaseRequestDtoSchema };
const rfq = { schema: rfqDtoSchema };
const order = { schema: purchaseOrderDtoSchema };

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
    // purchase orders
    listOrders: (projectId: string): Promise<PurchaseOrderSummaryDto[]> =>
        apiClient.request('GET', projectPath(projectId, 'purchase-orders'), { schema: purchaseOrderListDtoSchema }),
    listWorkspaceOrders: (workspaceId: string, statuses: readonly PurchaseOrderStatus[]): Promise<PurchaseOrderSummaryDto[]> =>
        apiClient.request('GET', `${workspacePath(workspaceId, 'purchase-orders')}${statuses.length > 0 ? `?status=${statuses.join(',')}` : ''}`,
            { schema: purchaseOrderListDtoSchema }),
    createOrder: (projectId: string, body: CreatePurchaseOrderRequest): Promise<PurchaseOrderDto> =>
        apiClient.request('POST', projectPath(projectId, 'purchase-orders'), { body, ...order }),
    getOrder: (orderId: string): Promise<PurchaseOrderDto> => apiClient.request('GET', apiPath('purchase-orders', orderId), order),
    patchOrder: (orderId: string, body: PatchPurchaseOrderRequest): Promise<PurchaseOrderDto> =>
        apiClient.request('PATCH', apiPath('purchase-orders', orderId), { body, ...order }),
    issueOrder: (orderId: string, body: IssuePurchaseOrderRequest): Promise<PurchaseOrderDto> =>
        apiClient.request('POST', apiPath('purchase-orders', orderId, 'issue'), { body, ...order }),
    cancelOrder: (orderId: string): Promise<PurchaseOrderDto> =>
        apiClient.request('POST', apiPath('purchase-orders', orderId, 'cancel'), { body: {}, ...order }),
    closeOrder: (orderId: string): Promise<PurchaseOrderDto> =>
        apiClient.request('POST', apiPath('purchase-orders', orderId, 'close'), { body: {}, ...order }),
    // goods receipts
    listReceipts: (orderId: string): Promise<GoodsReceiptDto[]> =>
        apiClient.request('GET', apiPath('purchase-orders', orderId, 'receipts'), { schema: goodsReceiptListDtoSchema }),
    createReceipt: (orderId: string, body: CreateGoodsReceiptRequest): Promise<GoodsReceiptDto> =>
        apiClient.request('POST', apiPath('purchase-orders', orderId, 'receipts'), { body, schema: goodsReceiptDtoSchema }),
    confirmReceipt: (receiptId: string): Promise<GoodsReceiptDto> =>
        apiClient.request('POST', apiPath('goods-receipts', receiptId, 'confirm'), { body: {}, schema: goodsReceiptDtoSchema }),
    cancelReceipt: (receiptId: string): Promise<GoodsReceiptDto> =>
        apiClient.request('POST', apiPath('goods-receipts', receiptId, 'cancel'), { body: {}, schema: goodsReceiptDtoSchema }),
    // supplier price history
    priceHistory: (supplierId: string, q: string): Promise<SupplierPriceHistoryItem[]> =>
        apiClient.request('GET', `${apiPath('suppliers', supplierId, 'price-history')}${q.trim() !== '' ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
            { schema: supplierPriceHistoryDtoSchema }),
};
