// ─── State machines of a handover and a warranty claim (docs/erp/02-domain-model.md §11) ───
import type { HandoverChecklistItem, HandoverStatus, WarrantyClaimStatus } from '@contrack/contract';
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../shared/domain/result';

export const HANDOVER_TRANSITIONS: Readonly<Record<HandoverStatus, readonly HandoverStatus[]>> = {
    draft: ['scheduled'],
    // Re-scheduling keeps the status; the customer may refuse at the appointment.
    scheduled: ['scheduled', 'inspected', 'rejected'],
    inspected: ['scheduled', 'accepted', 'rejected'],
    // Fix the defects, then schedule again.
    rejected: ['scheduled'],
    accepted: [],
};

/** Statuses whose content (dates, attendees, checklist, notes) may still be edited. */
export const HANDOVER_EDITABLE: readonly HandoverStatus[] = ['draft', 'scheduled', 'inspected', 'rejected'];

export const CLAIM_TRANSITIONS: Readonly<Record<WarrantyClaimStatus, readonly WarrantyClaimStatus[]>> = {
    open: ['assigned', 'rejected'],
    // assigned → assigned = reassign; a quick fix may be resolved without starting.
    assigned: ['assigned', 'in_progress', 'resolved', 'rejected'],
    in_progress: ['assigned', 'resolved'],
    // Not fixed after all: back to work.
    resolved: ['in_progress', 'closed'],
    closed: [],
    rejected: [],
};

export const CLAIM_EDITABLE: readonly WarrantyClaimStatus[] = ['open', 'assigned', 'in_progress', 'resolved'];

const invalid = (status: string): DomainError => DomainError.conflict(`The document is ${status}`, { reason: 'invalid_transition', status });

/** conflict `invalid_transition` unless `current` is one of `allowed`. */
export function requireStatus<S extends string>(current: S, allowed: readonly S[]): Result<void, DomainError> {
    return allowed.includes(current) ? okVoid() : err(invalid(current));
}

export function requireHandoverTransition(current: HandoverStatus, to: HandoverStatus): Result<void, DomainError> {
    return HANDOVER_TRANSITIONS[current].includes(to) ? okVoid() : err(invalid(current));
}

export function requireClaimTransition(current: WarrantyClaimStatus, to: WarrantyClaimStatus): Result<void, DomainError> {
    return CLAIM_TRANSITIONS[current].includes(to) ? okVoid() : err(invalid(current));
}

/**
 * The standard handover checklist of a house / building job (used when a handover is created without one). Stored on
 * the document in both languages, like the other document texts (billing INVOICE_TEXT).
 */
export const DEFAULT_HANDOVER_CHECKLIST: readonly HandoverChecklistItem[] = [
    { itemTh: 'งานโครงสร้างและผนัง ไม่มีรอยร้าว', itemEn: 'Structure and walls free of cracks' },
    { itemTh: 'งานพื้น กระเบื้อง และบัวเชิงผนัง', itemEn: 'Floors, tiles and skirting' },
    { itemTh: 'งานฝ้าเพดานและหลังคา ไม่มีรอยรั่วซึม', itemEn: 'Ceilings and roof free of leaks' },
    { itemTh: 'ประตู หน้าต่าง กุญแจ และอุปกรณ์', itemEn: 'Doors, windows, locks and fittings' },
    { itemTh: 'งานสีภายในและภายนอก', itemEn: 'Interior and exterior paint' },
    { itemTh: 'ระบบไฟฟ้า สวิตช์ ปลั๊ก และแสงสว่าง', itemEn: 'Electrical system, switches, sockets and lighting' },
    { itemTh: 'ระบบประปา สุขภัณฑ์ และการระบายน้ำ', itemEn: 'Plumbing, sanitary ware and drainage' },
    { itemTh: 'ทำความสะอาดพื้นที่และขนย้ายเศษวัสดุ', itemEn: 'Site cleaned and debris removed' },
    { itemTh: 'ส่งมอบกุญแจ คู่มือ และใบรับประกันอุปกรณ์', itemEn: 'Keys, manuals and equipment warranty cards handed over' },
].map(i => ({ ...i, status: 'ok' as const, note: '' }));
