// ─── PostgreSQL schema (Drizzle). `npm run db:generate` turns changes into SQL migrations in ./drizzle ───
// Every tenant-owned table carries workspace_id; repositories always filter by it.
import { sql } from 'drizzle-orm';
import {
    bigserial, check, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { ProjectSummary } from '@contrack/contract';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

// ── identity ──
export const users = pgTable('users', {
    id: uuid('id').primaryKey(),
    /** Stored lower-cased (the domain normalises it). */
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    /** E.164 (+66…), set by phone sign-in (subcontractors). Phone-only users get a placeholder e-mail and an unusable password hash. */
    phone: text('phone'),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    createdAt: createdAt(),
}, t => [uniqueIndex('users_email_key').on(t.email), uniqueIndex('users_phone_key').on(t.phone)]);

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
    // Target of the (project_id, workspace_id) foreign keys: a child row can only name its project's own workspace.
    // A table constraint (not just an index): it is created with the table, before the foreign keys that use it.
    unique('projects_id_workspace_key').on(t.id, t.workspaceId),
    check('projects_start_check', sql`${t.start} in ('blank', 'sample')`),
]);

/** Child rows reference (project_id, workspace_id) together, so their workspace always equals the project's. */
function tenantFk(table: string, t: { projectId: AnyPgColumn; workspaceId: AnyPgColumn }) {
    return foreignKey({
        name: `${table}_project_tenant_fk`,
        columns: [t.projectId, t.workspaceId],
        foreignColumns: [projects.id, projects.workspaceId],
    }).onDelete('cascade');
}

export const projectDocs = pgTable('project_docs', {
    projectId: uuid('project_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    docKey: text('doc_key').notNull(),
    /** null = reset to default (row kept so the version keeps increasing). */
    data: jsonb('data').$type<unknown>(),
    version: integer('version').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    primaryKey({ columns: [t.projectId, t.docKey] }),
    tenantFk('project_docs', t),
    check('project_docs_version_check', sql`${t.version} >= 1`),
]);

export const projectRevisions = pgTable('project_revisions', {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    label: text('label').notNull(),
    note: text('note'),
    snapshot: jsonb('snapshot').$type<unknown>().notNull(),
    totals: jsonb('totals').$type<ProjectSummary>().notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [
    uniqueIndex('project_revisions_label_key').on(t.projectId, t.label),
    tenantFk('project_revisions', t),
    index('project_revisions_project_idx').on(t.projectId, t.createdAt),
]);

export const levelAssignments = pgTable('level_assignments', {
    projectId: uuid('project_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    levelId: text('level_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    assignedBy: uuid('assigned_by').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.projectId, t.levelId] }), tenantFk('level_assignments', t)]);

export const activityLog = pgTable('activity_log', {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    projectId: uuid('project_id').notNull(),
    userId: uuid('user_id').notNull(),
    action: text('action').notNull(),
    docKey: text('doc_key'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('activity_log_project_idx').on(t.projectId, t.id), tenantFk('activity_log', t)]);

// ── rate cards (workspace library of daily wage sets) ──
/**
 * Rates are whole baht per day (integer): Excel's sets are whole numbers and Thai daily wages are quoted in whole baht.
 * Archiving is a soft delete (archived_at); the name is unique, case-insensitively, among the active cards only, so an
 * archived card's name can be used again.
 */
export const rateCards = pgTable('rate_cards', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    skilledRate: integer('skilled_rate').notNull(),
    labourerRate: integer('labourer_rate').notNull(),
    note: text('note'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
}, t => [
    uniqueIndex('rate_cards_name_key').on(t.workspaceId, sql`lower(${t.name})`).where(sql`${t.archivedAt} is null`),
    index('rate_cards_workspace_idx').on(t.workspaceId, t.archivedAt),
    // Target of future (rate_card_id, workspace_id) foreign keys (crews, project snapshots), like projects_id_workspace_key:
    // a child row will only be able to name a card of its own workspace.
    unique('rate_cards_id_workspace_key').on(t.id, t.workspaceId),
    check('rate_cards_name_check', sql`char_length(${t.name}) between 1 and 60`),
    check('rate_cards_skilled_rate_check', sql`${t.skilledRate} between 0 and 100000`),
    check('rate_cards_labourer_rate_check', sql`${t.labourerRate} between 0 and 100000`),
]);

// ── workforce (business module: people, crews, crews on planned tasks, site supervisors) ──
// Tenant-scoped like everything else: every child row names (…_id, workspace_id) together, so a crew can only list
// people of its own workspace and an assignment can only join a crew and a project of the same workspace.
// People and crews are archived (soft delete); assignments and supervisors are deleted with their project.

/** People (บุคลากร): not users of the system. Names may repeat (two workers can share a name). */
export const people = pgTable('people', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nickname: text('nickname'),
    phone: text('phone'),
    role: text('role', { enum: ['foreman', 'supervisor', 'engineer', 'skilled', 'labourer'] }).notNull(),
    employment: text('employment', { enum: ['permanent', 'daily', 'subcontractor'] }).notNull(),
    /** Trade ids (WORKFORCE_TRADE_IDS), in the order given. */
    trades: text('trades').array().notNull().default(sql`'{}'::text[]`),
    /** ฿/day, whole baht; null = not set. */
    dailyWage: integer('daily_wage'),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
}, t => [
    index('people_workspace_idx').on(t.workspaceId, t.archivedAt),
    unique('people_id_workspace_key').on(t.id, t.workspaceId),
    check('people_name_check', sql`char_length(${t.name}) between 1 and 80`),
    check('people_role_check', sql`${t.role} in ('foreman', 'supervisor', 'engineer', 'skilled', 'labourer')`),
    check('people_employment_check', sql`${t.employment} in ('permanent', 'daily', 'subcontractor')`),
    check('people_daily_wage_check', sql`${t.dailyWage} is null or ${t.dailyWage} between 0 and 100000`),
]);

