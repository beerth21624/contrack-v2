// ─── PostgreSQL tables: site diary and labour (modules `site-diary` WP-42, `labour` WP-44, docs/erp/02-domain-model.md §8) ───
// Imports only schema.ts (core) and schema-helpers.ts. Add every table to `siteTables`; database.ts merges it and
// drizzle.config.ts lists this file for migrations. crew_id / supplier_id / cost_code_id / file_id point at other
// modules' tables: no FK (checked through ports, D-19).
import type { SiteIssueKind, SiteIssueSeverity, SiteIssueStatus, SiteReportStatus, SiteWeather } from '@contrack/contract';
import { sql } from 'drizzle-orm';
import { check, index, integer, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { businessDate, createdAt, projectTenantFk, quantity, rate, updatedAt } from './schema-helpers';

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

export const siteTables = { sdReports, sdManpower, sdWorkItems, sdPhotos, sdIssues };
