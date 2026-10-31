// ─── Column / constraint helpers for the ERP schema files (docs/erp/01-architecture.md §1.2) ───
// Every schema file may import this file and schema.ts (core), never another stream's file. No tables here.
import { date, foreignKey, numeric, timestamp } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { projects } from './schema';

/** `created_at timestamptz not null default now()`. */
export const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** `updated_at timestamptz not null default now()` (the repository sets it on every write). */
export const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/** Baht, 2 decimals (store round2 values only). */
export const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: 'number' });

/** Quantity, 4 decimals. */
export const quantity = (name: string) => numeric(name, { precision: 16, scale: 4, mode: 'number' });

/** Unit price, 4 decimals. */
export const unitPrice = (name: string) => numeric(name, { precision: 16, scale: 4, mode: 'number' });

/** Fraction: 0.05 = 5%. */
export const rate = (name: string) => numeric(name, { precision: 7, scale: 6, mode: 'number' });

/** Business date `YYYY-MM-DD` (no time zone). */
export const businessDate = (name: string) => date(name, { mode: 'string' });

/**
 * Composite FK (project_id, workspace_id) → projects(id, workspace_id), on delete cascade, named
 * `<table>_project_tenant_fk`: a row can only name a project of its own workspace.
 */
export function projectTenantFk(table: string, t: { projectId: AnyPgColumn; workspaceId: AnyPgColumn }) {
    return foreignKey({
        name: `${table}_project_tenant_fk`,
        columns: [t.projectId, t.workspaceId],
        foreignColumns: [projects.id, projects.workspaceId],
    }).onDelete('cascade');
}
