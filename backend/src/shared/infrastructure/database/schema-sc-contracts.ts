// ─── PostgreSQL tables: Subcontracting contracts (subcontracts, variations, claims, retention, ratings, settings): owned by the contracts work stream ───
// Conventions as in schema.ts: uuid ids, created_at, every tenant-owned row carries its workspace id(s), repositories
// always filter by them. Tables of business modules use a prefix (sc_ = subcontracting). Add every table to the export
// object below; schema.ts merges it into the Drizzle schema and drizzle.config.ts lists this file for migrations.
// Agreed facts (lines, prices, terms, installments) are snapshots in jsonb: a contract reads the same even when the
// BOQ, the package or the module changes. Package / bid / invitation ids point at other work streams' tables, so they
// carry no foreign key (only core tables are referenced).
import { sql } from 'drizzle-orm';
import {
    check, date, foreignKey, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import type {
    ClaimAmounts, InspectionResult, InstallmentDto, LocationDto, MaterialBy, ScheduleDto, SubcontractingSettingsDto,
    SubcontractTerms,
} from '@contrack/contract';
import { projects, workspaces } from './schema';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: 'number' });

export interface ScSubcontractLineJson {
    idx: number;
    lineKey: string | null;
    desc: string;
    unit: string;
    qty: number;
    unitPrice: number | null;
    matUnitPrice: number | null;
    total: number;
    materialBy: MaterialBy;
}

export interface ScInspectionJson {
    result: InspectionResult;
    checklist: { item: string; ok: boolean }[];
    fixes: { text: string; done: boolean }[];
    note: string;
    byUserId: string;
    byName: string;
    at: string;
}

export interface ScVariationLineJson {
    desc: string;
    unit: string;
    qty: number;
    unitPrice: number;
    total: number;
}

