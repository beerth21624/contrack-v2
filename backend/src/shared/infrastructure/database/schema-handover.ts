// ─── PostgreSQL tables: handover, warranty, closeout (module `handover`, WP-53 … WP-55, docs/erp/02-domain-model.md §11) ───
// Imports only schema.ts (core) and schema-helpers.ts. Add every table to `handoverTables`; database.ts merges it and
// drizzle.config.ts lists this file for migrations. contract_id / file_id / assignee ids point at other modules'
// tables: no FK (checked through ports, D-19).
import type {
    DocLanguage, HandoverAttendee, HandoverChecklistItem, HandoverDocumentKind, HandoverStatus, WarrantyClaimChannel, WarrantyClaimPhoto,
    WarrantyClaimSeverity, WarrantyClaimStatus, WarrantyStatus,
} from '@contrack/contract';
import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, updatedAt } from './schema-helpers';

/** The handover of a project to its owner (one per project; a refused one is scheduled again). */
export const hoHandovers = pgTable('ho_handovers', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    contractId: uuid('contract_id').notNull(),
    number: text('number'),
    status: text('status').$type<HandoverStatus>().notNull().default('draft'),
    scheduledDate: businessDate('scheduled_date'),
    inspectionDate: businessDate('inspection_date'),
    handoverDate: businessDate('handover_date'),
    attendees: jsonb('attendees').$type<HandoverAttendee[]>().notNull().default([]),
    checklist: jsonb('checklist').$type<HandoverChecklistItem[]>().notNull().default([]),
    defectsNote: text('defects_note').notNull().default(''),
    acceptedByName: text('accepted_by_name').notNull().default(''),
    language: text('language').$type<DocLanguage>().notNull().default('th'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('ho_handovers', t),
    unique('ho_handovers_project_key').on(t.projectId),
    unique('ho_handovers_workspace_number_key').on(t.workspaceId, t.number),
    check('ho_handovers_status_check', sql`${t.status} in ('draft', 'scheduled', 'inspected', 'accepted', 'rejected')`),
    check('ho_handovers_language_check', sql`${t.language} in ('th', 'en')`),
]);

/** Files handed over with the work (as-built drawings, manuals, warranty cards, test reports). */
export const hoHandoverDocuments = pgTable('ho_handover_documents', {
    id: uuid('id').primaryKey(),
    handoverId: uuid('handover_id').notNull().references(() => hoHandovers.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<HandoverDocumentKind>().notNull(),
    fileId: uuid('file_id').notNull(),
    title: text('title').notNull().default(''),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [
    index('ho_handover_documents_handover_idx').on(t.handoverId),
    check('ho_handover_documents_kind_check', sql`${t.kind} in ('as_built', 'manual', 'warranty_card', 'test_report', 'other')`),
]);

/** The warranty period that starts when the customer accepts the handover. */
export const hoWarranties = pgTable('ho_warranties', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    contractId: uuid('contract_id').notNull(),
    handoverId: uuid('handover_id').notNull().references(() => hoHandovers.id, { onDelete: 'cascade' }),
    startDate: businessDate('start_date').notNull(),
    endDate: businessDate('end_date').notNull(),
    status: text('status').$type<WarrantyStatus>().notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('ho_warranties', t),
    unique('ho_warranties_project_key').on(t.projectId),
    index('ho_warranties_status_end_idx').on(t.status, t.endDate),
    check('ho_warranties_status_check', sql`${t.status} in ('active', 'expired', 'closed')`),
]);

/** A defect the customer reports during the warranty. */
export const hoWarrantyClaims = pgTable('ho_warranty_claims', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    warrantyId: uuid('warranty_id').notNull().references(() => hoWarranties.id, { onDelete: 'cascade' }),
    number: text('number'),
    reportedDate: businessDate('reported_date').notNull(),
    reportedByName: text('reported_by_name').notNull().default(''),
    channel: text('channel').$type<WarrantyClaimChannel>().notNull().default('phone'),
    description: text('description').notNull(),
    location: text('location').notNull().default(''),
    photos: jsonb('photos').$type<WarrantyClaimPhoto[]>().notNull().default([]),
    severity: text('severity').$type<WarrantyClaimSeverity>().notNull().default('medium'),
    status: text('status').$type<WarrantyClaimStatus>().notNull().default('open'),
    assigneeUserId: uuid('assignee_user_id'),
    assigneeSupplierId: uuid('assignee_supplier_id'),
    dueDate: businessDate('due_date'),
    resolutionNote: text('resolution_note').notNull().default(''),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    costAmount: money('cost_amount').notNull().default(0),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('ho_warranty_claims', t),
    unique('ho_warranty_claims_workspace_number_key').on(t.workspaceId, t.number),
    index('ho_warranty_claims_workspace_project_idx').on(t.workspaceId, t.projectId, t.status),
    check('ho_warranty_claims_status_check', sql`${t.status} in ('open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected')`),
    check('ho_warranty_claims_channel_check', sql`${t.channel} in ('phone', 'line', 'site', 'link', 'other')`),
    check('ho_warranty_claims_severity_check', sql`${t.severity} in ('low', 'medium', 'high')`),
    check('ho_warranty_claims_cost_check', sql`${t.costAmount} >= 0`),
]);

/** Project closeout summary (WP-55 fills it; the table is created with the module). */
export const hoCloseouts = pgTable('ho_closeouts', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    status: text('status').$type<'draft' | 'final'>().notNull().default('draft'),
    asOf: businessDate('as_of'),
    summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
    lessons: text('lessons').notNull().default(''),
    finalizedBy: uuid('finalized_by'),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('ho_closeouts', t),
    unique('ho_closeouts_project_key').on(t.projectId),
    check('ho_closeouts_status_check', sql`${t.status} in ('draft', 'final')`),
]);

export const handoverTables = { hoHandovers, hoHandoverDocuments, hoWarranties, hoWarrantyClaims, hoCloseouts };
