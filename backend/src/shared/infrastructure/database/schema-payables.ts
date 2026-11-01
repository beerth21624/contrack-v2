// ─── PostgreSQL tables: payables (module `payables`, WP-49 … WP-52, docs/erp/02-domain-model.md §10) ───
// Imports only schema.ts (core) and schema-helpers.ts. Add every table to `payablesTables`; database.ts merges it and
// drizzle.config.ts lists this file for migrations. supplier_id / order_id / order_line_id / sc_claim_id / pay_period_id /
// cost_code_id point at other modules' rows: no FK (checked through ports, D-19).
import type {
    ApPaymentMethod, ApPaymentStatus, BillLineMatch, BillMatchStatus, CostCategory, PaymentRunStatus, SupplierBillKind, SupplierBillStatus,
    SupplierWhtPreset, WhtCertificateStatus, WhtCondition, WhtForm, WhtIncomeType, WhtPayeeSnapshot, WhtPayerSnapshot,
} from '@contrack/contract';
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { businessDate, createdAt, money, projectTenantFk, quantity, rate, unitPrice, updatedAt } from './schema-helpers';

/** A supplier bill (material / subcontract / service / labour / expense). project_id null = overhead or a labour bill. */
export const apBills = pgTable('ap_bills', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id'),
    /** null only for `kind = 'labour'`. */
    supplierId: uuid('supplier_id'),
    payPeriodId: uuid('pay_period_id'),
    kind: text('kind').$type<SupplierBillKind>().notNull(),
    number: text('number'),
    billDate: businessDate('bill_date').notNull(),
    supplierInvoiceNo: text('supplier_invoice_no').notNull().default(''),
    supplierInvoiceDate: businessDate('supplier_invoice_date'),
    taxInvoiceNo: text('tax_invoice_no').notNull().default(''),
    taxInvoiceDate: businessDate('tax_invoice_date'),
    inputVatClaimable: boolean('input_vat_claimable').notNull().default(false),
    status: text('status').$type<SupplierBillStatus>().notNull().default('draft'),
    dueDate: businessDate('due_date').notNull(),
    orderId: uuid('order_id'),
    scClaimId: uuid('sc_claim_id'),
    vatRate: rate('vat_rate').notNull().default(0),
    subtotal: money('subtotal').notNull().default(0),
    discount: money('discount').notNull().default(0),
    vat: money('vat').notNull().default(0),
    total: money('total').notNull().default(0),
    whtPreset: text('wht_preset').$type<SupplierWhtPreset>().notNull().default('none'),
    whtRate: rate('wht_rate').notNull().default(0),
    whtAmount: money('wht_amount').notNull().default(0),
    retentionAmount: money('retention_amount').notNull().default(0),
    payable: money('payable').notNull().default(0),
    paidAmount: money('paid_amount').notNull().default(0),
    matchStatus: text('match_status').$type<BillMatchStatus>().notNull().default('not_applicable'),
    fileIds: jsonb('file_ids').$type<string[]>().notNull().default([]),
    note: text('note').notNull().default(''),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason').notNull().default(''),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    projectTenantFk('ap_bills', t),
    uniqueIndex('ap_bills_workspace_number_key').on(t.workspaceId, t.number).where(sql`${t.number} is not null`),
    uniqueIndex('ap_bills_supplier_invoice_key').on(t.workspaceId, t.supplierId, t.supplierInvoiceNo)
        .where(sql`${t.supplierInvoiceNo} <> '' and ${t.status} <> 'voided'`),
    uniqueIndex('ap_bills_pay_period_key').on(t.payPeriodId).where(sql`${t.payPeriodId} is not null and ${t.status} <> 'voided'`),
    uniqueIndex('ap_bills_sc_claim_key').on(t.scClaimId).where(sql`${t.scClaimId} is not null and ${t.status} <> 'voided'`),
    index('ap_bills_workspace_status_idx').on(t.workspaceId, t.status),
    index('ap_bills_workspace_project_idx').on(t.workspaceId, t.projectId),
    index('ap_bills_order_idx').on(t.workspaceId, t.orderId),
    index('ap_bills_due_idx').on(t.status, t.dueDate),
    check('ap_bills_kind_check', sql`${t.kind} in ('material', 'subcontract', 'service', 'labour', 'expense')`),
    check('ap_bills_status_check', sql`${t.status} in ('draft', 'pending_approval', 'approved', 'scheduled', 'paid', 'voided')`),
    check('ap_bills_match_status_check', sql`${t.matchStatus} in ('not_applicable', 'matched', 'exceptions')`),
    check('ap_bills_wht_preset_check', sql`${t.whtPreset} in ('none', 'government', 'transport', 'advertising', 'service', 'rent')`),
    check('ap_bills_supplier_check', sql`${t.supplierId} is not null or ${t.kind} = 'labour'`),
    check('ap_bills_discount_check', sql`${t.discount} >= 0 and ${t.discount} <= ${t.subtotal}`),
]);

