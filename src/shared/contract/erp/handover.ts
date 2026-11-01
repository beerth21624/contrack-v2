// ─── Handover and warranty (ส่งมอบงาน รับประกัน, docs/erp/02-domain-model.md §11, WP-53) ───
// One handover per project, made once the main contract is signed: `draft → scheduled → inspected → accepted`;
// the customer may refuse (`rejected`) and the team schedules again. Scheduling moves the project to `handover`;
// accepting issues the `HO` number, completes the contract (milestones triggered by handover become claimable), moves
// the project to `warranty` and starts the warranty period (`end = addMonths(handoverDate, warrantyMonths)`).
// Warranty claims (`WC` number when opened): `open → assigned → in_progress → resolved → closed`, `open | assigned →
// rejected`; closing with a cost posts it to the cost ledger (`actual`, category `other`, no cost code).
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { fileDtoSchema } from '../files';
import { amountSchema, businessDateSchema, docLanguageSchema } from './common';
import { mainContractStatusSchema } from './main-contracts';

export const HANDOVER_STATUSES = ['draft', 'scheduled', 'inspected', 'accepted', 'rejected'] as const;
export const handoverStatusSchema = z.enum(HANDOVER_STATUSES);
export type HandoverStatus = z.infer<typeof handoverStatusSchema>;

export const HANDOVER_CHECK_STATUSES = ['ok', 'fix', 'na'] as const;
export const handoverCheckStatusSchema = z.enum(HANDOVER_CHECK_STATUSES);
export type HandoverCheckStatus = z.infer<typeof handoverCheckStatusSchema>;

export const HANDOVER_DOCUMENT_KINDS = ['as_built', 'manual', 'warranty_card', 'test_report', 'other'] as const;
export const handoverDocumentKindSchema = z.enum(HANDOVER_DOCUMENT_KINDS);
export type HandoverDocumentKind = z.infer<typeof handoverDocumentKindSchema>;

export const WARRANTY_STATUSES = ['active', 'expired', 'closed'] as const;
export const warrantyStatusSchema = z.enum(WARRANTY_STATUSES);
export type WarrantyStatus = z.infer<typeof warrantyStatusSchema>;

export const WARRANTY_CLAIM_STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected'] as const;
export const warrantyClaimStatusSchema = z.enum(WARRANTY_CLAIM_STATUSES);
export type WarrantyClaimStatus = z.infer<typeof warrantyClaimStatusSchema>;
/** Claims still being worked on (portal task, hub alert, open count). */
export const WARRANTY_CLAIM_OPEN_STATUSES = ['open', 'assigned', 'in_progress'] as const satisfies readonly WarrantyClaimStatus[];

export const WARRANTY_CLAIM_CHANNELS = ['phone', 'line', 'site', 'link', 'other'] as const;
export const warrantyClaimChannelSchema = z.enum(WARRANTY_CLAIM_CHANNELS);
export type WarrantyClaimChannel = z.infer<typeof warrantyClaimChannelSchema>;

export const WARRANTY_CLAIM_SEVERITIES = ['low', 'medium', 'high'] as const;
export const warrantyClaimSeveritySchema = z.enum(WARRANTY_CLAIM_SEVERITIES);
export type WarrantyClaimSeverity = z.infer<typeof warrantyClaimSeveritySchema>;

/** Days before the warranty's end date the team hears about it (`warranty.expiring`, once). */
export const WARRANTY_NOTICE_DAYS = 30;

// ── shared pieces ──

export const handoverAttendeeSchema = z.object({
    name: z.string().trim().min(1).max(200),
    role: z.string().trim().max(200).default(''),
});
export type HandoverAttendee = z.infer<typeof handoverAttendeeSchema>;

