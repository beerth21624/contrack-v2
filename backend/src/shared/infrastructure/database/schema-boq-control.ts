// ─── PostgreSQL tables: BOQ control (module `boq-control`; versions in WP-17, baseline + cost codes in WP-18) ───
// docs/erp/02-domain-model.md §1.10. Imports only schema.ts (core) and schema-helpers.ts. Add every table to
// `boqControlTables`; database.ts merges it and drizzle.config.ts lists this file for migrations.
import { sql } from 'drizzle-orm';
import {
    boolean, check, foreignKey, index, integer, numeric, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import { projectRevisions, workspaces } from './schema';
import { createdAt, money, projectTenantFk, quantity, rate, unitPrice, updatedAt } from './schema-helpers';

/** One row per `project_revisions` row: the BOQ lines of that snapshot, computed once. */
export const boqVersions = pgTable('boq_versions', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    revisionId: uuid('revision_id').notNull().references(() => projectRevisions.id, { onDelete: 'cascade' }),
    versionNo: integer('version_no').notNull(),
    kind: text('kind', { enum: ['snapshot', 'baseline'] }).notNull().default('snapshot'),
    engineVersion: text('engine_version').notNull(),
    constructionTotal: money('construction_total').notNull(),
    preConstructionTotal: money('pre_construction_total').notNull(),
    matTotal: money('mat_total').notNull(),
    labTotal: money('lab_total').notNull(),
    lineCount: integer('line_count').notNull(),
    /** Plain uuid: the user may be gone. */
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [
    projectTenantFk('boq_versions', t),
    unique('boq_versions_revision_id_key').on(t.revisionId),
    unique('boq_versions_project_version_no_key').on(t.projectId, t.versionNo),
    index('boq_versions_workspace_project_idx').on(t.workspaceId, t.projectId),
    check('boq_versions_kind_check', sql`${t.kind} in ('snapshot', 'baseline')`),
]);

export const boqVersionSections = pgTable('boq_version_sections', {
    versionId: uuid('version_id').notNull(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    sectionNo: integer('section_no').notNull(),
    titleTh: text('title_th').notNull(),
    inConstructionTotal: boolean('in_construction_total').notNull(),
    matTotal: money('mat_total').notNull(),
    labTotal: money('lab_total').notNull(),
    total: money('total').notNull(),
}, t => [
    primaryKey({ name: 'boq_version_sections_pkey', columns: [t.versionId, t.sectionNo] }),
    foreignKey({ name: 'boq_version_sections_version_fk', columns: [t.versionId], foreignColumns: [boqVersions.id] }).onDelete('cascade'),
]);

export const boqVersionLines = pgTable('boq_version_lines', {
    versionId: uuid('version_id').notNull(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    lineKey: text('line_key').notNull(),
    sectionNo: integer('section_no').notNull(),
    sort: integer('sort').notNull(),
    itemNo: text('item_no').notNull().default(''),
    descTh: text('desc_th').notNull(),
    unit: text('unit').notNull(),
    qty: quantity('qty').notNull(),
    grossQty: quantity('gross_qty'),
    /** Fraction like rate() but wider (a user override may exceed 999%). */
    waste: numeric('waste', { precision: 12, scale: 6, mode: 'number' }).notNull(),
    matUnit: unitPrice('mat_unit').notNull(),
    labUnit: unitPrice('lab_unit').notNull(),
    matTotal: money('mat_total').notNull(),
    labTotal: money('lab_total').notNull(),
    total: money('total').notNull(),
    materialBasis: text('material_basis').notNull(),
    labourBasis: text('labour_basis').notNull(),
}, t => [
    primaryKey({ name: 'boq_version_lines_pkey', columns: [t.versionId, t.lineKey] }),
    foreignKey({ name: 'boq_version_lines_version_fk', columns: [t.versionId], foreignColumns: [boqVersions.id] }).onDelete('cascade'),
]);

/** A locked BOQ version (WP-18): at most one `active` per project; unlocking keeps the row as history. */
export const projectBaselines = pgTable('project_baselines', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    versionId: uuid('version_id').notNull(),
    status: text('status', { enum: ['active', 'unlocked'] }).notNull(),
    reason: text('reason', { enum: ['contract_signed', 'manual'] }).notNull(),
    /** mc_contracts id (another stream: no FK, D-19). */
    contractId: uuid('contract_id'),
    lockedBy: uuid('locked_by').notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true }).notNull(),
    unlockedBy: uuid('unlocked_by'),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }),
    unlockReason: text('unlock_reason').notNull().default(''),
}, t => [
    projectTenantFk('project_baselines', t),
    foreignKey({ name: 'project_baselines_version_fk', columns: [t.versionId], foreignColumns: [boqVersions.id] }).onDelete('cascade'),
    uniqueIndex('project_baselines_active_key').on(t.projectId).where(sql`${t.status} = 'active'`),
    index('project_baselines_workspace_project_idx').on(t.workspaceId, t.projectId),
    check('project_baselines_status_check', sql`${t.status} in ('active', 'unlocked')`),
    check('project_baselines_reason_check', sql`${t.reason} in ('contract_signed', 'manual')`),
]);

/** Cost codes: the permanent id every ERP module refers to (one per baseline line, VO line or manual line). */
export const projectCostCodes = pgTable('project_cost_codes', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    code: text('code').notNull(),
    source: text('source', { enum: ['baseline', 'variation', 'manual'] }).notNull(),
    sourceRef: uuid('source_ref'),
    sectionNo: integer('section_no').notNull(),
    lineKey: text('line_key'),
    descTh: text('desc_th').notNull(),
    descEn: text('desc_en').notNull().default(''),
    unit: text('unit').notNull(),
    sort: integer('sort').notNull(),
    baselineQty: quantity('baseline_qty').notNull().default(0),
    baselineMatUnit: unitPrice('baseline_mat_unit').notNull().default(0),
    baselineLabUnit: unitPrice('baseline_lab_unit').notNull().default(0),
    baselineMat: money('baseline_mat').notNull().default(0),
    baselineLab: money('baseline_lab').notNull().default(0),
    baselineTotal: money('baseline_total').notNull().default(0),
    voQty: quantity('vo_qty').notNull().default(0),
    voCost: money('vo_cost').notNull().default(0),
    budgetTotal: money('budget_total').notNull().default(0),
    contractAmount: money('contract_amount').notNull().default(0),
    voContractAmount: money('vo_contract_amount').notNull().default(0),
    reportedProgress: rate('reported_progress').notNull().default(0),
    certifiedProgress: rate('certified_progress').notNull().default(0),
    status: text('status', { enum: ['active', 'omitted'] }).notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('project_cost_codes', t),
    unique('project_cost_codes_project_code_key').on(t.projectId, t.code),
    index('project_cost_codes_workspace_project_idx').on(t.workspaceId, t.projectId),
    check('project_cost_codes_source_check', sql`${t.source} in ('baseline', 'variation', 'manual')`),
    check('project_cost_codes_status_check', sql`${t.status} in ('active', 'omitted')`),
]);

export const boqControlTables = { boqVersions, boqVersionSections, boqVersionLines, projectBaselines, projectCostCodes };
