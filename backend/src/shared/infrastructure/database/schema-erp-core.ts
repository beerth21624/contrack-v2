// ─── PostgreSQL tables: ERP foundation (approvals, audit; later numbering, company, customers, …) ───
// docs/erp/02-domain-model.md §1. Every row carries its workspace id; repositories always filter by it. This file
// imports only schema.ts (core) and schema-helpers.ts. Add every table to `erpCoreTables`; database.ts merges it and
// drizzle.config.ts lists this file for migrations.
import { sql } from 'drizzle-orm';
import { bigserial, boolean, check, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { BankAccount, BusinessProfile, CompanyDefaults, CustomerLinkAction, Role } from '@contrack/contract';
import { workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, rate, updatedAt } from './schema-helpers';

// ── approvals (WP-08, docs/erp/01-architecture.md §6) ──

/** A workspace's own rule for one subject; no row = APPROVAL_SUBJECT_DEFAULTS. */
export const approvalPolicies = pgTable('approval_policies', {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    enabled: boolean('enabled').notNull(),
    minAmount: money('min_amount'),
    approverRoles: jsonb('approver_roles').$type<Role[]>().notNull(),
    selfApprove: boolean('self_approve').notNull().default(true),
    /** Plain uuid: the user may be gone. */
    updatedBy: uuid('updated_by'),
    updatedAt: updatedAt(),
}, t => [primaryKey({ columns: [t.workspaceId, t.subject] })]);

/** One request per send-for-approval (also the automatic ones, for the audit trail). */
export const approvalRequests = pgTable('approval_requests', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Null for workspace-level subjects (the tenant FK is not checked then: MATCH SIMPLE). */
    projectId: uuid('project_id'),
    subject: text('subject').notNull(),
    subjectId: uuid('subject_id').notNull(),
    title: text('title').notNull(),
    amount: money('amount'),
    status: text('status', { enum: ['pending', 'approved', 'rejected', 'cancelled'] }).notNull(),
    auto: boolean('auto').notNull().default(false),
    autoReason: text('auto_reason', { enum: ['policy_off', 'below_threshold', 'self_approve', 'solo', 'no_approver'] }),
    requestedBy: uuid('requested_by').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note').notNull().default(''),
    createdAt: createdAt(),
}, t => [
    projectTenantFk('approval_requests', t),
    check('approval_requests_status_check', sql`${t.status} in ('pending', 'approved', 'rejected', 'cancelled')`),
    check('approval_requests_auto_reason_check',
        sql`${t.autoReason} is null or ${t.autoReason} in ('policy_off', 'below_threshold', 'self_approve', 'solo', 'no_approver')`),
    uniqueIndex('approval_requests_pending_key').on(t.workspaceId, t.subject, t.subjectId).where(sql`${t.status} = 'pending'`),
    index('approval_requests_workspace_status_idx').on(t.workspaceId, t.status, t.requestedAt),
    index('approval_requests_subject_idx').on(t.workspaceId, t.subject, t.subjectId),
    unique('approval_requests_id_workspace_key').on(t.id, t.workspaceId),
]);

