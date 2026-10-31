// ─── PostgreSQL tables: suppliers and purchasing (module `procurement`, WP-37 … WP-41, docs/erp/02-domain-model.md §7) ───
// Imports only schema.ts (core) and schema-helpers.ts. Add every table to `procurementTables`; database.ts merges it and
// drizzle.config.ts lists this file for migrations. sc_vendor_list_entry_id / vendor_workspace_id / project_id of a rating
// point at other modules' rows: no FK (checked through ports, D-19).
import type {
    BankAccount, BudgetWarning, DocLanguage, PurchaseRequestSource, PurchaseRequestStatus, RfqQuoteLine, RfqStatus, RfqSupplierStatus,
    SupplierKind, SupplierWhtPreset, TradeId,
} from '@contrack/contract';
import { sql } from 'drizzle-orm';
import {
    boolean, check, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, quantity, unitPrice, updatedAt } from './schema-helpers';

// ── suppliers (WP-37, §7.1) ──

export const supSuppliers = pgTable('sup_suppliers', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<SupplierKind>().notNull().default('material'),
    nameTh: text('name_th').notNull().default(''),
    nameEn: text('name_en').notNull().default(''),
    taxId: text('tax_id').notNull().default(''),
    branchCode: text('branch_code').notNull().default(''),
    isJuristic: boolean('is_juristic').notNull().default(true),
    vatRegistered: boolean('vat_registered').notNull().default(true),
    addressTh: text('address_th').notNull().default(''),
    addressEn: text('address_en').notNull().default(''),
    contactName: text('contact_name').notNull().default(''),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    lineId: text('line_id').notNull().default(''),
    creditTermDays: integer('credit_term_days').notNull().default(30),
    defaultWhtPreset: text('default_wht_preset').$type<SupplierWhtPreset>().notNull().default('none'),
    bankAccounts: jsonb('bank_accounts').$type<BankAccount[]>().notNull().default([]),
    trades: jsonb('trades').$type<TradeId[]>().notNull().default([]),
    scVendorListEntryId: uuid('sc_vendor_list_entry_id'),
    vendorWorkspaceId: uuid('vendor_workspace_id'),
    rating: numeric('rating', { precision: 3, scale: 2, mode: 'number' }),
    ratingCount: integer('rating_count').notNull().default(0),
    note: text('note').notNull().default(''),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    /** Plain uuid: the user may be gone. */
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    index('sup_suppliers_workspace_archived_idx').on(t.workspaceId, t.archivedAt),
    uniqueIndex('sup_suppliers_tax_branch_key').on(t.workspaceId, t.taxId, t.branchCode).where(sql`${t.taxId} <> '' and ${t.archivedAt} is null`),
    uniqueIndex('sup_suppliers_sc_entry_key').on(t.workspaceId, t.scVendorListEntryId).where(sql`${t.scVendorListEntryId} is not null`),
    check('sup_suppliers_kind_check', sql`${t.kind} in ('material', 'subcontractor', 'service', 'equipment_rental', 'other')`),
    check('sup_suppliers_wht_preset_check',
        sql`${t.defaultWhtPreset} in ('none', 'government', 'transport', 'advertising', 'service', 'rent')`),
    check('sup_suppliers_name_check', sql`${t.nameTh} <> '' or ${t.nameEn} <> ''`),
]);

/** One score of a supplier (manual, or after a PO / goods receipt / subcontract). */
export const supRatings = pgTable('sup_ratings', {
    id: uuid('id').primaryKey(),
    supplierId: uuid('supplier_id').notNull().references(() => supSuppliers.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id'),
    sourceType: text('source_type').notNull().default('manual'),
    sourceId: uuid('source_id'),
    score: integer('score').notNull(),
    note: text('note').notNull().default(''),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
}, t => [
    index('sup_ratings_supplier_idx').on(t.supplierId, t.createdAt),
    check('sup_ratings_score_check', sql`${t.score} between 1 and 5`),
    check('sup_ratings_source_type_check', sql`${t.sourceType} in ('manual', 'purchase_order', 'goods_receipt', 'subcontract')`),
]);

// ── purchase requests and RFQs (WP-38, §7.2); cost_code_id points at boq-control: no FK (D-19) ──

/** A purchase request (PR) of a project: typed on site or picked from the cost codes. */
export const pcRequests = pgTable('pc_requests', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    number: text('number'),
    status: text('status').$type<PurchaseRequestStatus>().notNull().default('draft'),
    source: text('source').$type<PurchaseRequestSource>().notNull().default('site'),
    requiredDate: businessDate('required_date'),
    requestedBy: uuid('requested_by').notNull(),
    note: text('note').notNull().default(''),
    estTotal: money('est_total').notNull().default(0),
    budgetWarnings: jsonb('budget_warnings').$type<BudgetWarning[]>().notNull().default([]),
    overrideReason: text('override_reason').notNull().default(''),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('pc_requests', t),
    unique('pc_requests_workspace_number_key').on(t.workspaceId, t.number),
    index('pc_requests_workspace_project_idx').on(t.workspaceId, t.projectId),
    check('pc_requests_status_check', sql`${t.status} in ('draft', 'pending_approval', 'approved', 'rejected', 'partially_ordered', 'ordered', 'closed', 'cancelled')`),
    check('pc_requests_source_check', sql`${t.source} in ('site', 'boq')`),
]);

