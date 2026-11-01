// ─── PostgreSQL tables: site diary and labour (modules `site-diary` WP-42, `labour` WP-44, docs/erp/02-domain-model.md §8) ───
// Imports only schema.ts (core) and schema-helpers.ts. Add every table to `siteTables`; database.ts merges it and
// drizzle.config.ts lists this file for migrations. crew_id / supplier_id / cost_code_id / file_id point at other
// modules' tables: no FK (checked through ports, D-19).
import type {
    LabourPaymentMethod, PayPeriodStatus, SiteIssueKind, SiteIssueSeverity, SiteIssueStatus, SiteReportStatus, SiteWeather, TimesheetSource,
    TimesheetStatus, WageAdvanceStatus,
} from '@contrack/contract';
import { sql } from 'drizzle-orm';
import {
    boolean, check, foreignKey, index, integer, numeric, pgTable, primaryKey, text, timestamp, unique, uuid,
} from 'drizzle-orm/pg-core';
import { people, workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, quantity, rate, updatedAt } from './schema-helpers';

const hours = (name: string) => numeric(name, { precision: 4, scale: 1, mode: 'number' });

/** One daily report of a project. */
export const sdReports = pgTable('sd_reports', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    reportDate: businessDate('report_date').notNull(),
    status: text('status').$type<SiteReportStatus>().notNull().default('draft'),
    weatherMorning: text('weather_morning').$type<SiteWeather>(),
    weatherAfternoon: text('weather_afternoon').$type<SiteWeather>(),
    rainHours: hours('rain_hours').notNull().default(0),
    summary: text('summary').notNull().default(''),
    createdBy: uuid('created_by').notNull(),
    submittedBy: uuid('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('sd_reports', t),
    unique('sd_reports_project_date_key').on(t.projectId, t.reportDate),
    index('sd_reports_workspace_project_date_idx').on(t.workspaceId, t.projectId, t.reportDate),
    check('sd_reports_status_check', sql`${t.status} in ('draft', 'submitted')`),
    check('sd_reports_weather_morning_check', sql`${t.weatherMorning} in ('sunny', 'cloudy', 'rain', 'storm')`),
    check('sd_reports_weather_afternoon_check', sql`${t.weatherAfternoon} in ('sunny', 'cloudy', 'rain', 'storm')`),
]);

