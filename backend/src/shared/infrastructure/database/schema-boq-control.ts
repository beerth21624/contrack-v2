// ─── PostgreSQL tables: BOQ control (module `boq-control`; versions in WP-17, baseline + cost codes in WP-18) ───
// docs/erp/02-domain-model.md §1.10. Imports only schema.ts (core) and schema-helpers.ts. Add every table to
// `boqControlTables`; database.ts merges it and drizzle.config.ts lists this file for migrations.
import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, numeric, pgTable, primaryKey, text, unique, uuid } from 'drizzle-orm/pg-core';
import { projectRevisions, workspaces } from './schema';
import { createdAt, money, projectTenantFk, quantity, unitPrice } from './schema-helpers';

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

export const boqControlTables = { boqVersions, boqVersionSections, boqVersionLines };