export const handoverChecklistItemSchema = z.object({
    itemTh: z.string().trim().max(500).default(''),
    itemEn: z.string().trim().max(500).default(''),
    status: handoverCheckStatusSchema.default('ok'),
    note: z.string().trim().max(2000).default(''),
});
export type HandoverChecklistItem = z.infer<typeof handoverChecklistItemSchema>;

/** Photo of a claim: purpose `warranty_photo`; `takenAt` from the phone. */
export const warrantyClaimPhotoSchema = z.object({
    fileId: uuidSchema,
    takenAt: isoDateTimeSchema.nullable().default(null),
    caption: z.string().trim().max(500).default(''),
});
export type WarrantyClaimPhoto = z.infer<typeof warrantyClaimPhotoSchema>;

// ── DTOs ──

export const handoverDocumentDtoSchema = z.object({
    id: uuidSchema,
    kind: handoverDocumentKindSchema,
    fileId: uuidSchema,
    /** Signed link; null when the file is gone. */
    file: fileDtoSchema.nullable(),
    title: z.string(),
    createdAt: isoDateTimeSchema,
});
export type HandoverDocumentDto = z.infer<typeof handoverDocumentDtoSchema>;

export const handoverDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    contractId: uuidSchema,
    /** `HO…`, issued when the customer accepts. */
    number: z.string().nullable(),
    status: handoverStatusSchema,
    scheduledDate: businessDateSchema.nullable(),
    inspectionDate: businessDateSchema.nullable(),
    handoverDate: businessDateSchema.nullable(),
    attendees: z.array(handoverAttendeeSchema),
    checklist: z.array(handoverChecklistItemSchema),
    defectsNote: z.string(),
    acceptedByName: z.string(),
    language: docLanguageSchema,
    documents: z.array(handoverDocumentDtoSchema),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    /** `handover.manage`, project not archived, and the status allows it. */
    canEdit: z.boolean(),
    canSchedule: z.boolean(),
    canInspect: z.boolean(),
    canAccept: z.boolean(),
    canReject: z.boolean(),
    /** Documents can be added in any status (as-built drawings often come after the handover). */
    canAddDocuments: z.boolean(),
});
export type HandoverDto = z.infer<typeof handoverDtoSchema>;

/** The project's main contract as the handover screen needs it. */
export const handoverContractInfoSchema = z.object({
    id: uuidSchema,
    number: z.string().nullable(),
    status: mainContractStatusSchema,
    warrantyMonths: z.number().int(),
    language: docLanguageSchema,
});
export type HandoverContractInfo = z.infer<typeof handoverContractInfoSchema>;

/** GET /projects/:projectId/handover. */
export const projectHandoverDtoSchema = z.object({
    handover: handoverDtoSchema.nullable(),
    /** The effective main contract (null when none). */
    contract: handoverContractInfoSchema.nullable(),
    /** No handover yet, the contract is signed and the caller holds `handover.manage`. */
    canCreate: z.boolean(),
});
export type ProjectHandoverDto = z.infer<typeof projectHandoverDtoSchema>;

export const warrantyDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    contractId: uuidSchema,
    startDate: businessDateSchema,
    endDate: businessDateSchema,
    status: warrantyStatusSchema,
    /** endDate − today in days (negative once over). */
    daysLeft: z.number().int(),
    openClaimCount: z.number().int(),
});
export type WarrantyDto = z.infer<typeof warrantyDtoSchema>;

/** GET /projects/:projectId/warranty (null before the customer accepted the handover). */
export const projectWarrantyDtoSchema = z.object({ warranty: warrantyDtoSchema.nullable() });
export type ProjectWarrantyDto = z.infer<typeof projectWarrantyDtoSchema>;

export const warrantyClaimPhotoDtoSchema = warrantyClaimPhotoSchema.extend({ file: fileDtoSchema.nullable() });
export type WarrantyClaimPhotoDto = z.infer<typeof warrantyClaimPhotoDtoSchema>;

