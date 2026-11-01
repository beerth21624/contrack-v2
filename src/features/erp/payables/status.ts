import type { StatusTone } from '../shared/StatusTag';

/** Colours of `enums.supplierBillStatus`. */
export const BILL_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    pending_approval: 'warning',
    scheduled: 'processing',
};

/** Colours of `enums.paymentRunStatus`. */
export const RUN_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    pending_approval: 'warning',
    approved: 'processing',
    paid: 'success',
};

/** Colours of `enums.billMatchStatus`. */
export const MATCH_TONES: Partial<Record<string, StatusTone>> = {
    matched: 'success',
    exceptions: 'warning',
    not_applicable: 'default',
};

/** Colours of `enums.billLineMatch`. */
export const LINE_MATCH_TONES: Partial<Record<string, StatusTone>> = {
    matched: 'success',
    qty_exceeds_received: 'error',
    price_differs: 'warning',
    no_po: 'default',
};

export const billHref = (billId: string): string => `/payables/bills/${encodeURIComponent(billId)}`;
export const runHref = (runId: string): string => `/payables/runs/${encodeURIComponent(runId)}`;
export const whtCertificatePrintHref = (id: string): string => `/print/wht-certificate/${encodeURIComponent(id)}`;
export const paymentVoucherPrintHref = (id: string): string => `/print/payment-voucher/${encodeURIComponent(id)}`;
