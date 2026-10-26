// ─── PostgreSQL tables: Subcontracting bidding (bids, negotiation messages, awards): owned by the bidding work stream ───
// Conventions as in schema.ts: uuid ids, created_at, every tenant-owned row carries its workspace id(s), repositories
// always filter by them. Tables of business modules use a prefix (sc_ = subcontracting). Add every table to the export
// object below; schema.ts merges it into the Drizzle schema and drizzle.config.ts lists this file for migrations.
// Package / invitation ids point at sourcing tables: no FK on purpose (each stream's file only references core tables).
import { sql } from 'drizzle-orm';
import {
    boolean, check, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import type { InstallmentDto } from '@contrack/contract';
import { users, workspaces } from './schema';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: 'number' });

/** One priced line of a bid (idx = position in the package version the bid was made for). */
export interface BidLineRow {
    idx: number;
    unitPrice: number | null;
    matUnitPrice: number | null;
    excluded: boolean;
    reason: string;
    total: number;
}

/**
 * Bids: one draft per invitation (version 0, status 'draft', autosaved) and the submitted versions (1, 2, …;
 * immutable except their status: submitted → superseded | withdrawn | selected | not_selected).
 */
export const scBids = pgTable('sc_bids', {
    id: uuid('id').primaryKey(),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    packageId: uuid('package_id').notNull(),
    invitationId: uuid('invitation_id').notNull(),
    vendorWorkspaceId: uuid('vendor_workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    packageVersion: integer('package_version').notNull(),
    version: integer('version').notNull(),
    status: text('status', { enum: ['draft', 'submitted', 'superseded', 'withdrawn', 'selected', 'not_selected'] }).notNull(),
    mode: text('mode', { enum: ['unit', 'lump'] }).notNull(),
    lines: jsonb('lines').$type<BidLineRow[]>().notNull(),
    lumpTotal: money('lump_total'),
    adjustment: money('adjustment').notNull().default(0),
    adjustmentNote: text('adjustment_note').notNull().default(''),
    inclusions: text('inclusions').notNull().default(''),
    total: money('total').notNull(),
    normalizedTotal: money('normalized_total').notNull(),
    days: integer('days'),
    earliestStart: date('earliest_start', { mode: 'string' }),
    crewSkilled: integer('crew_skilled'),
    crewLabourers: integer('crew_labourers'),
    validUntil: date('valid_until', { mode: 'string' }),
    installmentsProposal: jsonb('installments_proposal').$type<InstallmentDto[]>(),
    answers: jsonb('answers').$type<string[]>().notNull(),
    note: text('note').notNull().default(''),
    photoFileIds: jsonb('photo_file_ids').$type<string[]>().notNull(),
    enteredByBuyer: boolean('entered_by_buyer').notNull().default(false),
    submittedBy: uuid('submitted_by').references(() => users.id, { onDelete: 'set null' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    uniqueIndex('sc_bids_invitation_version_key').on(t.invitationId, t.version),
    index('sc_bids_package_idx').on(t.buyerWorkspaceId, t.packageId),
    index('sc_bids_vendor_idx').on(t.vendorWorkspaceId, t.status),
    check('sc_bids_status_check', sql`${t.status} in ('draft', 'submitted', 'superseded', 'withdrawn', 'selected', 'not_selected')`),
    check('sc_bids_mode_check', sql`${t.mode} in ('unit', 'lump')`),
    check('sc_bids_draft_version_check', sql`(${t.status} = 'draft') = (${t.version} = 0)`),
]);

/** Negotiation messages between the buyer and one invitee. `readAt`: when the other side read it. */
export const scMessages = pgTable('sc_messages', {
    id: uuid('id').primaryKey(),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    packageId: uuid('package_id').notNull(),
    invitationId: uuid('invitation_id').notNull(),
    sender: text('sender', { enum: ['buyer', 'vendor'] }).notNull(),
    authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    text: text('text').notNull(),
    targetTotal: money('target_total'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
}, t => [
    index('sc_messages_invitation_idx').on(t.invitationId, t.createdAt),
    check('sc_messages_sender_check', sql`${t.sender} in ('buyer', 'vendor')`),
]);

/** One award decision of a package: which line went to which bid. */
export const scAwards = pgTable('sc_awards', {
    id: uuid('id').primaryKey(),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    packageId: uuid('package_id').notNull(),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull(),
    allocations: jsonb('allocations').$type<{ idx: number; bidId: string }[]>().notNull(),
    installmentsFrom: jsonb('installments_from').$type<Record<string, 'package' | 'bid'>>().notNull(),
    subcontractIds: jsonb('subcontract_ids').$type<string[]>().notNull(),
    note: text('note').notNull().default(''),
    createdAt: createdAt(),
}, t => [index('sc_awards_package_idx').on(t.buyerWorkspaceId, t.packageId)]);

export const scBiddingTables = { scBids, scMessages, scAwards };