export const apBillLines = pgTable('ap_bill_lines', {
    id: uuid('id').primaryKey(),
    billId: uuid('bill_id').notNull().references(() => apBills.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    orderLineId: uuid('order_line_id'),
    costCodeId: uuid('cost_code_id'),
    category: text('category').$type<CostCategory>().notNull().default('material'),
    desc: text('desc').notNull().default(''),
    unit: text('unit').notNull().default(''),
    qty: quantity('qty').notNull(),
    unitPrice: unitPrice('unit_price').notNull().default(0),
    amount: money('amount').notNull().default(0),
    match: text('match').$type<BillLineMatch>().notNull().default('no_po'),
    /** Quantity counted on the PO line (PurchaseOrders.markBilled) when the bill was posted; undone on void. */
    billedQty: quantity('billed_qty').notNull().default(0),
    sort: integer('sort').notNull().default(0),
}, t => [
    index('ap_bill_lines_bill_idx').on(t.billId, t.sort),
    check('ap_bill_lines_category_check', sql`${t.category} in ('material', 'labour', 'subcontract', 'equipment', 'other')`),
    check('ap_bill_lines_match_check', sql`${t.match} in ('matched', 'qty_exceeds_received', 'price_differs', 'no_po')`),
]);

/** A payment run (company level, not numbered): bills paid together on one date (WP-50). */
export const apPaymentRuns = pgTable('ap_payment_runs', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    number: text('number'),
    status: text('status').$type<PaymentRunStatus>().notNull().default('draft'),
    billIds: jsonb('bill_ids').$type<string[]>().notNull().default([]),
    payDate: businessDate('pay_date').notNull(),
    method: text('method').$type<ApPaymentMethod>().notNull().default('transfer'),
    note: text('note').notNull().default(''),
    totalCash: money('total_cash').notNull().default(0),
    totalWht: money('total_wht').notNull().default(0),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paidBy: uuid('paid_by'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
}, t => [
    index('ap_payment_runs_workspace_status_idx').on(t.workspaceId, t.status),
    check('ap_payment_runs_status_check', sql`${t.status} in ('draft', 'pending_approval', 'approved', 'paid', 'cancelled')`),
    check('ap_payment_runs_method_check', sql`${t.method} in ('transfer', 'cheque', 'cash')`),
]);

/** A payment voucher (`PV`): one per supplier of a run, one per labour bill (supplier_id null). */
export const apPayments = pgTable('ap_payments', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    runId: uuid('run_id').references(() => apPaymentRuns.id, { onDelete: 'set null' }),
    supplierId: uuid('supplier_id'),
    payeeName: text('payee_name').notNull().default(''),
    number: text('number').notNull(),
    payDate: businessDate('pay_date').notNull(),
    method: text('method').$type<ApPaymentMethod>().notNull(),
    bankRef: text('bank_ref').notNull().default(''),
    cashAmount: money('cash_amount').notNull().default(0),
    whtAmount: money('wht_amount').notNull().default(0),
    whtCertificateId: uuid('wht_certificate_id'),
    status: text('status').$type<ApPaymentStatus>().notNull().default('issued'),
    fileIds: jsonb('file_ids').$type<string[]>().notNull().default([]),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
}, t => [
    uniqueIndex('ap_payments_workspace_number_key').on(t.workspaceId, t.number),
    index('ap_payments_run_idx').on(t.runId),
    index('ap_payments_workspace_supplier_idx').on(t.workspaceId, t.supplierId),
    check('ap_payments_status_check', sql`${t.status} in ('issued', 'voided')`),
    check('ap_payments_method_check', sql`${t.method} in ('transfer', 'cheque', 'cash')`),
]);

/** What a payment settled of each bill: settled = cash + WHT. */
export const apPaymentAllocations = pgTable('ap_payment_allocations', {
    paymentId: uuid('payment_id').notNull().references(() => apPayments.id, { onDelete: 'cascade' }),
    billId: uuid('bill_id').notNull().references(() => apBills.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    settled: money('settled').notNull().default(0),
    wht: money('wht').notNull().default(0),
    cash: money('cash').notNull().default(0),
}, t => [
    primaryKey({ name: 'ap_payment_allocations_pkey', columns: [t.paymentId, t.billId] }),
    index('ap_payment_allocations_bill_idx').on(t.billId),
]);

/** หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ, `WHT`): one per payment with WHT. */
export const apWhtCertificates = pgTable('ap_wht_certificates', {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    number: text('number').notNull(),
    bookNo: text('book_no').notNull().default(''),
    paymentId: uuid('payment_id').notNull().references(() => apPayments.id, { onDelete: 'cascade' }),
    payeeSnapshot: jsonb('payee_snapshot').$type<WhtPayeeSnapshot>().notNull(),
    payerSnapshot: jsonb('payer_snapshot').$type<WhtPayerSnapshot>().notNull(),
    form: text('form').$type<WhtForm>().notNull(),
    incomeType: text('income_type').$type<WhtIncomeType>().notNull(),
    incomeDesc: text('income_desc').notNull().default(''),
    payDate: businessDate('pay_date').notNull(),
    baseAmount: money('base_amount').notNull().default(0),
    whtRate: rate('wht_rate').notNull().default(0),
    whtAmount: money('wht_amount').notNull().default(0),
    condition: text('condition').$type<WhtCondition>().notNull().default('withheld'),
    status: text('status').$type<WhtCertificateStatus>().notNull().default('issued'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    createdBy: uuid('created_by').notNull(),
}, t => [
    uniqueIndex('ap_wht_certificates_workspace_number_key').on(t.workspaceId, t.number),
    uniqueIndex('ap_wht_certificates_payment_key').on(t.paymentId),
    index('ap_wht_certificates_workspace_date_idx').on(t.workspaceId, t.payDate),
    check('ap_wht_certificates_form_check', sql`${t.form} in ('pnd3', 'pnd53')`),
    check('ap_wht_certificates_income_type_check', sql`${t.incomeType} in ('service', 'transport', 'advertising', 'rent', 'other')`),
    check('ap_wht_certificates_condition_check', sql`${t.condition} in ('withheld', 'paid_always', 'paid_once')`),
    check('ap_wht_certificates_status_check', sql`${t.status} in ('issued', 'voided')`),
]);

export const payablesTables = { apBills, apBillLines, apPaymentRuns, apPayments, apPaymentAllocations, apWhtCertificates };