export const scSubcontracts = pgTable('sc_subcontracts', {
    id: uuid('id').primaryKey(),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull(),
    projectId: uuid('project_id').notNull(),
    packageId: uuid('package_id').notNull(),
    bidId: uuid('bid_id').notNull(),
    invitationId: uuid('invitation_id').notNull(),
    vendorListEntryId: uuid('vendor_list_entry_id').notNull(),
    /** null while the winner has no account (linked when the crew signs up). */
    vendorWorkspaceId: uuid('vendor_workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    vendorName: text('vendor_name').notNull(),
    buyerName: text('buyer_name').notNull(),
    projectName: text('project_name').notNull(),
    contractNo: text('contract_no').notNull(),
    year: integer('year').notNull(),
    seq: integer('seq').notNull(),
    title: text('title').notNull(),
    trade: text('trade').notNull(),
    location: jsonb('location').$type<LocationDto>().notNull(),
    lines: jsonb('lines').$type<ScSubcontractLineJson[]>().notNull(),
    baseTotal: money('base_total').notNull(),
    variationsTotal: money('variations_total').notNull(),
    total: money('total').notNull(),
    terms: jsonb('terms').$type<SubcontractTerms>().notNull(),
    schedule: jsonb('schedule').$type<ScheduleDto>().notNull(),
    installments: jsonb('installments').$type<InstallmentDto[]>().notNull(),
    documentVersion: integer('document_version').notNull(),
    signedScanFileId: uuid('signed_scan_file_id'),
    status: text('status', { enum: ['pending_acceptance', 'active', 'completed', 'closed', 'cancelled', 'terminated'] }).notNull(),
    acceptedBy: uuid('accepted_by'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedIp: text('accepted_ip'),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    terminatedAt: timestamp('terminated_at', { withTimezone: true }),
    endReason: text('end_reason'),
    /** Planned retention releases already reminded about (sc.retention_due is sent once). */
    retentionReminders: jsonb('retention_reminders').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    foreignKey({
        name: 'sc_subcontracts_project_tenant_fk',
        columns: [t.projectId, t.buyerWorkspaceId],
        foreignColumns: [projects.id, projects.workspaceId],
    }).onDelete('cascade'),
    uniqueIndex('sc_subcontracts_contract_no_key').on(t.buyerWorkspaceId, t.contractNo),
    index('sc_subcontracts_project_idx').on(t.buyerWorkspaceId, t.projectId),
    index('sc_subcontracts_vendor_idx').on(t.vendorWorkspaceId, t.status),
    index('sc_subcontracts_package_idx').on(t.packageId),
    index('sc_subcontracts_invitation_idx').on(t.invitationId),
    index('sc_subcontracts_status_idx').on(t.status),
    check('sc_subcontracts_status_check', sql`${t.status} in ('pending_acceptance', 'active', 'completed', 'closed', 'cancelled', 'terminated')`),
]);

/** Every version of the contract text (HTML, sanitized). The vendor accepts one version. */
export const scContractDocuments = pgTable('sc_contract_documents', {
    id: uuid('id').primaryKey(),
    subcontractId: uuid('subcontract_id').notNull().references(() => scSubcontracts.id, { onDelete: 'cascade' }),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    html: text('html').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [unique('sc_contract_documents_version_key').on(t.subcontractId, t.version)]);

/** The vendor asked for changes before accepting (resolved by the next document version). */
export const scChangeRequests = pgTable('sc_change_requests', {
    id: uuid('id').primaryKey(),
    subcontractId: uuid('subcontract_id').notNull().references(() => scSubcontracts.id, { onDelete: 'cascade' }),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    requestedBy: uuid('requested_by').notNull(),
    createdAt: createdAt(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, t => [index('sc_change_requests_subcontract_idx').on(t.subcontractId, t.createdAt)]);

export const scVariations = pgTable('sc_variations', {
    id: uuid('id').primaryKey(),
    subcontractId: uuid('subcontract_id').notNull().references(() => scSubcontracts.id, { onDelete: 'cascade' }),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    proposedBy: text('proposed_by', { enum: ['buyer', 'vendor'] }).notNull(),
    proposedByUser: uuid('proposed_by_user').notNull(),
    lines: jsonb('lines').$type<ScVariationLineJson[]>().notNull(),
    amount: money('amount').notNull(),
    reason: text('reason').notNull(),
    status: text('status', { enum: ['proposed', 'accepted', 'rejected'] }).notNull(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: createdAt(),
}, t => [
    index('sc_variations_subcontract_idx').on(t.subcontractId, t.createdAt),
    check('sc_variations_status_check', sql`${t.status} in ('proposed', 'accepted', 'rejected')`),
]);

export const scClaims = pgTable('sc_claims', {
    id: uuid('id').primaryKey(),
    subcontractId: uuid('subcontract_id').notNull().references(() => scSubcontracts.id, { onDelete: 'cascade' }),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    installmentNo: integer('installment_no').notNull(),
    condition: text('condition').notNull(),
    status: text('status', { enum: ['requested', 'inspected', 'approved', 'paid', 'rejected'] }).notNull(),
    requestedBy: text('requested_by', { enum: ['buyer', 'vendor'] }).notNull(),
    requestedByUser: uuid('requested_by_user').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    photoFileIds: jsonb('photo_file_ids').$type<string[]>().notNull(),
    note: text('note').notNull(),
    inspection: jsonb('inspection').$type<ScInspectionJson>(),
    grossAmount: money('gross_amount').notNull(),
    adjustments: jsonb('adjustments').$type<ClaimAmounts['adjustments']>().notNull(),
    retentionAmount: money('retention_amount').notNull(),
    whtAmount: money('wht_amount').notNull(),
    vatAmount: money('vat_amount').notNull(),
    netAmount: money('net_amount').notNull(),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    paidAt: date('paid_at', { mode: 'string' }),
    paidAmount: money('paid_amount'),
    paidChannel: text('paid_channel'),
    paidRef: text('paid_ref'),
    paidBy: uuid('paid_by'),
    rejectedReason: text('rejected_reason'),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    index('sc_claims_subcontract_idx').on(t.subcontractId, t.installmentNo),
    // One live (not rejected) claim per installment, whatever the race (plan rule 9).
    uniqueIndex('sc_claims_open_installment_key').on(t.subcontractId, t.installmentNo).where(sql`${t.status} <> 'rejected'`),
    check('sc_claims_status_check', sql`${t.status} in ('requested', 'inspected', 'approved', 'paid', 'rejected')`),
]);

export const scRetentionEntries = pgTable('sc_retention_entries', {
    id: uuid('id').primaryKey(),
    subcontractId: uuid('subcontract_id').notNull().references(() => scSubcontracts.id, { onDelete: 'cascade' }),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['withheld', 'released', 'forfeited'] }).notNull(),
    amount: money('amount').notNull(),
    claimId: uuid('claim_id').references(() => scClaims.id, { onDelete: 'set null' }),
    note: text('note').notNull(),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
}, t => [
    index('sc_retention_entries_subcontract_idx').on(t.subcontractId, t.createdAt),
    // A paid claim withholds its retention once.
    uniqueIndex('sc_retention_entries_claim_withheld_key').on(t.claimId).where(sql`${t.kind} = 'withheld'`),
    check('sc_retention_entries_kind_check', sql`${t.kind} in ('withheld', 'released', 'forfeited')`),
    check('sc_retention_entries_amount_check', sql`${t.amount} > 0`),
]);

export const scRatings = pgTable('sc_ratings', {
    id: uuid('id').primaryKey(),
    subcontractId: uuid('subcontract_id').notNull().references(() => scSubcontracts.id, { onDelete: 'cascade' }),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    fromSide: text('from_side', { enum: ['buyer', 'vendor'] }).notNull(),
    fromWorkspaceId: uuid('from_workspace_id').notNull(),
    toWorkspaceId: uuid('to_workspace_id'),
    scores: jsonb('scores').$type<Partial<Record<'quality' | 'time' | 'communication' | 'payment', number>>>().notNull(),
    comment: text('comment').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [
    unique('sc_ratings_side_key').on(t.subcontractId, t.fromSide),
    index('sc_ratings_buyer_idx').on(t.buyerWorkspaceId, t.toWorkspaceId),
]);

/** Last contract sequence number per buyer workspace and year (SC-2026-0001): the row is the lock that numbers awards. */
export const scContractCounters = pgTable('sc_contract_counters', {
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    seq: integer('seq').notNull(),
}, t => [primaryKey({ name: 'sc_contract_counters_pkey', columns: [t.buyerWorkspaceId, t.year] })]);

/** Module settings of a workspace (missing row = DEFAULT_SUBCONTRACTING_SETTINGS). */
export const scSettings = pgTable('sc_settings', {
    workspaceId: uuid('workspace_id').primaryKey().references(() => workspaces.id, { onDelete: 'cascade' }),
    data: jsonb('data').$type<SubcontractingSettingsDto>().notNull(),
    updatedBy: uuid('updated_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const scContractsTables = {
    scSubcontracts, scContractDocuments, scChangeRequests, scVariations, scClaims, scRetentionEntries, scRatings, scContractCounters,
    scSettings,
};