export const pcRequestLines = pgTable('pc_request_lines', {
    id: uuid('id').primaryKey(),
    requestId: uuid('request_id').notNull().references(() => pcRequests.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    costCodeId: uuid('cost_code_id'),
    descTh: text('desc_th').notNull().default(''),
    descEn: text('desc_en').notNull().default(''),
    unit: text('unit').notNull().default(''),
    qty: quantity('qty').notNull(),
    estUnitPrice: unitPrice('est_unit_price').notNull().default(0),
    estAmount: money('est_amount').notNull().default(0),
    orderedQty: quantity('ordered_qty').notNull().default(0),
    note: text('note').notNull().default(''),
    sort: integer('sort').notNull().default(0),
}, t => [
    index('pc_request_lines_request_idx').on(t.requestId, t.sort),
    index('pc_request_lines_cost_code_idx').on(t.workspaceId, t.costCodeId),
]);

/** A request for quotation sent to several suppliers (prices typed by the team when received). */
export const pcRfqs = pgTable('pc_rfqs', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    number: text('number'),
    status: text('status').$type<RfqStatus>().notNull().default('draft'),
    title: text('title').notNull().default(''),
    dueDate: businessDate('due_date'),
    deliveryAddress: text('delivery_address').notNull().default(''),
    language: text('language').$type<DocLanguage>().notNull().default('th'),
    requestIds: jsonb('request_ids').$type<string[]>().notNull().default([]),
    awardedSupplierId: uuid('awarded_supplier_id').references(() => supSuppliers.id),
    awardedAt: timestamp('awarded_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('pc_rfqs', t),
    unique('pc_rfqs_workspace_number_key').on(t.workspaceId, t.number),
    index('pc_rfqs_workspace_project_idx').on(t.workspaceId, t.projectId),
    check('pc_rfqs_status_check', sql`${t.status} in ('draft', 'sent', 'awarded', 'closed', 'cancelled')`),
    check('pc_rfqs_language_check', sql`${t.language} in ('th', 'en')`),
]);

export const pcRfqLines = pgTable('pc_rfq_lines', {
    id: uuid('id').primaryKey(),
    rfqId: uuid('rfq_id').notNull().references(() => pcRfqs.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    requestLineId: uuid('request_line_id').references(() => pcRequestLines.id, { onDelete: 'set null' }),
    costCodeId: uuid('cost_code_id'),
    descTh: text('desc_th').notNull().default(''),
    descEn: text('desc_en').notNull().default(''),
    unit: text('unit').notNull().default(''),
    qty: quantity('qty').notNull(),
    /** Unit price of a line nobody quotes in the normalized comparison (the PR's estimate). */
    budgetUnitPrice: unitPrice('budget_unit_price').notNull().default(0),
    sort: integer('sort').notNull().default(0),
}, t => [
    index('pc_rfq_lines_rfq_idx').on(t.rfqId, t.sort),
]);

export const pcRfqSuppliers = pgTable('pc_rfq_suppliers', {
    rfqId: uuid('rfq_id').notNull().references(() => pcRfqs.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id').notNull().references(() => supSuppliers.id),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    status: text('status').$type<RfqSupplierStatus>().notNull().default('invited'),
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
    quotedAt: timestamp('quoted_at', { withTimezone: true }),
}, t => [
    primaryKey({ name: 'pc_rfq_suppliers_pkey', columns: [t.rfqId, t.supplierId] }),
    check('pc_rfq_suppliers_status_check', sql`${t.status} in ('invited', 'quoted', 'declined')`),
]);

export const pcRfqQuotes = pgTable('pc_rfq_quotes', {
    id: uuid('id').primaryKey(),
    rfqId: uuid('rfq_id').notNull().references(() => pcRfqs.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id').notNull().references(() => supSuppliers.id),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    quoteRef: text('quote_ref').notNull().default(''),
    quoteDate: businessDate('quote_date'),
    validUntil: businessDate('valid_until'),
    pricesIncludeVat: boolean('prices_include_vat').notNull().default(false),
    deliveryDays: integer('delivery_days'),
    paymentTermDays: integer('payment_term_days'),
    lines: jsonb('lines').$type<RfqQuoteLine[]>().notNull().default([]),
    subtotal: money('subtotal').notNull().default(0),
    vat: money('vat').notNull().default(0),
    total: money('total').notNull().default(0),
    fileIds: jsonb('file_ids').$type<string[]>().notNull().default([]),
    note: text('note').notNull().default(''),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    unique('pc_rfq_quotes_rfq_supplier_key').on(t.rfqId, t.supplierId),
]);

export const procurementTables = { supSuppliers, supRatings, pcRequests, pcRequestLines, pcRfqs, pcRfqLines, pcRfqSuppliers, pcRfqQuotes };
