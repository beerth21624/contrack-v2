import type { StatusTone } from '../shared/StatusTag';

/** Colours of `enums.variationStatus` (the rest follow the defaults of StatusTag). */
export const VARIATION_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    pending_approval: 'warning',
    submitted: 'processing',
    accepted: 'success',
    rejected: 'error',
    withdrawn: 'default',
    cancelled: 'error',
};

export const variationHref = (projectId: string, variationId: string): string =>
    `/p/${encodeURIComponent(projectId)}/variations/${encodeURIComponent(variationId)}`;
