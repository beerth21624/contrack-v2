// ─── PostgreSQL tables: job cost and cash flow (module `job-cost`, WP-46 … WP-48, docs/erp/02-domain-model.md §9) ───
// Imports only schema.ts (core) and schema-helpers.ts. Add every table to `jobCostTables`; database.ts merges it and
// drizzle.config.ts lists this file for migrations. cost_code_id points at boq-control's project_cost_codes: no FK
// (checked through CostCodeLookup, D-19).
import type { JobCostAlertKind, JobCostAlertLevel, JobCostForecastMethod } from '@contrack/contract';
import { sql } from 'drizzle-orm';
import { check, index, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, quantity, unitPrice, updatedAt } from './schema-helpers';

/** Alert figures: money (EAC, budget) or a margin fraction, so 6 decimals. */
const figure = (name: string) => numeric(name, { precision: 20, scale: 6, mode: 'number' });

/** Forecast at completion per cost code (no row = `auto`). */
export const jcForecasts = pgTable('jc_forecasts', {
    projectId: uuid('project_id').notNull(),
    costCodeId: uuid('cost_code_id').notNull(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    method: text('method').$type<JobCostForecastMethod>().notNull().default('auto'),
    eac: money('eac').notNull().default(0),
    note: text('note').notNull().default(''),
    updatedBy: uuid('updated_by').notNull(),
    updatedAt: updatedAt(),
}, t => [
    primaryKey({ name: 'jc_forecasts_pkey', columns: [t.projectId, t.costCodeId] }),
    projectTenantFk('jc_forecasts', t),
    index('jc_forecasts_workspace_project_idx').on(t.workspaceId, t.projectId),
    check('jc_forecasts_method_check', sql`${t.method} in ('auto', 'manual')`),
]);

/** Cost / margin / cash alerts; one open row per (project, scope, kind), `resolved_at` set when it goes away. */
export const jcAlerts = pgTable('jc_alerts', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    costCodeId: uuid('cost_code_id'),
    /** = cost_code_id, or 'project'. */
    scopeKey: text('scope_key').notNull(),
    kind: text('kind').$type<JobCostAlertKind>().notNull(),
    level: text('level').$type<JobCostAlertLevel>().notNull(),
    value: figure('value').notNull(),
    threshold: figure('threshold').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
}, t => [
    projectTenantFk('jc_alerts', t),
    uniqueIndex('jc_alerts_open_key').on(t.projectId, t.scopeKey, t.kind).where(sql`${t.resolvedAt} is null`),
    index('jc_alerts_workspace_project_idx').on(t.workspaceId, t.projectId),
    check('jc_alerts_kind_check', sql`${t.kind} in ('cost_overrun', 'commitment_over_budget', 'negative_cash', 'margin_drop')`),
    check('jc_alerts_level_check', sql`${t.level} in ('warning', 'critical')`),
]);

/** Company cash settings for the cash projection (WP-47). */
export const jcCashSettings = pgTable('jc_cash_settings', {
    workspaceId: uuid('workspace_id').primaryKey().references(() => workspaces.id, { onDelete: 'cascade' }),
    openingBalance: money('opening_balance').notNull().default(0),
    asOf: businessDate('as_of').notNull(),
    minBalance: money('min_balance').notNull().default(0),
    updatedBy: uuid('updated_by').notNull(),
    updatedAt: updatedAt(),
});

/** Actual unit rates observed when a project closes (written by closeout, WP-55). */
export const jcUnitRates = pgTable('jc_unit_rates', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    lineKey: text('line_key').notNull(),
    descTh: text('desc_th').notNull().default(''),
    unit: text('unit').notNull().default(''),
    qty: quantity('qty').notNull().default(0),
    actualMatUnit: unitPrice('actual_mat_unit').notNull().default(0),
    actualLabUnit: unitPrice('actual_lab_unit').notNull().default(0),
    observedDate: businessDate('observed_date').notNull(),
    createdAt: createdAt(),
}, t => [
    projectTenantFk('jc_unit_rates', t),
    index('jc_unit_rates_workspace_line_key_observed_date_idx').on(t.workspaceId, t.lineKey, t.observedDate),
]);

export const jobCostTables = { jcForecasts, jcAlerts, jcCashSettings, jcUnitRates };
