// ─── PostgreSQL tables: main contracts (module `contracts`, WP-26) and later billing (`ar_*`, WP-29/30) ───
// docs/erp/02-domain-model.md §3–§4. Imports only schema.ts (core) and schema-helpers.ts. Add every table to
// `contractsBillingTables`; database.ts merges it and drizzle.config.ts lists this file for migrations.
// customer_id / quotation ids / cost code ids point at other modules' tables: no FK (checked through ports, D-19).
import type {
    DocLanguage, MainContractTerms, QuotationCompanySnapshot, QuotationCustomerSnapshot,
} from '@contrack/contract';
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, rate, updatedAt } from './schema-helpers';

/** One contract with the project owner; one effective (not cancelled / terminated) per project. */
export const mcContracts = pgTable('mc_contracts', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    quotationId: uuid('quotation_id'),
    quotationVersionId: uuid('quotation_version_id'),
    quotedMarginPct: rate('quoted_margin_pct'),
    number: text('number'),
    status: text('status').notNull().default('draft'),
    title: text('title').notNull().default(''),
    language: text('language').$type<DocLanguage>().notNull().default('th'),
    signDate: businessDate('sign_date'),
    startDate: businessDate('start_date'),
    finishDate: businessDate('finish_date'),
    durationDays: integer('duration_days'),
    billingMode: text('billing_mode').notNull().default('milestone'),
    originalValue: money('original_value').notNull(),
    currentValue: money('current_value').notNull(),
    vatRate: rate('vat_rate').notNull(),
    extensionDays: integer('extension_days').notNull().default(0),
    terms: jsonb('terms').$type<MainContractTerms>().notNull(),
    bodyTh: text('body_th').notNull().default(''),
    bodyEn: text('body_en').notNull().default(''),
    customerSnapshot: jsonb('customer_snapshot').$type<QuotationCustomerSnapshot>(),
    companySnapshot: jsonb('company_snapshot').$type<QuotationCompanySnapshot>(),
    signedScanFileIds: jsonb('signed_scan_file_ids').$type<string[]>().notNull().default([]),
    completedAt: businessDate('completed_at'),
    closedAt: businessDate('closed_at'),
    terminatedAt: businessDate('terminated_at'),
    terminationReason: text('termination_reason').notNull().default(''),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('mc_contracts', t),
    uniqueIndex('mc_contracts_one_effective_idx').on(t.projectId).where(sql`${t.status} not in ('cancelled', 'terminated')`),
    unique('mc_contracts_workspace_number_key').on(t.workspaceId, t.number),
    index('mc_contracts_workspace_project_idx').on(t.workspaceId, t.projectId),
    check('mc_contracts_status_check', sql`${t.status} in ('draft', 'signed', 'completed', 'closed', 'cancelled', 'terminated')`),
    check('mc_contracts_billing_mode_check', sql`${t.billingMode} in ('milestone', 'progress')`),
    check('mc_contracts_language_check', sql`${t.language} in ('th', 'en')`),
]);

/** Payment milestones (installments) of a contract. `no` 0 = the advance payment. */
export const mcMilestones = pgTable('mc_milestones', {
    id: uuid('id').primaryKey(),
    contractId: uuid('contract_id').notNull().references(() => mcContracts.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    no: integer('no').notNull(),
    labelTh: text('label_th').notNull().default(''),
    labelEn: text('label_en').notNull().default(''),
    kind: text('kind').notNull(),
    pct: rate('pct').notNull(),
    amount: money('amount').notNull(),
    trigger: text('trigger').notNull(),
    triggerProgress: rate('trigger_progress'),
    dueDate: businessDate('due_date'),
    costCodeIds: jsonb('cost_code_ids').$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('planned'),
    source: text('source').notNull().default('contract'),
    variationId: uuid('variation_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('mc_milestones', t),
    unique('mc_milestones_contract_no_key').on(t.contractId, t.no),
    index('mc_milestones_workspace_project_idx').on(t.workspaceId, t.projectId),
    check('mc_milestones_kind_check', sql`${t.kind} in ('advance', 'work', 'final')`),
    check('mc_milestones_trigger_check', sql`${t.trigger} in ('signing', 'progress', 'date', 'handover', 'manual')`),
    check('mc_milestones_status_check', sql`${t.status} in ('planned', 'claimable', 'claimed', 'invoiced', 'paid')`),
    check('mc_milestones_source_check', sql`${t.source} in ('contract', 'variation')`),
]);

/** Guarantees (bank guarantees, cash, cheques, bonds) the contractor placed for a contract. */
export const mcGuarantees = pgTable('mc_guarantees', {
    id: uuid('id').primaryKey(),
    contractId: uuid('contract_id').notNull().references(() => mcContracts.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    kind: text('kind').notNull(),
    form: text('form').notNull(),
    issuer: text('issuer').notNull().default(''),
    refNo: text('ref_no').notNull().default(''),
    amount: money('amount').notNull(),
    issueDate: businessDate('issue_date'),
    expiryDate: businessDate('expiry_date'),
    status: text('status').notNull().default('active'),
    returnedAt: businessDate('returned_at'),
    fileIds: jsonb('file_ids').$type<string[]>().notNull().default([]),
    note: text('note').notNull().default(''),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('mc_guarantees', t),
    index('mc_guarantees_contract_idx').on(t.contractId),
    index('mc_guarantees_status_expiry_idx').on(t.status, t.expiryDate),
    check('mc_guarantees_kind_check', sql`${t.kind} in ('performance', 'advance_payment', 'warranty')`),
    check('mc_guarantees_form_check', sql`${t.form} in ('bank_guarantee', 'cash', 'cheque', 'bond')`),
    check('mc_guarantees_status_check', sql`${t.status} in ('active', 'returned', 'claimed', 'expired')`),
]);

export const contractsBillingTables = { mcContracts, mcMilestones, mcGuarantees };