/** Steps of a request (v1: one step, seq 1, created while the request is pending). */
export const approvalSteps = pgTable('approval_steps', {
    id: uuid('id').primaryKey(),
    requestId: uuid('request_id').notNull(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    approverRoles: jsonb('approver_roles').$type<Role[]>().notNull(),
    status: text('status', { enum: ['pending', 'approved', 'rejected', 'skipped'] }).notNull(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    note: text('note').notNull().default(''),
}, t => [
    foreignKey({
        name: 'approval_steps_request_fk',
        columns: [t.requestId, t.workspaceId],
        foreignColumns: [approvalRequests.id, approvalRequests.workspaceId],
    }).onDelete('cascade'),
    unique('approval_steps_request_seq_key').on(t.requestId, t.seq),
    check('approval_steps_status_check', sql`${t.status} in ('pending', 'approved', 'rejected', 'skipped')`),
]);

// ── audit (WP-08, docs/erp/01-architecture.md §10) ──

/** Append-only (never updated or deleted). No project FK: the trail outlives a deleted project. */
export const auditEvents = pgTable('audit_events', {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id'),
    actorUserId: uuid('actor_user_id'),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    index('audit_events_entity_idx').on(t.workspaceId, t.entityType, t.entityId, t.id),
    index('audit_events_workspace_at_idx').on(t.workspaceId, t.at),
]);

// ── numbering (WP-11, docs/erp/01-architecture.md §8, 02-domain-model.md §1.6) ──

/** A workspace's own series of one document type; no row = DOC_TYPE_DEFAULTS. */
export const docNumberSeries = pgTable('doc_number_series', {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    docType: text('doc_type').notNull(),
    prefix: text('prefix').notNull(),
    pattern: text('pattern').notNull(),
    reset: text('reset', { enum: ['yearly', 'monthly', 'never'] }).notNull(),
    yearStyle: text('year_style', { enum: ['ce', 'be'] }).notNull(),
    updatedBy: uuid('updated_by'),
    updatedAt: updatedAt(),
}, t => [
    primaryKey({ columns: [t.workspaceId, t.docType] }),
    check('doc_number_series_reset_check', sql`${t.reset} in ('yearly', 'monthly', 'never')`),
    check('doc_number_series_year_style_check', sql`${t.yearStyle} in ('ce', 'be')`),
]);

/** Last number used per (document type, period); the upsert's row lock serialises concurrent issues. */
export const docNumberCounters = pgTable('doc_number_counters', {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    docType: text('doc_type').notNull(),
    periodKey: text('period_key').notNull(),
    lastSeq: integer('last_seq').notNull(),
    updatedAt: updatedAt(),
}, t => [primaryKey({ columns: [t.workspaceId, t.docType, t.periodKey] })]);

/** Every number ever issued (never deleted; voided ones stay). No project FK: a number outlives a deleted project. */
export const issuedDocuments = pgTable('issued_documents', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    docType: text('doc_type').notNull(),
    number: text('number').notNull(),
    periodKey: text('period_key').notNull(),
    seq: integer('seq').notNull(),
    issueDate: businessDate('issue_date').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    projectId: uuid('project_id'),
    issuedBy: uuid('issued_by').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    status: text('status', { enum: ['issued', 'voided'] }).notNull().default('issued'),
    voidedBy: uuid('voided_by'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason').notNull().default(''),
}, t => [
    unique('issued_documents_number_key').on(t.workspaceId, t.docType, t.number),
    unique('issued_documents_subject_key').on(t.workspaceId, t.docType, t.subjectId),
    index('issued_documents_project_idx').on(t.workspaceId, t.projectId),
    index('issued_documents_period_idx').on(t.workspaceId, t.docType, t.periodKey),
    check('issued_documents_status_check', sql`${t.status} in ('issued', 'voided')`),
]);

// ── company profile (WP-12, 02-domain-model.md §1.3) ──

/** One row per workspace (no row = defaults: the legal name is the workspace name). Image columns hold file ids. */
export const companyProfiles = pgTable('company_profiles', {
    workspaceId: uuid('workspace_id').primaryKey().references(() => workspaces.id, { onDelete: 'cascade' }),
    legalNameTh: text('legal_name_th').notNull().default(''),
    legalNameEn: text('legal_name_en').notNull().default(''),
    taxId: text('tax_id').notNull().default(''),
    branchCode: text('branch_code').notNull().default('00000'),
    branchNameTh: text('branch_name_th').notNull().default(''),
    branchNameEn: text('branch_name_en').notNull().default(''),
    addressTh: text('address_th').notNull().default(''),
    addressEn: text('address_en').notNull().default(''),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    website: text('website').notNull().default(''),
    logoFileId: uuid('logo_file_id'),
    stampFileId: uuid('stamp_file_id'),
    signatureFileId: uuid('signature_file_id'),
    vatRegistered: boolean('vat_registered').notNull().default(false),
    vatRate: rate('vat_rate').notNull().default(0.07),
    businessProfiles: jsonb('business_profiles').$type<BusinessProfile[]>().notNull().default([]),
    defaultProjectType: text('default_project_type'),
    defaultDocLanguage: text('default_doc_language', { enum: ['th', 'en'] }).notNull().default('th'),
    documentYearStyle: text('document_year_style', { enum: ['ce', 'be'] }).notNull().default('ce'),
    bankAccounts: jsonb('bank_accounts').$type<BankAccount[]>().notNull().default([]),
    promptpayId: text('promptpay_id').notNull().default(''),
    defaults: jsonb('defaults').$type<CompanyDefaults>().notNull().default({}),
    brandColor: text('brand_color').notNull().default('#F97316'),
    documentFooterTh: text('document_footer_th').notNull().default(''),
    documentFooterEn: text('document_footer_en').notNull().default(''),
    /** Plain uuid: the user may be gone. */
    updatedBy: uuid('updated_by'),
    updatedAt: updatedAt(),
}, t => [
    check('company_profiles_default_project_type_check',
        sql`${t.defaultProjectType} is null or ${t.defaultProjectType} in ('residential_new', 'residential_renovation', 'government', 'commercial')`),
    check('company_profiles_default_doc_language_check', sql`${t.defaultDocLanguage} in ('th', 'en')`),
    check('company_profiles_document_year_style_check', sql`${t.documentYearStyle} in ('ce', 'be')`),
]);

// ── customers (WP-13, 02-domain-model.md §1.7) ──

export const customers = pgTable('customers', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['individual', 'juristic', 'government'] }).notNull(),
    nameTh: text('name_th').notNull().default(''),
    nameEn: text('name_en').notNull().default(''),
    taxId: text('tax_id').notNull().default(''),
    branchCode: text('branch_code').notNull().default(''),
    addressTh: text('address_th').notNull().default(''),
    addressEn: text('address_en').notNull().default(''),
    contactName: text('contact_name').notNull().default(''),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    lineId: text('line_id').notNull().default(''),
    defaultWhtRate: rate('default_wht_rate'),
    defaultDocLanguage: text('default_doc_language', { enum: ['th', 'en'] }).notNull().default('th'),
    paymentTermDays: integer('payment_term_days').notNull().default(30),
    note: text('note').notNull().default(''),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    /** Plain uuid: the user may be gone. */
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    index('customers_workspace_archived_idx').on(t.workspaceId, t.archivedAt),
    uniqueIndex('customers_tax_branch_key').on(t.workspaceId, t.taxId, t.branchCode).where(sql`${t.taxId} <> '' and ${t.archivedAt} is null`),
    check('customers_kind_check', sql`${t.kind} in ('individual', 'juristic', 'government')`),
    check('customers_default_doc_language_check', sql`${t.defaultDocLanguage} in ('th', 'en')`),
    check('customers_name_check', sql`${t.nameTh} <> '' or ${t.nameEn} <> ''`),
]);

