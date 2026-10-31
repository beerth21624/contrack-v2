// ─── PostgreSQL tables: cost ledger + financial events (ERP foundation `ledger`, WP-20) ───
// docs/erp/02-domain-model.md §1.11. Append-only: never updated; a correction is a new row whose `reverses_id` names
// the original (partial unique: one reversal per row). Imports only schema.ts (core) and schema-helpers.ts.
import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, quantity } from './schema-helpers';

export const costLedgerEntries = pgTable('cost_ledger_entries', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    /** project_cost_codes id (another stream: no FK, checked through CostCodeLookup); null = overhead. */
    costCodeId: uuid('cost_code_id'),
    entryDate: businessDate('entry_date').notNull(),
    kind: text('kind', { enum: ['commit', 'commit_release', 'actual'] }).notNull(),
    category: text('category', { enum: ['material', 'labour', 'subcontract', 'equipment', 'other'] }).notNull(),
    /** Signed, without VAT. */
    amount: money('amount').notNull(),
    qty: quantity('qty'),
    sourceType: text('source_type').notNull(),
    sourceId: uuid('source_id').notNull(),
    sourceLineId: uuid('source_line_id'),
    /** The PO / contract line a commit opens and a commit_release frees. */
    commitmentRef: uuid('commitment_ref'),
    reversesId: uuid('reverses_id'),
    note: text('note').notNull().default(''),
    /** Plain uuid: the user may be gone. */
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [
    projectTenantFk('cost_ledger_entries', t),
    index('cost_ledger_entries_workspace_project_cost_code_idx').on(t.workspaceId, t.projectId, t.costCodeId),
    index('cost_ledger_entries_workspace_source_idx').on(t.workspaceId, t.sourceType, t.sourceId),
    index('cost_ledger_entries_workspace_commitment_ref_idx').on(t.workspaceId, t.commitmentRef).where(sql`${t.commitmentRef} is not null`),
    uniqueIndex('cost_ledger_entries_reverses_id_key').on(t.reversesId).where(sql`${t.reversesId} is not null`),
    check('cost_ledger_entries_kind_check', sql`${t.kind} in ('commit', 'commit_release', 'actual')`),
    check('cost_ledger_entries_category_check', sql`${t.category} in ('material', 'labour', 'subcontract', 'equipment', 'other')`),
]);

const FIN_EVENT_TYPES_SQL = sql.raw([
    'ar.advance_invoiced', 'ar.invoiced', 'ar.tax_invoiced', 'ar.credit_noted', 'ar.receipt', 'ar.wht_withheld_by_customer',
    'ar.retention_withheld', 'ar.retention_released', 'ar.advance_recovered', 'ar.penalty',
    'ap.bill_posted', 'ap.payment', 'ap.wht_withheld', 'ap.retention_withheld', 'ap.retention_released',
    'lb.wages_paid', 'lb.advance_paid', 'lb.advance_recovered', 'sc.claim_paid',
].map(v => `'${v}'`).join(', '));

/** Every money event of the workspace (ready to become GL journals later, 01-architecture §12.4). */
export const finEvents = pgTable('fin_events', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    /** No FK: the row outlives nothing (a project with events cannot be deleted: ProjectDeletionGuards). */
    projectId: uuid('project_id'),
    eventDate: businessDate('event_date').notNull(),
    eventType: text('event_type').notNull(),
    direction: text('direction', { enum: ['in', 'out', 'none'] }).notNull(),
    counterpartyType: text('counterparty_type', { enum: ['customer', 'supplier', 'subcontractor', 'worker', 'government', 'other'] }).notNull(),
    counterpartyId: uuid('counterparty_id'),
    counterpartyName: text('counterparty_name').notNull(),
    counterpartyTaxId: text('counterparty_tax_id').notNull().default(''),
    counterpartyBranch: text('counterparty_branch').notNull().default(''),
    docType: text('doc_type'),
    docNumber: text('doc_number'),
    docDate: businessDate('doc_date'),
    sourceType: text('source_type').notNull(),
    sourceId: uuid('source_id').notNull(),
    net: money('net').notNull(),
    vat: money('vat').notNull(),
    wht: money('wht').notNull(),
    retention: money('retention').notNull(),
    cash: money('cash').notNull(),
    reversesId: uuid('reverses_id'),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [
    index('fin_events_workspace_date_idx').on(t.workspaceId, t.eventDate),
    index('fin_events_workspace_project_date_idx').on(t.workspaceId, t.projectId, t.eventDate),
    index('fin_events_workspace_type_date_idx').on(t.workspaceId, t.eventType, t.eventDate),
    index('fin_events_workspace_source_idx').on(t.workspaceId, t.sourceType, t.sourceId),
    uniqueIndex('fin_events_reverses_id_key').on(t.reversesId).where(sql`${t.reversesId} is not null`),
    check('fin_events_event_type_check', sql`${t.eventType} in (${FIN_EVENT_TYPES_SQL})`),
    check('fin_events_direction_check', sql`${t.direction} in ('in', 'out', 'none')`),
    check('fin_events_counterparty_type_check',
        sql`${t.counterpartyType} in ('customer', 'supplier', 'subcontractor', 'worker', 'government', 'other')`),
]);

export const ledgerTables = { costLedgerEntries, finEvents };
