import type { StatusTone } from '../shared/StatusTag';

/** Colours of `enums.purchaseRequestStatus` (the rest follow the defaults of StatusTag). */
export const REQUEST_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    pending_approval: 'warning',
    partially_ordered: 'warning',
    ordered: 'success',
};

/** Colours of `enums.rfqStatus`. */
export const RFQ_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    awarded: 'success',
    closed: 'default',
};

/** Colours of `enums.purchaseOrderStatus`. */
export const ORDER_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    pending_approval: 'warning',
    issued: 'processing',
    partially_received: 'warning',
    received: 'success',
};

export const procurementHref = (projectId: string, tab?: 'requests' | 'rfqs' | 'orders'): string =>
    `/p/${encodeURIComponent(projectId)}/procurement${tab === undefined ? '' : `?tab=${tab}`}`;

export const rfqHref = (projectId: string, rfqId: string): string =>
    `/p/${encodeURIComponent(projectId)}/procurement/rfqs/${encodeURIComponent(rfqId)}`;

export const orderHref = (projectId: string, orderId: string): string =>
    `/p/${encodeURIComponent(projectId)}/procurement/orders/${encodeURIComponent(orderId)}`;
