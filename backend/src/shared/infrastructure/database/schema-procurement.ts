// ─── PostgreSQL tables: suppliers and purchasing (module `procurement`, WP-37 … WP-41, docs/erp/02-domain-model.md §7) ───
// Imports only schema.ts (core) and schema-helpers.ts. Add every table to `procurementTables`; database.ts merges it and
// drizzle.config.ts lists this file for migrations. sc_vendor_list_entry_id / vendor_workspace_id / project_id of a rating
// point at other modules' rows: no FK (checked through ports, D-19).
import type { BankAccount, SupplierKind, SupplierWhtPreset, TradeId } from '@contrack/contract';
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { createdAt, updatedAt } from './schema-helpers';

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

export const procurementTables = { supSuppliers, supRatings };
