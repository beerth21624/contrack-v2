import type { StatusTone } from '../shared/StatusTag';

/** Colours of `enums.contractStatus` (the rest follow the defaults of StatusTag). */
export const CONTRACT_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    draft: 'default',
    signed: 'success',
    completed: 'processing',
    closed: 'default',
    cancelled: 'error',
    terminated: 'error',
};