/** Crews / workers on site that day. */
export const sdManpower = pgTable('sd_manpower', {
    id: uuid('id').primaryKey(),
    reportId: uuid('report_id').notNull().references(() => sdReports.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    crewId: uuid('crew_id'),
    supplierId: uuid('supplier_id'),
    crewName: text('crew_name').notNull().default(''),
    trade: text('trade').notNull().default(''),
    skilledCount: integer('skilled_count').notNull().default(0),
    labourerCount: integer('labourer_count').notNull().default(0),
    hours: hours('hours').notNull().default(8),
    costCodeId: uuid('cost_code_id'),
    note: text('note').notNull().default(''),
    sort: integer('sort').notNull().default(0),
}, t => [
    index('sd_manpower_report_idx').on(t.reportId, t.sort),
]);

/** Work done on a cost code that day; `progress_after` is cumulative. */
export const sdWorkItems = pgTable('sd_work_items', {
    id: uuid('id').primaryKey(),
    reportId: uuid('report_id').notNull().references(() => sdReports.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    costCodeId: uuid('cost_code_id').notNull(),
    qtyDone: quantity('qty_done'),
    progressAfter: rate('progress_after').notNull(),
    note: text('note').notNull().default(''),
    sort: integer('sort').notNull().default(0),
}, t => [
    unique('sd_work_items_report_cost_code_key').on(t.reportId, t.costCodeId),
    index('sd_work_items_workspace_cost_code_idx').on(t.workspaceId, t.costCodeId),
]);

/** Photos of the day (`taken_at` from the phone). */
export const sdPhotos = pgTable('sd_photos', {
    id: uuid('id').primaryKey(),
    reportId: uuid('report_id').notNull().references(() => sdReports.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id').notNull(),
    takenAt: timestamp('taken_at', { withTimezone: true }),
    caption: text('caption').notNull().default(''),
    costCodeId: uuid('cost_code_id'),
    sort: integer('sort').notNull().default(0),
}, t => [
    index('sd_photos_report_idx').on(t.reportId, t.sort),
]);

/** Problems raised in a report; followed across days until resolved. */
export const sdIssues = pgTable('sd_issues', {
    id: uuid('id').primaryKey(),
    reportId: uuid('report_id').notNull().references(() => sdReports.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    kind: text('kind').$type<SiteIssueKind>().notNull(),
    severity: text('severity').$type<SiteIssueSeverity>().notNull().default('medium'),
    description: text('description').notNull(),
    status: text('status').$type<SiteIssueStatus>().notNull().default('open'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('sd_issues', t),
    index('sd_issues_report_idx').on(t.reportId),
    index('sd_issues_workspace_project_status_idx').on(t.workspaceId, t.projectId, t.status),
    check('sd_issues_kind_check', sql`${t.kind} in ('delay', 'safety', 'quality', 'material', 'weather', 'customer', 'other')`),
    check('sd_issues_severity_check', sql`${t.severity} in ('low', 'medium', 'high')`),
    check('sd_issues_status_check', sql`${t.status} in ('open', 'resolved')`),
]);

// ── Labour (WP-44, §8.2) ──

/** Half-month pay periods of a workspace (`2026-10-A` = 1–15, `2026-10-B` = 16–end of month). A row exists once built. */
export const lbPayPeriods = pgTable('lb_pay_periods', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    periodKey: text('period_key').notNull(),
    startDate: businessDate('start_date').notNull(),
    endDate: businessDate('end_date').notNull(),
    status: text('status').$type<PayPeriodStatus>().notNull().default('open'),
    gross: money('gross').notNull().default(0),
    advanceDeduction: money('advance_deduction').notNull().default(0),
    net: money('net').notNull().default(0),
    builtAt: timestamp('built_at', { withTimezone: true }),
    builtBy: uuid('built_by'),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    paidDate: businessDate('paid_date'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paidBy: uuid('paid_by'),
    paymentMethod: text('payment_method').$type<LabourPaymentMethod>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    unique('lb_pay_periods_key').on(t.workspaceId, t.periodKey),
    unique('lb_pay_periods_id_workspace_key').on(t.id, t.workspaceId),
    check('lb_pay_periods_status_check', sql`${t.status} in ('open', 'pending_approval', 'approved', 'paid')`),
    check('lb_pay_periods_key_check', sql`${t.periodKey} ~ '^[0-9]{4}-(0[1-9]|1[0-2])-[AB]$'`),
    check('lb_pay_periods_payment_method_check', sql`${t.paymentMethod} is null or ${t.paymentMethod} in ('cash', 'transfer')`),
]);

/** Days a person worked on a project (0.5 / 1 a day across all projects). `daily_wage` is a snapshot of people.daily_wage. */
export const lbTimesheetEntries = pgTable('lb_timesheet_entries', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    personId: uuid('person_id').notNull(),
    workDate: businessDate('work_date').notNull(),
    crewId: uuid('crew_id'),
    costCodeId: uuid('cost_code_id'),
    days: numeric('days', { precision: 3, scale: 2, mode: 'number' }).notNull(),
    otHours: numeric('ot_hours', { precision: 4, scale: 1, mode: 'number' }).notNull().default(0),
    dailyWage: money('daily_wage').notNull(),
    otRate: money('ot_rate').notNull(),
    amount: money('amount').notNull(),
    status: text('status').$type<TimesheetStatus>().notNull().default('draft'),
    /** The approval request that holds the entry while `timesheet.approve` is pending (subject id = this batch id). */
    approvalBatchId: uuid('approval_batch_id'),
    payPeriodId: uuid('pay_period_id').references(() => lbPayPeriods.id, { onDelete: 'set null' }),
    source: text('source').$type<TimesheetSource>().notNull().default('manual'),
    note: text('note').notNull().default(''),
    recordedBy: uuid('recorded_by').notNull(),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('lb_timesheet_entries', t),
    // No ON DELETE action: people are only ever archived (like crews_leader_tenant_fk).
    foreignKey({ name: 'lb_timesheet_entries_person_tenant_fk', columns: [t.personId, t.workspaceId], foreignColumns: [people.id, people.workspaceId] }),
    unique('lb_timesheet_entries_person_date_project_key').on(t.personId, t.workDate, t.projectId),
    index('lb_timesheet_entries_project_date_idx').on(t.workspaceId, t.projectId, t.workDate),
    index('lb_timesheet_entries_person_date_idx').on(t.workspaceId, t.personId, t.workDate),
    index('lb_timesheet_entries_workspace_date_idx').on(t.workspaceId, t.workDate, t.status),
    index('lb_timesheet_entries_period_idx').on(t.payPeriodId),
    index('lb_timesheet_entries_batch_idx').on(t.approvalBatchId),
    check('lb_timesheet_entries_days_check', sql`${t.days} in (0.5, 1)`),
    check('lb_timesheet_entries_ot_hours_check', sql`${t.otHours} between 0 and 24`),
    check('lb_timesheet_entries_status_check', sql`${t.status} in ('draft', 'approved', 'paid')`),
    check('lb_timesheet_entries_source_check', sql`${t.source} in ('manual', 'site_diary')`),
]);

/** One line per person of a built pay period. */
export const lbPayLines = pgTable('lb_pay_lines', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    periodId: uuid('period_id').notNull().references(() => lbPayPeriods.id, { onDelete: 'cascade' }),
    personId: uuid('person_id').notNull(),
    personName: text('person_name').notNull().default(''),
    days: numeric('days', { precision: 5, scale: 2, mode: 'number' }).notNull().default(0),
    otHours: numeric('ot_hours', { precision: 6, scale: 1, mode: 'number' }).notNull().default(0),
    gross: money('gross').notNull().default(0),
    advanceDeduction: money('advance_deduction').notNull().default(0),
    otherDeduction: money('other_deduction').notNull().default(0),
    net: money('net').notNull().default(0),
    paid: boolean('paid').notNull().default(false),
    note: text('note').notNull().default(''),
}, t => [
    unique('lb_pay_lines_period_person_key').on(t.periodId, t.personId),
    index('lb_pay_lines_workspace_person_idx').on(t.workspaceId, t.personId),
]);

/** Wage advances (เบิกล่วงหน้า), recovered from later pay periods oldest first. */
export const lbAdvances = pgTable('lb_advances', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    personId: uuid('person_id').notNull(),
    advanceDate: businessDate('advance_date').notNull(),
    amount: money('amount').notNull(),
    reason: text('reason').notNull().default(''),
    status: text('status').$type<WageAdvanceStatus>().notNull().default('open'),
    recoveredAmount: money('recovered_amount').notNull().default(0),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paidBy: uuid('paid_by'),
    paymentMethod: text('payment_method').$type<LabourPaymentMethod>(),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    foreignKey({ name: 'lb_advances_person_tenant_fk', columns: [t.personId, t.workspaceId], foreignColumns: [people.id, people.workspaceId] }),
    index('lb_advances_workspace_person_idx').on(t.workspaceId, t.personId, t.advanceDate),
    check('lb_advances_status_check', sql`${t.status} in ('open', 'partially_recovered', 'recovered', 'written_off')`),
    check('lb_advances_amount_check', sql`${t.amount} > 0 and ${t.recoveredAmount} >= 0 and ${t.recoveredAmount} <= ${t.amount}`),
    check('lb_advances_payment_method_check', sql`${t.paymentMethod} is null or ${t.paymentMethod} in ('cash', 'transfer')`),
]);

/** How much of an advance a pay line deducts. */
export const lbAdvanceRecoveries = pgTable('lb_advance_recoveries', {
    advanceId: uuid('advance_id').notNull().references(() => lbAdvances.id, { onDelete: 'cascade' }),
    payLineId: uuid('pay_line_id').notNull().references(() => lbPayLines.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    amount: money('amount').notNull(),
}, t => [
    primaryKey({ columns: [t.advanceId, t.payLineId] }),
    index('lb_advance_recoveries_line_idx').on(t.payLineId),
    check('lb_advance_recoveries_amount_check', sql`${t.amount} > 0`),
]);

export const siteTables = {
    sdReports, sdManpower, sdWorkItems, sdPhotos, sdIssues, lbPayPeriods, lbTimesheetEntries, lbPayLines, lbAdvances, lbAdvanceRecoveries,
};
