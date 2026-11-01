import type { StatusTone } from '../shared/StatusTag';

export const HANDOVER_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    draft: 'default', scheduled: 'processing', inspected: 'warning', accepted: 'success', rejected: 'error',
};

export const WARRANTY_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    active: 'success', expired: 'warning', closed: 'default',
};

export const CLAIM_STATUS_TONES: Partial<Record<string, StatusTone>> = {
    open: 'error', assigned: 'processing', in_progress: 'processing', resolved: 'warning', closed: 'success', rejected: 'default',
};

export const SEVERITY_TONES: Partial<Record<string, StatusTone>> = { low: 'default', medium: 'warning', high: 'error' };

export const CHECK_TONES: Partial<Record<string, StatusTone>> = { ok: 'success', fix: 'error', na: 'default' };

/** The paper handover note; the project id rides along because the note is read through its project. */
export const handoverPrintHref = (projectId: string, handoverId: string): string =>
    `/print/handover/${encodeURIComponent(handoverId)}?project=${encodeURIComponent(projectId)}`;

/** Today as a business date in Bangkok time (`YYYY-MM-DD`). */
export function todayBangkok(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
