// ─── PostgreSQL tables: Subcontracting sourcing (vendor profiles, vendor lists, packages, invitations, questions): owned by the sourcing work stream ───
// Conventions as in schema.ts: uuid ids, created_at, every tenant-owned row carries its workspace id(s), repositories
// always filter by them. Tables of business modules use a prefix (sc_ = subcontracting). Add every table to the export
// object below; schema.ts merges it into the Drizzle schema and drizzle.config.ts lists this file for migrations.
// Lines, terms and estimates are snapshots in jsonb (plan §8): a package reads the same after the BOQ changes.
import { sql } from 'drizzle-orm';
import {
    boolean, check, foreignKey, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import type {
    DeclineReason, InstallmentDto, InvitationStatus, InviteChannel, LocationDto, MaterialBy, PackageStatus, PackageTerms,
    PricingMode, ScheduleDto, SourcingMode, SupplyMode, TradeId, VendorTier,
} from '@contrack/contract';
import type { CustomLine, SnapshotLine } from '@contrack/domain/subcontracting';
import { projects, users, workspaces } from './schema';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

// ── vendor side (owned by the crew's workspace) ──

export const scVendorProfiles = pgTable('sc_vendor_profiles', {
    workspaceId: uuid('workspace_id').primaryKey().references(() => workspaces.id, { onDelete: 'cascade' }),
    teamName: text('team_name').notNull(),
    contactName: text('contact_name').notNull(),
    /** E.164, verified by OTP; '' when created without a phone sign-in. */
    phone: text('phone').notNull().default(''),
    lineUserId: text('line_user_id'),
    trades: jsonb('trades').$type<TradeId[]>().notNull(),
    provinces: jsonb('provinces').$type<string[]>().notNull(),
    crewSkilled: integer('crew_skilled'),
    crewLabourers: integer('crew_labourers'),
    tools: jsonb('tools').$type<string[]>().notNull(),
    vatRegistered: boolean('vat_registered').notNull().default(false),
    referenceRates: jsonb('reference_rates').$type<{ trade: TradeId; label: string; unit: string; rate: number }[]>().notNull(),
    availableMonths: jsonb('available_months').$type<string[]>().notNull(),
    tier: text('tier', { enum: ['L0', 'L1', 'L2', 'L3'] }).$type<VendorTier>().notNull(),
    tierUpdatedAt: ts('tier_updated_at').notNull(),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
}, t => [
    index('sc_vendor_profiles_phone_idx').on(t.phone),
    check('sc_vendor_profiles_tier_check', sql`${t.tier} in ('L0', 'L1', 'L2', 'L3')`),
]);

export const scVendorPortfolio = pgTable('sc_vendor_portfolio', {
    id: uuid('id').primaryKey(),
    vendorWorkspaceId: uuid('vendor_workspace_id').notNull().references(() => scVendorProfiles.workspaceId, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    trade: text('trade').$type<TradeId>().notNull(),
    year: integer('year'),
    district: text('district').notNull().default(''),
    province: text('province').notNull().default(''),
    photoFileIds: jsonb('photo_file_ids').$type<string[]>().notNull(),
    note: text('note').notNull().default(''),
    createdAt: createdAt(),
}, t => [index('sc_vendor_portfolio_vendor_idx').on(t.vendorWorkspaceId, t.createdAt)]);

// ── buyer side ──

export const scVendorListEntries = pgTable('sc_vendor_list_entries', {
    id: uuid('id').primaryKey(),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    vendorWorkspaceId: uuid('vendor_workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    displayName: text('display_name').notNull(),
    phone: text('phone').notNull(),
    lineId: text('line_id').notNull().default(''),
    trades: jsonb('trades').$type<TradeId[]>().notNull(),
    province: text('province').notNull().default(''),
    privateNote: text('private_note').notNull().default(''),
    hiddenAt: ts('hidden_at'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
}, t => [
    uniqueIndex('sc_vendor_list_entries_phone_key').on(t.buyerWorkspaceId, t.phone),
    index('sc_vendor_list_entries_phone_idx').on(t.phone),
    index('sc_vendor_list_entries_vendor_idx').on(t.vendorWorkspaceId),
]);

const PACKAGE_STATUS_SQL = sql.raw(`('draft', 'open', 'reviewing', 'awarded', 'closed', 'cancelled', 'expired')`);

export const scWorkPackages = pgTable('sc_work_packages', {
    id: uuid('id').primaryKey(),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull(),
    projectId: uuid('project_id').notNull(),
    projectName: text('project_name').notNull(),
    title: text('title').notNull(),
    trade: text('trade').$type<TradeId>().notNull(),
    status: text('status').$type<PackageStatus>().notNull(),
    version: integer('version').notNull(),
    sourcingMode: text('sourcing_mode').$type<SourcingMode>().notNull(),
    pricingMode: text('pricing_mode').$type<PricingMode>().notNull(),
    supplyMode: text('supply_mode').$type<SupplyMode>().notNull(),
    description: text('description').notNull().default(''),
    hideOwnerIdentity: boolean('hide_owner_identity').notNull(),
    terms: jsonb('terms').$type<PackageTerms>().notNull(),
    schedule: jsonb('schedule').$type<ScheduleDto>().notNull(),
    installments: jsonb('installments').$type<InstallmentDto[]>().notNull(),
    location: jsonb('location').$type<LocationDto>().notNull(),
    /** What the snapshot is made of (BOQ keys, typed lines, per-line supply): re-taken at send / addendum. */
    selection: jsonb('selection').$type<{ lineKeys: string[]; customLines: CustomLine[]; materialByLine: Record<string, MaterialBy> }>().notNull(),
    bidDeadline: ts('bid_deadline').notNull(),
    priceValidUntil: text('price_valid_until').notNull(),
    /** Buyer only. */
    estimateTotal: numeric('estimate_total', { precision: 14, scale: 2, mode: 'number' }).notNull(),
    fileIds: jsonb('file_ids').$type<string[]>().notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    sentAt: ts('sent_at'),
    awardedAt: ts('awarded_at'),
    closedAt: ts('closed_at'),
    cancelledAt: ts('cancelled_at'),
    cancelReason: text('cancel_reason'),
}, t => [
    foreignKey({
        name: 'sc_work_packages_project_tenant_fk',
        columns: [t.projectId, t.buyerWorkspaceId],
        foreignColumns: [projects.id, projects.workspaceId],
    }).onDelete('cascade'),
    index('sc_work_packages_project_idx').on(t.buyerWorkspaceId, t.projectId),
    index('sc_work_packages_due_idx').on(t.status, t.bidDeadline),
    check('sc_work_packages_status_check', sql`${t.status} in ${PACKAGE_STATUS_SQL}`),
    check('sc_work_packages_version_check', sql`${t.version} >= 1`),
]);

export const scPackageVersions = pgTable('sc_package_versions', {
    packageId: uuid('package_id').notNull().references(() => scWorkPackages.id, { onDelete: 'cascade' }),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull(),
    version: integer('version').notNull(),
    lines: jsonb('lines').$type<SnapshotLine[]>().notNull(),
    /** Lines that differ from the previous version (addendum diff). */
    changedIdx: jsonb('changed_idx').$type<number[]>().notNull(),
    note: text('note').notNull().default(''),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [primaryKey({ columns: [t.packageId, t.version] })]);

const INVITATION_STATUS_SQL = sql.raw(`('sent', 'viewed', 'declined', 'submitted', 'withdrawn', 'won', 'lost', 'closed')`);

export const scInvitations = pgTable('sc_invitations', {
    id: uuid('id').primaryKey(),
    packageId: uuid('package_id').notNull().references(() => scWorkPackages.id, { onDelete: 'cascade' }),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull(),
    vendorListEntryId: uuid('vendor_list_entry_id').notNull().references(() => scVendorListEntries.id, { onDelete: 'restrict' }),
    vendorWorkspaceId: uuid('vendor_workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    displayName: text('display_name').notNull(),
    phone: text('phone').notNull(),
    channel: text('channel').$type<InviteChannel>().notNull(),
    status: text('status').$type<InvitationStatus>().notNull(),
    sentAt: ts('sent_at').notNull(),
    viewedAt: ts('viewed_at'),
    declinedAt: ts('declined_at'),
    declineReason: text('decline_reason').$type<DeclineReason>(),
    declineNote: text('decline_note'),
    withdrawnAt: ts('withdrawn_at'),
    /** Bid deadline + 30 days (renewed by resend / extend). */
    expiresAt: ts('expires_at').notNull(),
    resentCount: integer('resent_count').notNull().default(0),
    deadlineSoonAt: ts('deadline_soon_at'),
    createdAt: createdAt(),
}, t => [
    index('sc_invitations_package_idx').on(t.packageId, t.sentAt),
    index('sc_invitations_vendor_idx').on(t.vendorWorkspaceId, t.status),
    index('sc_invitations_entry_idx').on(t.vendorListEntryId),
    check('sc_invitations_status_check', sql`${t.status} in ${INVITATION_STATUS_SQL}`),
]);

/**
 * Link tokens of an invitation (SHA-256 only). A resend replaces every earlier token (only the new link works); an
 * addendum sent by SMS adds one (earlier links keep working until the invitation expires).
 */
export const scInvitationTokens = pgTable('sc_invitation_tokens', {
    tokenHash: text('token_hash').primaryKey(),
    invitationId: uuid('invitation_id').notNull().references(() => scInvitations.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
}, t => [index('sc_invitation_tokens_invitation_idx').on(t.invitationId)]);

export const scPackageQuestions = pgTable('sc_package_questions', {
    id: uuid('id').primaryKey(),
    packageId: uuid('package_id').notNull().references(() => scWorkPackages.id, { onDelete: 'cascade' }),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull(),
    invitationId: uuid('invitation_id').notNull().references(() => scInvitations.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer'),
    answeredBy: uuid('answered_by'),
    askedAt: ts('asked_at').notNull(),
    answeredAt: ts('answered_at'),
}, t => [index('sc_package_questions_package_idx').on(t.packageId, t.askedAt)]);

export const scSourcingTables = {
    scVendorProfiles, scVendorPortfolio, scVendorListEntries, scWorkPackages, scPackageVersions, scInvitations,
    scInvitationTokens, scPackageQuestions,
};