/** Crews (ทีมช่าง): a leader, named members and/or a headcount, priced by a rate card or a typed ฿/day. */
export const crews = pgTable('crews', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    trade: text('trade').notNull(),
    leaderId: uuid('leader_id'),
    skilledCount: integer('skilled_count').notNull(),
    labourerCount: integer('labourer_count').notNull(),
    rateCardId: uuid('rate_card_id'),
    dailyCostOverride: integer('daily_cost_override'),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
}, t => [
    uniqueIndex('crews_name_key').on(t.workspaceId, sql`lower(${t.name})`).where(sql`${t.archivedAt} is null`),
    index('crews_workspace_idx').on(t.workspaceId, t.archivedAt),
    unique('crews_id_workspace_key').on(t.id, t.workspaceId),
    // No ON DELETE action: people and rate cards are only ever archived (a workspace's deletion removes both sides).
    foreignKey({ name: 'crews_leader_tenant_fk', columns: [t.leaderId, t.workspaceId], foreignColumns: [people.id, people.workspaceId] }),
    foreignKey({ name: 'crews_rate_card_tenant_fk', columns: [t.rateCardId, t.workspaceId], foreignColumns: [rateCards.id, rateCards.workspaceId] }),
    check('crews_name_check', sql`char_length(${t.name}) between 1 and 80`),
    check('crews_skilled_count_check', sql`${t.skilledCount} between 0 and 200`),
    check('crews_labourer_count_check', sql`${t.labourerCount} between 0 and 200`),
    check('crews_daily_cost_override_check', sql`${t.dailyCostOverride} is null or ${t.dailyCostOverride} between 0 and 100000`),
]);

/** Named members of a crew, in the order given. */
export const crewMembers = pgTable('crew_members', {
    crewId: uuid('crew_id').notNull(),
    personId: uuid('person_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    position: integer('position').notNull(),
}, t => [
    primaryKey({ columns: [t.crewId, t.personId] }),
    index('crew_members_person_idx').on(t.workspaceId, t.personId),
    foreignKey({ name: 'crew_members_crew_tenant_fk', columns: [t.crewId, t.workspaceId], foreignColumns: [crews.id, crews.workspaceId] })
        .onDelete('cascade'),
    foreignKey({ name: 'crew_members_person_tenant_fk', columns: [t.personId, t.workspaceId], foreignColumns: [people.id, people.workspaceId] })
        .onDelete('cascade'),
]);

/** A crew on a planned task (S-Curve "1.1" … "8.6") of a project, first to last day inclusive. Overlaps are allowed. */
export const crewAssignments = pgTable('crew_assignments', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    projectId: uuid('project_id').notNull(),
    crewId: uuid('crew_id').notNull(),
    taskId: text('task_id').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    note: text('note'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    tenantFk('crew_assignments', t),
    foreignKey({ name: 'crew_assignments_crew_tenant_fk', columns: [t.crewId, t.workspaceId], foreignColumns: [crews.id, crews.workspaceId] })
        .onDelete('cascade'),
    index('crew_assignments_project_idx').on(t.workspaceId, t.projectId, t.startDate),
    index('crew_assignments_crew_idx').on(t.workspaceId, t.crewId, t.startDate, t.endDate),
    check('crew_assignments_dates_check', sql`${t.startDate} <= ${t.endDate}`),
    check('crew_assignments_task_check', sql`${t.taskId} ~ '^[1-9]\\.[1-9][0-9]?$'`),
]);

/** The site supervisors (ผู้คุมงาน) of a project, in the order given. */
export const projectSupervisors = pgTable('project_supervisors', {
    projectId: uuid('project_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    personId: uuid('person_id').notNull(),
    position: integer('position').notNull(),
}, t => [
    primaryKey({ columns: [t.projectId, t.personId] }),
    tenantFk('project_supervisors', t),
    foreignKey({ name: 'project_supervisors_person_tenant_fk', columns: [t.personId, t.workspaceId], foreignColumns: [people.id, people.workspaceId] })
        .onDelete('cascade'),
    index('project_supervisors_person_idx').on(t.workspaceId, t.personId),
]);

/**
 * The waiting windows after planned tasks (W2, ช่วงรอ) a project changed from the defaults: at most one per task. Only
 * overrides are stored (the defaults live in src/domain/workforce/task-lags.ts).
 */
export const projectTaskLags = pgTable('project_task_lags', {
    projectId: uuid('project_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    taskId: text('task_id').notNull(),
    days: integer('days').notNull(),
    note: text('note'),
    updatedBy: uuid('updated_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    primaryKey({ columns: [t.projectId, t.taskId] }),
    tenantFk('project_task_lags', t),
    index('project_task_lags_workspace_idx').on(t.workspaceId, t.projectId),
    check('project_task_lags_days_check', sql`${t.days} between 0 and 90`),
    check('project_task_lags_task_check', sql`${t.taskId} ~ '^[1-9]\\.[1-9][0-9]?$'`),
    check('project_task_lags_note_check', sql`${t.note} is null or char_length(${t.note}) <= 200`),
]);

export const schema = {
    users, refreshTokens, workspaces, memberships, invitations, projects, projectDocs, projectRevisions,
    levelAssignments, activityLog, rateCards, people, crews, crewMembers, crewAssignments, projectSupervisors,
    projectTaskLags,
};
