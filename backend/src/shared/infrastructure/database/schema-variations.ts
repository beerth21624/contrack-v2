// ─── PostgreSQL tables: variation orders (module `variations`, WP-33, docs/erp/02-domain-model.md §5) ───
// Imports only schema.ts (core) and schema-helpers.ts. Add every table to `variationTables`; database.ts merges it and
// drizzle.config.ts lists this file for migrations. contract_id / cost_code_id / file_id point at other modules'
// tables: no FK (checked through ports, D-19).
import type { DocLanguage, QuotationCustomerSnapshot, VariationSandbox } from '@contrack/contract';
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, quantity, unitPrice, updatedAt } from './schema-helpers';

/** One variation order of a signed main contract. */
export const voVariations = pgTable('vo_variations', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    contractId: uuid('contract_id').notNull(),
    seqNo: integer('seq_no').notNull(),
    number: text('number'),
    title: text('title').notNull().default(''),
    reason: text('reason').notNull().default('owner_request'),
    requestedByName: text('requested_by_name').notNull().default(''),
    requestedDate: businessDate('requested_date'),
    status: text('status').notNull().default('draft'),
    sandbox: jsonb('sandbox').$type<VariationSandbox>().notNull().default({ calculators: {}, boqOverrides: {} }),
    costTotal: money('cost_total').notNull().default(0),
    sellTotal: money('sell_total').notNull().default(0),
    vat: money('vat').notNull().default(0),
    scheduleImpactDays: integer('schedule_impact_days').notNull().default(0),
    billing: text('billing').notNull(),
    language: text('language').$type<DocLanguage>().notNull().default('th'),
    customerSnapshot: jsonb('customer_snapshot').$type<QuotationCustomerSnapshot>(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedByName: text('accepted_by_name').notNull().default(''),
    responseNote: text('response_note').notNull().default(''),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('vo_variations', t),
    unique('vo_variations_contract_seq_key').on(t.contractId, t.seqNo),
    unique('vo_variations_workspace_number_key').on(t.workspaceId, t.number),
    index('vo_variations_workspace_project_idx').on(t.workspaceId, t.projectId),
    check('vo_variations_status_check',
        sql`${t.status} in ('draft', 'pending_approval', 'submitted', 'accepted', 'rejected', 'withdrawn', 'cancelled')`),
    check('vo_variations_reason_check', sql`${t.reason} in ('owner_request', 'design_change', 'site_condition', 'omission', 'other')`),
    check('vo_variations_billing_check', sql`${t.billing} in ('next_claim', 'spread', 'separate_milestone')`),
    check('vo_variations_language_check', sql`${t.language} in ('th', 'en')`),
]);

/** Lines of a VO; `cost_code_id` null = a new item (a `VO{seq}-{n}` cost code is made when accepted). */
export const voLines = pgTable('vo_lines', {
    id: uuid('id').primaryKey(),
    variationId: uuid('variation_id').notNull().references(() => voVariations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    costCodeId: uuid('cost_code_id'),
    sectionNo: integer('section_no').notNull(),
    lineKey: text('line_key'),
    descTh: text('desc_th').notNull().default(''),
    descEn: text('desc_en').notNull().default(''),
    unit: text('unit').notNull().default(''),
    qtyDelta: quantity('qty_delta').notNull(),
    costMatUnit: unitPrice('cost_mat_unit').notNull().default(0),
    costLabUnit: unitPrice('cost_lab_unit').notNull().default(0),
    costAmount: money('cost_amount').notNull(),
    sellUnit: unitPrice('sell_unit').notNull().default(0),
    sellAmount: money('sell_amount').notNull(),
    source: text('source').notNull().default('manual'),
    sort: integer('sort').notNull().default(0),
}, t => [
    index('vo_lines_variation_idx').on(t.variationId, t.sort),
    check('vo_lines_source_check', sql`${t.source} in ('manual', 'calculator')`),
]);

/** Evidence of who asked for the change and when (photos, documents, notes). */
export const voEvidence = pgTable('vo_evidence', {
    id: uuid('id').primaryKey(),
    variationId: uuid('variation_id').notNull().references(() => voVariations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    fileId: uuid('file_id'),
    note: text('note').notNull().default(''),
    takenAt: timestamp('taken_at', { withTimezone: true }),
    authorUserId: uuid('author_user_id').notNull(),
    createdAt: createdAt(),
}, t => [
    index('vo_evidence_variation_idx').on(t.variationId),
    check('vo_evidence_kind_check', sql`${t.kind} in ('photo', 'note', 'document')`),
]);

export const variationTables = { voVariations, voLines, voEvidence };
