// ─── PostgreSQL tables: main contracts (module `contracts`, WP-26) and later billing (`ar_*`, WP-29/30) ───
// docs/erp/02-domain-model.md §3–§4. Imports only schema.ts (core) and schema-helpers.ts. Add every table to
// `contractsBillingTables`; database.ts merges it and drizzle.config.ts lists this file for migrations.
// customer_id / quotation ids / cost code ids point at other modules' tables: no FK (checked through ports, D-19).
import type {
    DocLanguage, InvoiceLine, MainContractTerms, QuotationCompanySnapshot, QuotationCustomerSnapshot,
} from '@contrack/contract';
import { sql } from 'drizzle-orm';
import {
    boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, quantity, rate, updatedAt } from './schema-helpers';

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

// ── Billing (module `billing`, WP-29; docs/erp/02-domain-model.md §4) ──

/** Progress claims (งวดเบิก) of a main contract; one open (draft / pending_approval / submitted) per contract. */
export const arClaims = pgTable('ar_claims', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    contractId: uuid('contract_id').notNull().references(() => mcContracts.id, { onDelete: 'cascade' }),
    milestoneId: uuid('milestone_id'),
    mode: text('mode').notNull(),
    claimNo: integer('claim_no').notNull(),
    periodFrom: businessDate('period_from'),
    periodTo: businessDate('period_to'),
    status: text('status').notNull().default('draft'),
    workValue: money('work_value').notNull().default(0),
    cumulativeValue: money('cumulative_value').notNull().default(0),
    previousValue: money('previous_value').notNull().default(0),
    isFinal: boolean('is_final').notNull().default(false),
    advanceRecovery: money('advance_recovery').notNull().default(0),
    retention: money('retention').notNull().default(0),
    penalty: money('penalty').notNull().default(0),
    penaltyDays: integer('penalty_days').notNull().default(0),
    penaltyOverride: money('penalty_override'),
    penaltyMax: money('penalty_max').notNull().default(0),
    escalation: money('escalation').notNull().default(0),
    escalationK: quantity('escalation_k'),
    escalationIndices: jsonb('escalation_indices').$type<Record<string, number>>().notNull().default({}),
    otherDeduction: money('other_deduction').notNull().default(0),
    otherDeductionNote: text('other_deduction_note').notNull().default(''),
    vatBase: money('vat_base').notNull().default(0),
    vat: money('vat').notNull().default(0),
    wht: money('wht').notNull().default(0),
    payable: money('payable').notNull().default(0),
    certifiedByName: text('certified_by_name').notNull().default(''),
    certifiedAt: businessDate('certified_at'),
    certifiedNote: text('certified_note').notNull().default(''),
    invoiceId: uuid('invoice_id'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('ar_claims', t),
    unique('ar_claims_contract_no_key').on(t.contractId, t.claimNo),
    uniqueIndex('ar_claims_one_open_idx').on(t.contractId).where(sql`${t.status} in ('draft', 'pending_approval', 'submitted')`),
    index('ar_claims_workspace_project_idx').on(t.workspaceId, t.projectId),
    check('ar_claims_status_check', sql`${t.status} in ('draft', 'pending_approval', 'submitted', 'certified', 'invoiced', 'cancelled')`),
    check('ar_claims_mode_check', sql`${t.mode} in ('milestone', 'progress')`),
]);