// ── customer links (WP-14, 02-domain-model.md §1.8) ──

/** The customer's answer on a link (the only "signature": typed name + time + IP). */
export interface CustomerLinkResponseRow {
    action: CustomerLinkAction;
    name: string;
    note: string;
    ip: string;
    userAgent: string;
    at: string;
}

/** A public link to one document. Only the SHA-256 of the token is stored; the raw token is shown once. */
export const customerLinks = pgTable('customer_links', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    subjectType: text('subject_type', { enum: ['quotation', 'variation', 'invoice'] }).notNull(),
    subjectId: uuid('subject_id').notNull(),
    /** Plain uuid: the user may be gone. */
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
    viewCount: integer('view_count').notNull().default(0),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    response: jsonb('response').$type<CustomerLinkResponseRow>(),
}, t => [
    projectTenantFk('customer_links', t),
    unique('customer_links_token_hash_key').on(t.tokenHash),
    index('customer_links_subject_idx').on(t.workspaceId, t.subjectType, t.subjectId),
    check('customer_links_subject_type_check', sql`${t.subjectType} in ('quotation', 'variation', 'invoice')`),
]);

export const erpCoreTables = {
    approvalPolicies, approvalRequests, approvalSteps, auditEvents, docNumberSeries, docNumberCounters, issuedDocuments, companyProfiles, customers,
    customerLinks,
};
