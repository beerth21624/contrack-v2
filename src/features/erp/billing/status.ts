import type { StatusTone } from '../shared/StatusTag';

/** Colours of `enums.claimStatus`. */
export const CLAIM_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    draft: 'default',
    pending_approval: 'warning',
    submitted: 'processing',
    certified: 'success',
    invoiced: 'success',
    cancelled: 'error',
};

/** Colours of `enums.invoiceStatus`. */
export const INVOICE_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    draft: 'default',
    issued: 'processing',
    partially_paid: 'warning',
    paid: 'success',
    voided: 'error',
};

/** Invoices that are receivables (tax invoices and credit notes are not). */
export const isReceivableKind = (kind: string): boolean => kind === 'invoice' || kind === 'advance_invoice';

export const billingHref = (projectId: string): string => `/p/${encodeURIComponent(projectId)}/billing`;
export const claimHref = (projectId: string, claimId: string): string => `${billingHref(projectId)}/claims/${encodeURIComponent(claimId)}`;

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