/** One line per cost code of a claim (cumulative progress → amounts). */
export const arClaimLines = pgTable('ar_claim_lines', {
    claimId: uuid('claim_id').notNull().references(() => arClaims.id, { onDelete: 'cascade' }),
    costCodeId: uuid('cost_code_id').notNull(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    contractAmount: money('contract_amount').notNull(),
    prevProgress: rate('prev_progress').notNull().default(0),
    cumProgress: rate('cum_progress').notNull().default(0),
    prevAmount: money('prev_amount').notNull().default(0),
    cumAmount: money('cum_amount').notNull().default(0),
    thisAmount: money('this_amount').notNull().default(0),
    note: text('note').notNull().default(''),
}, t => [
    primaryKey({ name: 'ar_claim_lines_pkey', columns: [t.claimId, t.costCodeId] }),
]);

/** Invoices to the customer (claim / advance / retention release; tax invoices and credit notes in WP-30). */
export const arInvoices = pgTable('ar_invoices', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id'),
    contractId: uuid('contract_id').references(() => mcContracts.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id'),
    milestoneId: uuid('milestone_id'),
    customerId: uuid('customer_id').notNull(),
    kind: text('kind').notNull(),
    source: text('source').notNull(),
    number: text('number'),
    status: text('status').notNull().default('draft'),
    issueDate: businessDate('issue_date').notNull(),
    dueDate: businessDate('due_date').notNull(),
    language: text('language').$type<DocLanguage>().notNull().default('th'),
    customerSnapshot: jsonb('customer_snapshot').$type<QuotationCustomerSnapshot>(),
    companySnapshot: jsonb('company_snapshot').$type<QuotationCompanySnapshot>(),
    lines: jsonb('lines').$type<InvoiceLine[]>().notNull().default([]),
    net: money('net').notNull().default(0),
    vat: money('vat').notNull().default(0),
    total: money('total').notNull().default(0),
    retention: money('retention').notNull().default(0),
    advanceRecovery: money('advance_recovery').notNull().default(0),
    penalty: money('penalty').notNull().default(0),
    whtExpected: money('wht_expected').notNull().default(0),
    payable: money('payable').notNull().default(0),
    paidAmount: money('paid_amount').notNull().default(0),
    relatedInvoiceId: uuid('related_invoice_id'),
    note: text('note').notNull().default(''),
    voidReason: text('void_reason').notNull().default(''),
    issuedBy: uuid('issued_by'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('ar_invoices', t),
    unique('ar_invoices_workspace_number_key').on(t.workspaceId, t.number),
    index('ar_invoices_workspace_project_idx').on(t.workspaceId, t.projectId),
    index('ar_invoices_contract_idx').on(t.contractId),
    index('ar_invoices_workspace_status_due_idx').on(t.workspaceId, t.status, t.dueDate),
    check('ar_invoices_kind_check', sql`${t.kind} in ('advance_invoice', 'invoice', 'tax_invoice', 'credit_note')`),
    check('ar_invoices_source_check', sql`${t.source} in ('claim', 'advance', 'retention_release', 'receipt')`),
    check('ar_invoices_status_check', sql`${t.status} in ('draft', 'issued', 'partially_paid', 'paid', 'voided')`),
    check('ar_invoices_language_check', sql`${t.language} in ('th', 'en')`),
]);

/** Customer retention ledger of a contract (balance always derived from it). */
export const arRetentionEntries = pgTable('ar_retention_entries', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    contractId: uuid('contract_id').notNull().references(() => mcContracts.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    kind: text('kind').notNull(),
    amount: money('amount').notNull(),
    claimId: uuid('claim_id'),
    invoiceId: uuid('invoice_id'),
    entryDate: businessDate('entry_date').notNull(),
    note: text('note').notNull().default(''),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [
    projectTenantFk('ar_retention_entries', t),
    index('ar_retention_entries_contract_idx').on(t.contractId),
    uniqueIndex('ar_retention_entries_claim_withheld_idx').on(t.claimId).where(sql`${t.kind} = 'withheld'`),
    check('ar_retention_entries_kind_check', sql`${t.kind} in ('withheld', 'released', 'forfeited')`),
]);

/** Customer advance payment ledger of a contract (received by receipts, WP-30; recovered by claims). */
export const arAdvanceEntries = pgTable('ar_advance_entries', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    contractId: uuid('contract_id').notNull().references(() => mcContracts.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    kind: text('kind').notNull(),
    amount: money('amount').notNull(),
    invoiceId: uuid('invoice_id'),
    claimId: uuid('claim_id'),
    entryDate: businessDate('entry_date').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [
    projectTenantFk('ar_advance_entries', t),
    index('ar_advance_entries_contract_idx').on(t.contractId),
    check('ar_advance_entries_kind_check', sql`${t.kind} in ('received', 'recovered')`),
]);

export const contractsBillingTables = {
    mcContracts, mcMilestones, mcGuarantees, arClaims, arClaimLines, arInvoices, arRetentionEntries, arAdvanceEntries,
};