export const warrantyClaimDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    warrantyId: uuidSchema,
    /** `WC…`, issued when the claim is opened. */
    number: z.string().nullable(),
    reportedDate: businessDateSchema,
    reportedByName: z.string(),
    channel: warrantyClaimChannelSchema,
    description: z.string(),
    location: z.string(),
    photos: z.array(warrantyClaimPhotoDtoSchema),
    severity: warrantyClaimSeveritySchema,
    status: warrantyClaimStatusSchema,
    assigneeUserId: uuidSchema.nullable(),
    assigneeSupplierId: uuidSchema.nullable(),
    /** Display name of the member or supplier assigned ('' when unknown). */
    assigneeName: z.string(),
    dueDate: businessDateSchema.nullable(),
    resolutionNote: z.string(),
    resolvedAt: isoDateTimeSchema.nullable(),
    closedAt: isoDateTimeSchema.nullable(),
    costAmount: z.number(),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    /** `handover.manage`, project not archived, not closed / rejected. */
    canEdit: z.boolean(),
    /** Transitions the caller may make now (assign = also reassign). */
    actions: z.array(z.enum(['assign', 'start', 'resolve', 'close', 'reject'])),
});
export type WarrantyClaimDto = z.infer<typeof warrantyClaimDtoSchema>;

export const warrantyClaimListDtoSchema = z.object({ items: z.array(warrantyClaimDtoSchema) });
export type WarrantyClaimListDto = z.infer<typeof warrantyClaimListDtoSchema>;

export const warrantyClaimListQuerySchema = z.object({ status: warrantyClaimStatusSchema.optional() });
export type WarrantyClaimListQuery = z.infer<typeof warrantyClaimListQuerySchema>;

// ── requests ──

/** POST /projects/:projectId/handover — needs a signed contract; no checklist = the standard one. */
export const createHandoverRequestSchema = z.object({
    language: docLanguageSchema.optional(),
    scheduledDate: businessDateSchema.nullable().optional(),
    attendees: z.array(handoverAttendeeSchema).max(50).optional(),
    checklist: z.array(handoverChecklistItemSchema).max(200).optional(),
});
export type CreateHandoverRequest = z.infer<typeof createHandoverRequestSchema>;

/** PATCH /handovers/:handoverId — any subset, before acceptance. */
export const patchHandoverRequestSchema = z.object({
    language: docLanguageSchema.optional(),
    scheduledDate: businessDateSchema.nullable().optional(),
    inspectionDate: businessDateSchema.nullable().optional(),
    attendees: z.array(handoverAttendeeSchema).max(50).optional(),
    checklist: z.array(handoverChecklistItemSchema).max(200).optional(),
    defectsNote: z.string().trim().max(5000).optional(),
    acceptedByName: z.string().trim().max(200).optional(),
    /** Handover documents to remove (ids of `documents[]`). */
    removeDocumentIds: z.array(uuidSchema).max(100).optional(),
});
export type PatchHandoverRequest = z.infer<typeof patchHandoverRequestSchema>;

/** POST /handovers/:handoverId/schedule — draft / scheduled / inspected / rejected → scheduled. */
export const scheduleHandoverRequestSchema = z.object({
    scheduledDate: businessDateSchema,
    attendees: z.array(handoverAttendeeSchema).max(50).optional(),
});
export type ScheduleHandoverRequest = z.infer<typeof scheduleHandoverRequestSchema>;

/** POST /handovers/:handoverId/inspect — scheduled → inspected (inspection date defaults to today). */
export const inspectHandoverRequestSchema = z.object({
    inspectionDate: businessDateSchema.optional(),
    checklist: z.array(handoverChecklistItemSchema).max(200).optional(),
    attendees: z.array(handoverAttendeeSchema).max(50).optional(),
    defectsNote: z.string().trim().max(5000).optional(),
});
export type InspectHandoverRequest = z.infer<typeof inspectHandoverRequestSchema>;

