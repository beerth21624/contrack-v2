import type { HubProjectStatus } from '@/shared/contract';
import type { StatusTone } from '../shared/StatusTag';

/** Tag colours of the project statuses. */
export const PROJECT_STATUS_TONES: Readonly<Record<HubProjectStatus, StatusTone>> = {
    lead: 'default',
    estimating: 'processing',
    quoted: 'processing',
    won: 'success',
    in_progress: 'processing',
    handover: 'warning',
    warranty: 'warning',
    closed: 'default',
    lost: 'error',
    cancelled: 'error',
};
