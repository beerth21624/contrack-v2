// ─── PostgreSQL schema (Drizzle). `npm run db:generate` turns changes into SQL migrations in ./drizzle ───
// Every tenant-owned table carries workspace_id; repositories always filter by it.
import { sql } from 'drizzle-orm';
import {
    bigserial, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import type { ProjectSummary } from '@contrack/contract';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

// ── identity ──
export const users = pgTable('users', {
    id: uuid('id').primaryKey(),
    /** Stored lower-cased (the domain normalises it). */
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: createdAt(),
}, t => [uniqueIndex('users_email_key').on(t.email)]);

export const refreshTokens = pgTable('refresh_tokens', {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    /** All tokens rotated from one login share a family; reusing a rotated token revokes the family. */
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedBy: uuid('replaced_by'),
}, t => [
    uniqueIndex('refresh_tokens_hash_key').on(t.tokenHash),
    index('refresh_tokens_user_idx').on(t.userId),
    index('refresh_tokens_family_idx').on(t.familyId),
]);

// ── workspaces (tenants) ──
export const workspaces = pgTable('workspaces', {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['personal', 'company'] }).notNull(),
    createdAt: createdAt(),
}, t => [check('workspaces_kind_check', sql`${t.kind} in ('personal', 'company')`)]);

export const memberships = pgTable('memberships', {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'admin', 'estimator', 'viewer'] }).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    index('memberships_user_idx').on(t.userId),
    check('memberships_role_check', sql`${t.role} in ('owner', 'admin', 'estimator', 'viewer')`),
]);

export const invitations = pgTable('invitations', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role', { enum: ['admin', 'estimator', 'viewer'] }).notNull(),
    tokenHash: text('token_hash').notNull(),
    invitedBy: uuid('invited_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, t => [
    uniqueIndex('invitations_token_key').on(t.tokenHash),
    index('invitations_workspace_idx').on(t.workspaceId),
    check('invitations_role_check', sql`${t.role} in ('admin', 'estimator', 'viewer')`),
]);

// ── projects ──
export const projects = pgTable('projects', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    start: text('start', { enum: ['blank', 'sample'] }).notNull(),
    engineVersion: text('engine_version').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    summary: jsonb('summary').$type<ProjectSummary>().notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
}, t => [
    index('projects_workspace_idx').on(t.workspaceId, t.archivedAt),
    check('projects_start_check', sql`${t.start} in ('blank', 'sample')`),
]);

export const projectDocs = pgTable('project_docs', {
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull(),
    docKey: text('doc_key').notNull(),
    /** null = reset to default (row kept so the version keeps increasing). */
    data: jsonb('data').$type<unknown>(),
    version: integer('version').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    primaryKey({ columns: [t.projectId, t.docKey] }),
    check('project_docs_version_check', sql`${t.version} >= 1`),
]);

export const projectRevisions = pgTable('project_revisions', {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull(),
    label: text('label').notNull(),
    note: text('note'),
    snapshot: jsonb('snapshot').$type<unknown>().notNull(),
    totals: jsonb('totals').$type<ProjectSummary>().notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [
    uniqueIndex('project_revisions_label_key').on(t.projectId, t.label),
    index('project_revisions_project_idx').on(t.projectId, t.createdAt),
]);

export const levelAssignments = pgTable('level_assignments', {
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull(),
    levelId: text('level_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    assignedBy: uuid('assigned_by').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.projectId, t.levelId] })]);

export const activityLog = pgTable('activity_log', {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    action: text('action').notNull(),
    docKey: text('doc_key'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('activity_log_project_idx').on(t.projectId, t.id)]);

export const schema = {
    users, refreshTokens, workspaces, memberships, invitations, projects, projectDocs, projectRevisions,
    levelAssignments, activityLog,
};
