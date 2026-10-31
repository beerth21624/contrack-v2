// ─── PostgreSQL tables: ERP foundation (approvals, audit; later numbering, company, customers, …) ───
// docs/erp/02-domain-model.md §1. Every row carries its workspace id; repositories always filter by it. This file
// imports only schema.ts (core) and schema-helpers.ts. Add every table to `erpCoreTables`; database.ts merges it and
// drizzle.config.ts lists this file for migrations.
import { sql } from 'drizzle-orm';
import { bigserial, boolean, check, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Role } from '@contrack/contract';
import { workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, updatedAt } from './schema-helpers';

// ── approvals (WP-08, docs/erp/01-architecture.md §6) ──

/** A workspace's own rule for one subject; no row = APPROVAL_SUBJECT_DEFAULTS. */
export const approvalPolicies = pgTable('approval_policies', {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    enabled: boolean('enabled').notNull(),
    minAmount: money('min_amount'),
    approverRoles: jsonb('approver_roles').$type<Role[]>().notNull(),
    selfApprove: boolean('self_approve').notNull().default(true),
    /** Plain uuid: the user may be gone. */
    updatedBy: uuid('updated_by'),
    updatedAt: updatedAt(),
}, t => [primaryKey({ columns: [t.workspaceId, t.subject] })]);

/** One request per send-for-approval (also the automatic ones, for the audit trail). */
export const approvalRequests = pgTable('approval_requests', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Null for workspace-level subjects (the tenant FK is not checked then: MATCH SIMPLE). */
    projectId: uuid('project_id'),
    subject: text('subject').notNull(),
    subjectId: uuid('subject_id').notNull(),
    title: text('title').notNull(),
    amount: money('amount'),
    status: text('status', { enum: ['pending', 'approved', 'rejected', 'cancelled'] }).notNull(),
    auto: boolean('auto').notNull().default(false),
    autoReason: text('auto_reason', { enum: ['policy_off', 'below_threshold', 'self_approve', 'solo', 'no_approver'] }),
    requestedBy: uuid('requested_by').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note').notNull().default(''),
    createdAt: createdAt(),
}, t => [
    projectTenantFk('approval_requests', t),
    check('approval_requests_status_check', sql`${t.status} in ('pending', 'approved', 'rejected', 'cancelled')`),
    check('approval_requests_auto_reason_check',
        sql`${t.autoReason} is null or ${t.autoReason} in ('policy_off', 'below_threshold', 'self_approve', 'solo', 'no_approver')`),
    uniqueIndex('approval_requests_pending_key').on(t.workspaceId, t.subject, t.subjectId).where(sql`${t.status} = 'pending'`),
    index('approval_requests_workspace_status_idx').on(t.workspaceId, t.status, t.requestedAt),
    index('approval_requests_subject_idx').on(t.workspaceId, t.subject, t.subjectId),
    unique('approval_requests_id_workspace_key').on(t.id, t.workspaceId),
]);

/** Steps of a request (v1: one step, seq 1, created while the request is pending). */
export const approvalSteps = pgTable('approval_steps', {
    id: uuid('id').primaryKey(),
    requestId: uuid('request_id').notNull(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    approverRoles: jsonb('approver_roles').$type<Role[]>().notNull(),
    status: text('status', { enum: ['pending', 'approved', 'rejected', 'skipped'] }).notNull(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    note: text('note').notNull().default(''),
}, t => [
    foreignKey({
        name: 'approval_steps_request_fk',
        columns: [t.requestId, t.workspaceId],
        foreignColumns: [approvalRequests.id, approvalRequests.workspaceId],
    }).onDelete('cascade'),
    unique('approval_steps_request_seq_key').on(t.requestId, t.seq),
    check('approval_steps_status_check', sql`${t.status} in ('pending', 'approved', 'rejected', 'skipped')`),
]);

// ── audit (WP-08, docs/erp/01-architecture.md §10) ──

/** Append-only (never updated or deleted). No project FK: the trail outlives a deleted project. */
export const auditEvents = pgTable('audit_events', {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id'),
    actorUserId: uuid('actor_user_id'),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    index('audit_events_entity_idx').on(t.workspaceId, t.entityType, t.entityId, t.id),
    index('audit_events_workspace_at_idx').on(t.workspaceId, t.at),
]);

// ── numbering (WP-11, docs/erp/01-architecture.md §8, 02-domain-model.md §1.6) ──

/** A workspace's own series of one document type; no row = DOC_TYPE_DEFAULTS. */
export const docNumberSeries = pgTable('doc_number_series', {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    docType: text('doc_type').notNull(),
    prefix: text('prefix').notNull(),
    pattern: text('pattern').notNull(),
    reset: text('reset', { enum: ['yearly', 'monthly', 'never'] }).notNull(),
    yearStyle: text('year_style', { enum: ['ce', 'be'] }).notNull(),
    updatedBy: uuid('updated_by'),
    updatedAt: updatedAt(),
}, t => [
    primaryKey({ columns: [t.workspaceId, t.docType] }),
    check('doc_number_series_reset_check', sql`${t.reset} in ('yearly', 'monthly', 'never')`),
    check('doc_number_series_year_style_check', sql`${t.yearStyle} in ('ce', 'be')`),
]);

/** Last number used per (document type, period); the upsert's row lock serialises concurrent issues. */
export const docNumberCounters = pgTable('doc_number_counters', {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    docType: text('doc_type').notNull(),
    periodKey: text('period_key').notNull(),
    lastSeq: integer('last_seq').notNull(),
    updatedAt: updatedAt(),
}, t => [primaryKey({ columns: [t.workspaceId, t.docType, t.periodKey] })]);

/** Every number ever issued (never deleted; voided ones stay). No project FK: a number outlives a deleted project. */
export const issuedDocuments = pgTable('issued_documents', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    docType: text('doc_type').notNull(),
    number: text('number').notNull(),
    periodKey: text('period_key').notNull(),
    seq: integer('seq').notNull(),
    issueDate: businessDate('issue_date').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    projectId: uuid('project_id'),
    issuedBy: uuid('issued_by').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    status: text('status', { enum: ['issued', 'voided'] }).notNull().default('issued'),
    voidedBy: uuid('voided_by'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason').notNull().default(''),
}, t => [
    unique('issued_documents_number_key').on(t.workspaceId, t.docType, t.number),
    unique('issued_documents_subject_key').on(t.workspaceId, t.docType, t.subjectId),
    index('issued_documents_project_idx').on(t.workspaceId, t.projectId),
    index('issued_documents_period_idx').on(t.workspaceId, t.docType, t.periodKey),
    check('issued_documents_status_check', sql`${t.status} in ('issued', 'voided')`),
]);

export const erpCoreTables = { approvalPolicies, approvalRequests, approvalSteps, auditEvents, docNumberSeries, docNumberCounters, issuedDocuments };