/** POST /handovers/:handoverId/accept — inspected → accepted (handover date defaults to the inspection date, else today). */
export const acceptHandoverRequestSchema = z.object({
    handoverDate: businessDateSchema.optional(),
    acceptedByName: z.string().trim().min(1).max(200),
});
export type AcceptHandoverRequest = z.infer<typeof acceptHandoverRequestSchema>;

/** POST /handovers/:handoverId/reject — scheduled / inspected → rejected (the customer did not accept). */
export const rejectHandoverRequestSchema = z.object({ defectsNote: z.string().trim().max(5000).optional() });
export type RejectHandoverRequest = z.infer<typeof rejectHandoverRequestSchema>;

/** POST /handovers/:handoverId/documents — purpose `handover_document` or `as_built`, uploaded by the caller. */
export const addHandoverDocumentRequestSchema = z.object({
    kind: handoverDocumentKindSchema,
    fileId: uuidSchema,
    title: z.string().trim().max(300).default(''),
});
export type AddHandoverDocumentRequest = z.infer<typeof addHandoverDocumentRequestSchema>;

/** POST /projects/:projectId/warranty-claims — needs the project's warranty (after acceptance). */
export const createWarrantyClaimRequestSchema = z.object({
    reportedDate: businessDateSchema.optional(),
    reportedByName: z.string().trim().max(200).default(''),
    channel: warrantyClaimChannelSchema.default('phone'),
    description: z.string().trim().min(1).max(5000),
    location: z.string().trim().max(500).default(''),
    photos: z.array(warrantyClaimPhotoSchema).max(30).default([]),
    severity: warrantyClaimSeveritySchema.default('medium'),
    dueDate: businessDateSchema.nullable().optional(),
});
export type CreateWarrantyClaimRequest = z.infer<typeof createWarrantyClaimRequestSchema>;

/** PATCH /warranty-claims/:claimId — any subset while not closed / rejected. */
export const patchWarrantyClaimRequestSchema = z.object({
    reportedDate: businessDateSchema.optional(),
    reportedByName: z.string().trim().max(200).optional(),
    channel: warrantyClaimChannelSchema.optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    location: z.string().trim().max(500).optional(),
    photos: z.array(warrantyClaimPhotoSchema).max(30).optional(),
    severity: warrantyClaimSeveritySchema.optional(),
    dueDate: businessDateSchema.nullable().optional(),
    resolutionNote: z.string().trim().max(5000).optional(),
    costAmount: amountSchema.optional(),
});
export type PatchWarrantyClaimRequest = z.infer<typeof patchWarrantyClaimRequestSchema>;

/** POST /warranty-claims/:claimId/assign — a member of the workspace and / or a supplier (at least one). */
export const assignWarrantyClaimRequestSchema = z.object({
    assigneeUserId: uuidSchema.nullable().optional(),
    assigneeSupplierId: uuidSchema.nullable().optional(),
    dueDate: businessDateSchema.nullable().optional(),
});
export type AssignWarrantyClaimRequest = z.infer<typeof assignWarrantyClaimRequestSchema>;

/** POST /warranty-claims/:claimId/resolve | close — note and cost may be set on the way. */
export const resolveWarrantyClaimRequestSchema = z.object({
    resolutionNote: z.string().trim().max(5000).optional(),
    costAmount: amountSchema.optional(),
});
export type ResolveWarrantyClaimRequest = z.infer<typeof resolveWarrantyClaimRequestSchema>;
export const closeWarrantyClaimRequestSchema = resolveWarrantyClaimRequestSchema;
export type CloseWarrantyClaimRequest = ResolveWarrantyClaimRequest;

/** POST /warranty-claims/:claimId/reject — outside the warranty's terms. */
export const rejectWarrantyClaimRequestSchema = z.object({ resolutionNote: z.string().trim().max(5000).optional() });
export type RejectWarrantyClaimRequest = z.infer<typeof rejectWarrantyClaimRequestSchema>;
