// ─── PostgreSQL tables: quotations (module `quotations`, WP-23) ───
// docs/erp/02-domain-model.md §2. Imports only schema.ts (core) and schema-helpers.ts. Add every table to
// `quotationTables`; database.ts merges it and drizzle.config.ts lists this file for migrations.
// customer_id / boq_version_id point at other modules' tables: no FK (checked through CustomerLookup / BoqVersionSource).
import type {
    DocLanguage, MilestoneTemplateItem, QuotationCompanySnapshot, QuotationCustomerSnapshot, QuotationPricingDto,
} from '@contrack/contract';
import { sql } from 'drizzle-orm';
import {
    boolean, check, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, quantity, rate, unitPrice, updatedAt } from './schema-helpers';

/** `qt_quotation_versions.totals` (QuotationTotals of src/domain/quotation). */
export interface QuotationTotalsRow {
    cost: number;
    sell: number;
    discount: number;
    roundingAdj: number;
    vatBase: number;
    vat: number;
    grandTotal: number;
    marginAmount: number;
    marginPct: number;
}

const VERSION_STATUS_SQL = sql.raw(`'draft', 'pending_approval', 'issued', 'accepted', 'change_requested', 'rejected', 'expired', 'superseded', 'cancelled'`);

/** One quotation of a project (several per project: options A / B). */
export const qtQuotations = pgTable('qt_quotations', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    customerId: uuid('customer_id'),
    title: text('title').notNull().default(''),
    /** Base number, set when a version is issued the first time. */
    number: text('number'),
    currentVersionId: uuid('current_version_id'),
    acceptedVersionId: uuid('accepted_version_id'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('qt_quotations', t),
    index('qt_quotations_workspace_project_idx').on(t.workspaceId, t.projectId),
]);

export const qtQuotationVersions = pgTable('qt_quotation_versions', {
    id: uuid('id').primaryKey(),
    quotationId: uuid('quotation_id').notNull().references(() => qtQuotations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    versionNo: integer('version_no').notNull(),
    status: text('status').notNull().default('draft'),
    boqVersionId: uuid('boq_version_id'),
    format: text('format').notNull(),
    detailLevel: text('detail_level').notNull(),
    language: text('language').$type<DocLanguage>().notNull().default('th'),
    issueDate: businessDate('issue_date'),
    validUntil: businessDate('valid_until'),
    number: text('number'),
    customerSnapshot: jsonb('customer_snapshot').$type<QuotationCustomerSnapshot>(),
    companySnapshot: jsonb('company_snapshot').$type<QuotationCompanySnapshot>(),
    pricing: jsonb('pricing').$type<QuotationPricingDto>().notNull(),
    totals: jsonb('totals').$type<QuotationTotalsRow>().notNull(),
    paymentTerms: jsonb('payment_terms').$type<MilestoneTemplateItem[]>().notNull().default([]),
    termsTh: text('terms_th').notNull().default(''),
    termsEn: text('terms_en').notNull().default(''),
    note: text('note').notNull().default(''),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedByName: text('accepted_by_name').notNull().default(''),
    responseNote: text('response_note').notNull().default(''),
    issuedBy: uuid('issued_by'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('qt_quotation_versions', t),
    unique('qt_quotation_versions_quotation_version_no_key').on(t.quotationId, t.versionNo),
    uniqueIndex('qt_quotation_versions_one_draft_idx').on(t.quotationId).where(sql`${t.status} in ('draft', 'pending_approval')`),
    index('qt_quotation_versions_workspace_project_idx').on(t.workspaceId, t.projectId),
    index('qt_quotation_versions_status_valid_until_idx').on(t.status, t.validUntil),
    check('qt_quotation_versions_status_check', sql`${t.status} in (${VERSION_STATUS_SQL})`),
    check('qt_quotation_versions_format_check', sql`${t.format} in ('lump_sum_by_category', 'detailed', 'government')`),
    check('qt_quotation_versions_detail_level_check', sql`${t.detailLevel} in ('full', 'per_category', 'lump_sum')`),
    check('qt_quotation_versions_language_check', sql`${t.language} in ('th', 'en')`),
]);

export const qtQuotationSections = pgTable('qt_quotation_sections', {
    versionId: uuid('version_id').notNull(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    sectionNo: integer('section_no').notNull(),
    titleTh: text('title_th').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    included: boolean('included').notNull().default(true),
    sort: integer('sort').notNull(),
    costMat: money('cost_mat').notNull(),
    costLab: money('cost_lab').notNull(),
    costTotal: money('cost_total').notNull(),
    markupRate: rate('markup_rate').notNull(),
    overheadRate: rate('overhead_rate').notNull(),
    profitRate: rate('profit_rate').notNull(),
    vatRate: rate('vat_rate'),
    sellTotal: money('sell_total').notNull(),
}, t => [
    primaryKey({ name: 'qt_quotation_sections_pkey', columns: [t.versionId, t.sectionNo] }),
    foreignKey({ name: 'qt_quotation_sections_version_fk', columns: [t.versionId], foreignColumns: [qtQuotationVersions.id] }).onDelete('cascade'),
]);

export const qtQuotationLines = pgTable('qt_quotation_lines', {
    id: uuid('id').primaryKey(),
    versionId: uuid('version_id').notNull().references(() => qtQuotationVersions.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    sectionNo: integer('section_no').notNull(),
    sort: integer('sort').notNull(),
    kind: text('kind').notNull(),
    lineKey: text('line_key'),
    descTh: text('desc_th').notNull().default(''),
    descEn: text('desc_en').notNull().default(''),
    unit: text('unit').notNull().default(''),
    qty: quantity('qty').notNull(),
    costMatUnit: unitPrice('cost_mat_unit').notNull(),
    costLabUnit: unitPrice('cost_lab_unit').notNull(),
    costAmount: money('cost_amount').notNull(),
    sellMatUnit: unitPrice('sell_mat_unit').notNull(),
    sellLabUnit: unitPrice('sell_lab_unit').notNull(),
    sellUnit: unitPrice('sell_unit').notNull(),
    sellAmount: money('sell_amount').notNull(),
}, t => [
    index('qt_quotation_lines_version_idx').on(t.versionId, t.sort),
    check('qt_quotation_lines_kind_check', sql`${t.kind} in ('boq', 'custom', 'note')`),
]);

export const quotationTables = { qtQuotations, qtQuotationVersions, qtQuotationSections, qtQuotationLines };
