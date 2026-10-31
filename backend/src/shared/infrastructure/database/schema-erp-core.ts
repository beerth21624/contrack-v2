// ─── PostgreSQL tables: ERP foundation (approvals, audit; later numbering, company, customers, …) ───
// docs/erp/02-domain-model.md §1. Every row carries its workspace id; repositories always filter by it. This file
// imports only schema.ts (core) and schema-helpers.ts. Add every table to `erpCoreTables`; database.ts merges it and
// drizzle.config.ts lists this file for migrations.
import { sql } from 'drizzle-orm';
import { bigserial, boolean, check, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Role } from '@contrack/contract';
import { workspaces } from './schema';
import { createdAt, money, projectTenantFk, updatedAt } from './schema-helpers';

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

export const erpCoreTables = { approvalPolicies, approvalRequests, approvalSteps, auditEvents };
