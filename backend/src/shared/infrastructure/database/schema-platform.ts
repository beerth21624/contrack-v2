// ─── PostgreSQL tables: Platform (module switches, uploaded files, in-app notifications): owned by the platform work stream ───
// Conventions as in schema.ts: uuid ids, created_at, every tenant-owned row carries its workspace id(s), repositories
// always filter by them. Tables of business modules use a prefix (sc_ = subcontracting). Add every table to the export
// object below; schema.ts merges it into the Drizzle schema and drizzle.config.ts lists this file for migrations.
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users, workspaces } from './schema';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** A business module switched on/off by a workspace (no row = off). Switching off never deletes the module's data. */
export const workspaceModules = pgTable('workspace_modules', {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    module: text('module').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    /** Who last switched it (user ids stay plain uuids: the user may be gone). */
    enabledBy: uuid('enabled_by'),
    /** When it was last switched on (kept while off). */
    enabledAt: timestamp('enabled_at', { withTimezone: true }),
}, t => [primaryKey({ columns: [t.workspaceId, t.module] })]);

/** Uploaded / generated files; the bytes live in the file storage under `storage_key`. */
export const files = pgTable('files', {
    id: uuid('id').primaryKey(),
    uploadedBy: uuid('uploaded_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    /** Set when the file belongs to one workspace; null for uploads not tied to one (bid photos of a guest crew, …). */
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    purpose: text('purpose').notNull(),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    storageKey: text('storage_key').notNull(),
    createdAt: createdAt(),
}, t => [index('files_uploaded_by_idx').on(t.uploadedBy)]);

/** In-app notifications (the bell): one row per recipient user. */
export const notifications = pgTable('notifications', {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    template: text('template').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    href: text('href').notNull().default(''),
    payload: jsonb('payload').$type<Record<string, string | number>>().notNull().default({}),
    createdAt: createdAt(),
    readAt: timestamp('read_at', { withTimezone: true }),
}, t => [index('notifications_user_created_idx').on(t.userId, t.createdAt)]);

/** Outbox of messages for the other channels (SMS, LINE, e-mail), sent by the delivery worker. */
export const notificationDeliveries = pgTable('notification_deliveries', {
    id: uuid('id').primaryKey(),
    notificationId: uuid('notification_id').references(() => notifications.id, { onDelete: 'set null' }),
    channel: text('channel', { enum: ['sms', 'line', 'email'] }).notNull(),
    toAddress: text('to_address').notNull(),
    body: text('body').notNull(),
    status: text('status', { enum: ['queued', 'sent', 'failed'] }).notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: createdAt(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
}, t => [
    index('notification_deliveries_status_idx').on(t.status, t.createdAt),
    check('notification_deliveries_channel_check', sql`${t.channel} in ('sms', 'line', 'email')`),
    check('notification_deliveries_status_check', sql`${t.status} in ('queued', 'sent', 'failed')`),
]);

export const platformTables = { workspaceModules, files, notifications, notificationDeliveries };
