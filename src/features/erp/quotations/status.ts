import type { StatusTone } from '../shared/StatusTag';

/** Colours of `enums.quotationVersionStatus` (the rest follow the defaults of StatusTag). */
export const QUOTATION_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    pending_approval: 'warning',
    change_requested: 'warning',
    issued: 'processing',
    accepted: 'success',
    rejected: 'error',
    expired: 'warning',
    superseded: 'default',
    cancelled: 'error',
};
