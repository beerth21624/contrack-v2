// ─── Receipts, tax invoices, credit notes, receivables (docs/erp/04-implementation-plan.md WP-30, 02-domain-model.md §4.2–§4.5) ───
// Record / void receipts, tax invoices ahead of payment and credit notes: `billing.receive`. Aging, customer statement and
// the PromptPay payload: `billing.read`.
import { Injectable } from '@nestjs/common';
import type {
    ArAgingDto, CreateCreditNoteRequest, CreateReceiptRequest, CustomerStatementDto, CustomerStatementQuery, InvoiceDto,
    InvoicePromptPayDto, IssueTaxInvoiceRequest, ReceiptDto, VoidReceiptRequest,
} from '@contrack/contract';
import {
    agingBucket, agingSummary, daysOverdue, invoiceDue, invoiceOutstanding, invoiceSettlementStatus, remainingTaxInvoice,
    taxInvoiceForReceipt, type TaxInvoicePart,
} from '@contrack/domain/billing';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { round2, sumMoney } from '@contrack/domain/money';
import {
    AuditLog, Clock, CompanyProfiles, CustomerLookup, DocumentNumbering, FileService, FinancialEvents, IdGenerator, MainContracts, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { creditNoteText } from '../../domain/billing-rules';
import { requireInvoiceStatus } from '../../domain/billing-state';
import { BillingAccess, InvoiceIssuer, OPEN_RECEIVABLE, RECEIVABLE_KIND, transact } from '../billing.service';
import { invoiceDto } from '../billing-views';
import { BillingRepository, type InvoiceRecord, type ReceiptAllocationRecord, type ReceiptRecord } from '../ports/billing.repository';
import {
    ReceiptViews, TAX_INVOICE_SOURCES, TaxDocumentWriter, liveCreditNotes, liveTaxInvoices, promptPayFor, voidableToday,
} from '../receivables.service';

const notReceivable = (inv: InvoiceRecord): DomainError =>
    DomainError.conflict(`The ${inv.kind} cannot take a receipt`, { reason: 'invalid_transition', status: inv.status, kind: inv.kind });

/** Something is left to put on a tax invoice. */
const hasPart = (p: TaxInvoicePart): boolean => p.net > 0 || p.vat > 0;

// ── receipts ──

/**
 * POST /workspaces/:workspaceId/receipts — `billing.receive`. One transaction: receipt numbered (`RC`), each invoice's
 * `paid_amount` / status, a tax invoice per invoice for the share settled (VAT registered and chosen), advance received
 * on the ledger, milestone → paid, `fin_events` `ar.receipt`, `ar.wht_withheld_by_customer`, `ar.tax_invoiced`.
 */
@Injectable()
export class RecordReceiptUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly company: CompanyProfiles,
        private readonly customers: CustomerLookup,
        private readonly numbering: DocumentNumbering,
        private readonly events: FinancialEvents,
        private readonly writer: TaxDocumentWriter,
        private readonly files: FileService,
        private readonly views: ReceiptViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; workspaceId: WorkspaceId; body: CreateReceiptRequest }): Promise<Result<ReceiptDto, DomainError>> {
        const { userId, body } = input;
        const grant = await this.access.workspace(userId, input.workspaceId, ['billing.receive']);
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;

        const allocs = body.allocations.map(a => ({ invoiceId: a.invoiceId.toLowerCase(), cash: round2(a.cash), wht: round2(a.wht) }));
        if (new Set(allocs.map(a => a.invoiceId)).size !== allocs.length) {
            return err(DomainError.validation('An invoice appears twice in the receipt', { reason: 'duplicate_invoice' }));
        }
        const zero = allocs.find(a => round2(a.cash + a.wht) <= 0);
        if (zero !== undefined) {
            return err(DomainError.validation('Each invoice needs an amount above zero', { reason: 'receipt_amount_not_positive', invoiceId: zero.invoiceId }));
        }
        const fileIds = [...new Set((body.fileIds ?? []).map(f => f.toLowerCase()))];
        const certFile = body.whtCertificateFileId?.toLowerCase() ?? null;
        const uploaded = [...fileIds, ...(certFile === null ? [] : [certFile])];
        if (uploaded.length > 0) {
            const owned = await this.files.assertUploadedBy(uploaded, userId);
            if (!owned.ok) return owned;
        }

        const done = await transact(this.uow, async (): Promise<Result<ReceiptRecord, DomainError>> => {
            const company = await this.company.get(ws);
            // Lock in id order (two receipts on the same invoices never wait on each other crosswise).
            const locked = new Map<string, InvoiceRecord>();
            for (const id of [...allocs.map(a => a.invoiceId)].sort()) {
                const inv = await this.repo.lockInvoice(ws, id);
                if (inv === undefined) return err(DomainError.notFound('Invoice'));
                if (!RECEIVABLE_KIND(inv)) return err(notReceivable(inv));
                const open = requireInvoiceStatus(inv.status, ['issued', 'partially_paid']);
                if (!open.ok) return open;
                locked.set(id, inv);
            }
            const pairs = allocs.flatMap(a => {
                const inv = locked.get(a.invoiceId);
                return inv === undefined ? [] : [{ a, inv }];
            });
            const invoices = pairs.map(p => p.inv);
            const first = invoices[0];
            if (first === undefined) return err(DomainError.notFound('Invoice'));
            const customerId = body.customerId?.toLowerCase() ?? first.customerId;
            if (invoices.some(i => i.customerId !== customerId)) {
                return err(DomainError.unprocessable('Every invoice of a receipt must be of one customer', { reason: 'customer_mismatch' }));
            }
            const wantTi = body.issueTaxInvoice ?? company.vatRegistered;
            if (wantTi) {
                const vat = TaxDocumentWriter.requireVat(company);
                if (!vat.ok) return vat;
            }

            const now = this.clock.now();
            const receiptDate = body.receiptDate ?? bangkokToday(now);
            const language = body.language ?? first.language;

            // Amounts first: nothing is written before every allocation is known to fit.
            const plans: { inv: InvoiceRecord; cash: number; wht: number; settled: number; paidAfter: number; status: 'issued' | 'partially_paid' | 'paid'; ti: TaxInvoicePart | null }[] = [];
            for (const { a, inv } of pairs) {
                const settled = round2(a.cash + a.wht);
                const paidAfter = round2(inv.paidAmount + settled);
                const status = invoiceSettlementStatus(inv, paidAfter);
                if (status === 'overpayment') {
                    return err(DomainError.unprocessable('The amount is above what is due on the invoice', {
                        reason: 'overpayment', invoiceId: inv.id, outstanding: invoiceOutstanding(inv, inv.paidAmount),
                    }));
                }
                let ti: TaxInvoicePart | null = null;
                if (wantTi && TAX_INVOICE_SOURCES.has(inv.source)) {
                    const previous = liveTaxInvoices(await this.repo.relatedInvoices(ws, inv.id));
                    const left = remainingTaxInvoice(inv, previous);
                    if (hasPart(left)) {
                        const vatRate = await this.vatRateOf(inv, company.vatRate);
                        const part = taxInvoiceForReceipt({ invoice: inv, vatRate, paidBefore: inv.paidAmount, settled, previous });
                        // Never more than what is left (a tax invoice issued ahead may have taken a share already).
                        const net = round2(Math.min(part.net, left.net));
                        const vat = round2(Math.min(part.vat, left.vat));
                        ti = hasPart({ net, vat, total: 0 }) ? { net, vat, total: round2(net + vat) } : null;
                    }
                }
                plans.push({ inv, cash: a.cash, wht: a.wht, settled, paidAfter, status, ti });
            }
            if (plans.some(p => p.ti !== null)) {
                const taxId = await this.writer.requireCustomerTaxId(ws, customerId);
                if (!taxId.ok) return taxId;
            }

            const projects = new Set(invoices.map(i => i.projectId));
            const projectId: ProjectId | null = projects.size === 1 ? first.projectId : null;
            const receiptId = this.ids.newId();
            const customerSnapshot = await this.customers.snapshot(ws, customerId, language);
            if (customerSnapshot === undefined) return err(DomainError.notFound('Customer'));
            const number = await this.numbering.issue({
                workspaceId: ws, docType: 'receipt', issueDate: receiptDate, subjectType: 'ar_receipt', subjectId: receiptId, projectId, issuedBy: userId,
            });
            if (!number.ok) return number;
            const companySnapshot = await this.company.snapshot(ws, language);

            const rows: ReceiptAllocationRecord[] = [];
            const taxInvoiceIds: string[] = [];
            for (const p of plans) {
                const { inv } = p;
                let taxInvoiceId: string | null = null;
                if (p.ti !== null) {
                    const ti = await this.writer.create(inv, p.ti, { issueDate: receiptDate, language, note: '', by: userId, now, receiptId });
                    if (!ti.ok) return ti;
                    taxInvoiceId = ti.value.id;
                    taxInvoiceIds.push(ti.value.id);
                }
                await this.repo.saveInvoice({ ...inv, paidAmount: p.paidAfter, status: p.status, updatedAt: now });

                if (inv.source === 'advance' && inv.contractId !== null && inv.projectId !== null) {
                    // The advance counts as received by its share of the net (recovered by the next claims).
                    const entries = (await this.repo.advanceEntries(ws, inv.contractId)).filter(e => e.kind === 'received' && e.invoiceId === inv.id);
                    const net = taxInvoiceForReceipt({
                        invoice: inv, vatRate: 0, paidBefore: inv.paidAmount, settled: p.settled, previous: entries.map(e => ({ net: e.amount, vat: 0 })),
                    }).net;
                    if (net > 0) {
                        await this.repo.insertAdvanceEntry({
                            id: this.ids.newId(), workspaceId: ws, contractId: inv.contractId, projectId: inv.projectId, kind: 'received', amount: net,
                            invoiceId: inv.id, claimId: null, receiptId, entryDate: receiptDate, createdBy: userId, createdAt: now,
                        });
                    }
                }
                if (p.status === 'paid' && inv.milestoneId !== null) {
                    const marked = await this.contracts.markMilestone(ws, inv.milestoneId, 'paid');
                    if (!marked.ok) return marked;
                }

                const common = {
                    projectId: inv.projectId, eventDate: receiptDate, counterpartyType: 'customer' as const, counterpartyId: customerId,
                    counterpartyName: customerSnapshot.name, counterpartyTaxId: customerSnapshot.taxId, counterpartyBranch: customerSnapshot.branchCode,
                    docType: 'receipt', docNumber: number.value.number, docDate: receiptDate, sourceType: 'ar_receipt', sourceId: receiptId,
                    data: { invoiceId: inv.id, invoiceNumber: inv.number, contractId: inv.contractId, method: body.method }, by: userId,
                };
                const posted = await this.events.post(ws, { ...common, eventType: 'ar.receipt', direction: 'in', net: p.settled, wht: p.wht, cash: p.cash });
                if (!posted.ok) return posted;
                if (p.wht > 0) {
                    const whtPosted = await this.events.post(ws, {
                        ...common, eventType: 'ar.wht_withheld_by_customer', direction: 'none', net: p.wht, wht: p.wht, cash: 0,
                        data: { ...common.data, certificateNo: body.whtCertificateNo ?? '' },
                    });
                    if (!whtPosted.ok) return whtPosted;
                }
                rows.push({ receiptId, invoiceId: inv.id, workspaceId: ws, cash: p.cash, wht: p.wht, settled: p.settled, taxInvoiceId });
            }

            const receipt: ReceiptRecord = {
                id: receiptId, workspaceId: ws, customerId, projectId, number: number.value.number, receiptDate, method: body.method,
                bankRef: body.bankRef ?? '', cashAmount: sumMoney(plans.map(p => p.cash)), whtAmount: sumMoney(plans.map(p => p.wht)),
                whtCertificateNo: body.whtCertificateNo ?? '', whtCertificateFileId: certFile, taxInvoiceIds, status: 'issued', fileIds, language,
                customerSnapshot, companySnapshot, note: body.note ?? '', voidReason: '', voidedAt: null, voidedBy: null, createdBy: userId, createdAt: now,
            };
            await this.repo.insertReceipt(receipt);
            await this.repo.insertAllocations(rows);
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'ar_receipt', entityId: receiptId, action: 'receive',
                data: { number: receipt.number, cash: receipt.cashAmount, wht: receipt.whtAmount, invoices: rows.map(r => r.invoiceId), taxInvoiceIds },
            });
            return ok(receipt);
        });
        if (!done.ok) return done;
        return ok(await this.views.dto(done.value, grant.value.role, this.clock.now()));
    }

    /** VAT rate of the invoice's contract (company rate for an invoice without one). */
    private async vatRateOf(inv: InvoiceRecord, fallback: number): Promise<number> {
        if (inv.contractId === null) return fallback;
        return (await this.contracts.find(inv.workspaceId, inv.contractId))?.vatRate ?? fallback;
    }
}

/** GET /receipts/:receiptId — `billing.read`. */
@Injectable()
export class GetReceiptUseCase {
    constructor(private readonly access: BillingAccess, private readonly views: ReceiptViews, private readonly clock: Clock) {}

    async execute(userId: UserId, receiptId: string): Promise<Result<ReceiptDto, DomainError>> {
        const loaded = await this.access.receipt(userId, receiptId, ['billing.read']);
        if (!loaded.ok) return loaded;
        return ok(await this.views.dto(loaded.value.receipt, loaded.value.grant.role, this.clock.now()));
    }
}

/**
 * POST /receipts/:receiptId/void — `billing.receive`, only on the Bangkok day it was recorded (409 `receipt_void_window`).
 * Numbers voided (receipt and its tax invoices), events reversed, invoices back to what they were, advance rows removed,
 * a paid milestone back to invoiced. A tax invoice with a credit note → 409 `has_credit_notes`.
 */
@Injectable()
export class VoidReceiptUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly numbering: DocumentNumbering,
        private readonly issuer: InvoiceIssuer,
        private readonly views: ReceiptViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; receiptId: string; body: VoidReceiptRequest }): Promise<Result<ReceiptDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.receipt(userId, input.receiptId, ['billing.receive']);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<ReceiptRecord, DomainError>> => {
            const r = await this.repo.lockReceipt(ws, loaded.value.receipt.id);
            if (r === undefined) return err(DomainError.notFound('Receipt'));
            if (r.status !== 'issued') return err(DomainError.conflict('The receipt is voided already', { reason: 'invalid_transition', status: r.status }));
            const now = this.clock.now();
            if (!voidableToday(r, now)) {
                return err(DomainError.conflict('A receipt may be voided only on the day it was recorded', { reason: 'receipt_void_window' }));
            }
            const today = bangkokToday(now);
            const allocs = [...await this.repo.allocationsOf(ws, [r.id])].sort((a, b) => a.invoiceId.localeCompare(b.invoiceId));
            for (const a of allocs) {
                const inv = await this.repo.lockInvoice(ws, a.invoiceId);
                if (inv === undefined) return err(DomainError.notFound('Invoice'));
                if (a.taxInvoiceId !== null) {
                    const ti = await this.repo.lockInvoice(ws, a.taxInvoiceId);
                    if (ti !== undefined && ti.status !== 'voided') {
                        if (liveCreditNotes(await this.repo.relatedInvoices(ws, ti.id)).length > 0) {
                            return err(DomainError.conflict('A credit note was issued on the tax invoice of this receipt', { reason: 'has_credit_notes' }));
                        }
                        const v = await this.numbering.void({ workspaceId: ws, docType: 'tax_invoice', subjectId: ti.id, reason: body.reason, by: userId });
                        if (!v.ok) return v;
                        const rev = await this.issuer.reverseAll(ti, userId, today);
                        if (!rev.ok) return rev;
                        await this.repo.saveInvoice({ ...ti, status: 'voided', voidReason: body.reason, updatedAt: now });
                    }
                }
                const paid = round2(Math.max(0, inv.paidAmount - a.settled));
                const status = invoiceSettlementStatus(inv, paid);
                const back = status === 'overpayment' ? 'paid' : status;
                await this.repo.saveInvoice({ ...inv, paidAmount: paid, status: back, updatedAt: now });
                if (inv.status === 'paid' && back !== 'paid' && inv.milestoneId !== null) {
                    const marked = await this.contracts.markMilestone(ws, inv.milestoneId, 'invoiced');
                    if (!marked.ok) return marked;
                }
            }
            await this.repo.deleteAdvanceEntriesOfReceipt(ws, r.id);
            const voided = await this.numbering.void({ workspaceId: ws, docType: 'receipt', subjectId: r.id, reason: body.reason, by: userId });
            if (!voided.ok) return voided;
            const reversed = await this.issuer.reverseSource(ws, 'ar_receipt', r.id, userId, today);
            if (!reversed.ok) return reversed;
            const out: ReceiptRecord = { ...r, status: 'voided', voidReason: body.reason, voidedAt: now, voidedBy: userId };
            await this.repo.saveReceipt(out);
            await this.audit.record({
                workspaceId: ws, projectId: r.projectId, actor: userId, entityType: 'ar_receipt', entityId: r.id, action: 'void',
                data: { status: [r.status, 'voided'], number: r.number, reason: body.reason },
            });
            return ok(out);
        });
        if (!done.ok) return done;
        return ok(await this.views.dto(done.value, loaded.value.grant.role, this.clock.now()));
    }
}

// ── tax invoice ahead of payment, credit note ──

/**
 * POST /invoices/:invoiceId/tax-invoice — `billing.receive`; a tax invoice for everything of a claim / advance invoice not on
 * one yet (422 `not_vat_registered`, `customer_tax_id_required`, `tax_invoice_not_applicable`; 409 `tax_invoice_complete`).
 */
@Injectable()
export class IssueTaxInvoiceUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly company: CompanyProfiles,
        private readonly writer: TaxDocumentWriter,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; invoiceId: string; body: IssueTaxInvoiceRequest }): Promise<Result<InvoiceDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.invoice(userId, input.invoiceId, ['billing.receive'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<InvoiceRecord, DomainError>> => {
            const inv = await this.repo.lockInvoice(ws, loaded.value.invoice.id);
            if (inv === undefined) return err(DomainError.notFound('Invoice'));
            if (!RECEIVABLE_KIND(inv) || !TAX_INVOICE_SOURCES.has(inv.source)) {
                return err(DomainError.unprocessable('This document does not take a tax invoice', { reason: 'tax_invoice_not_applicable' }));
            }
            const allowed = requireInvoiceStatus(inv.status, ['issued', 'partially_paid', 'paid']);
            if (!allowed.ok) return allowed;
            const vat = TaxDocumentWriter.requireVat(await this.company.get(ws));
            if (!vat.ok) return vat;
            const left = remainingTaxInvoice(inv, liveTaxInvoices(await this.repo.relatedInvoices(ws, inv.id)));
            if (!hasPart(left)) return err(DomainError.conflict('The invoice is on tax invoices in full already', { reason: 'tax_invoice_complete' }));
            const taxId = await this.writer.requireCustomerTaxId(ws, inv.customerId);
            if (!taxId.ok) return taxId;
            const now = this.clock.now();
            const ti = await this.writer.create(inv, left, {
                issueDate: body.issueDate ?? bangkokToday(now), language: body.language ?? inv.language, note: body.note ?? '', by: userId, now, receiptId: null,
            });
            if (!ti.ok) return ti;
            await this.audit.record({
                workspaceId: ws, projectId: inv.projectId, actor: userId, entityType: 'ar_invoice', entityId: ti.value.id, action: 'issue',
                data: { kind: 'tax_invoice', number: ti.value.number, invoiceId: inv.id, net: ti.value.net, vat: ti.value.vat },
            });
            return ti;
        });
        if (!done.ok) return done;
        return ok(invoiceDto(done.value));
    }
}

/**
 * POST /invoices/:invoiceId/credit-note — `billing.receive`; the invoice is an issued tax invoice. A credit note (`CN`) for
 * `amount` (without VAT) at most what is not credited yet (422 `credit_note_exceeds`), `ar.credit_noted`.
 */
@Injectable()
export class CreateCreditNoteUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly company: CompanyProfiles,
        private readonly customers: CustomerLookup,
        private readonly numbering: DocumentNumbering,
        private readonly issuer: InvoiceIssuer,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; invoiceId: string; body: CreateCreditNoteRequest }): Promise<Result<InvoiceDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.invoice(userId, input.invoiceId, ['billing.receive'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<InvoiceRecord, DomainError>> => {
            const ti = await this.repo.lockInvoice(ws, loaded.value.invoice.id);
            if (ti === undefined) return err(DomainError.notFound('Invoice'));
            if (ti.kind !== 'tax_invoice') {
                return err(DomainError.unprocessable('A credit note reduces a tax invoice', { reason: 'credit_note_needs_tax_invoice' }));
            }
            const allowed = requireInvoiceStatus(ti.status, ['issued']);
            if (!allowed.ok) return allowed;
            const company = await this.company.get(ws);
            const vatOk = TaxDocumentWriter.requireVat(company);
            if (!vatOk.ok) return vatOk;
            const credited = liveCreditNotes(await this.repo.relatedInvoices(ws, ti.id));
            const left = remainingTaxInvoice(ti, credited);
            const amount = round2(body.amount);
            if (amount > left.net) {
                return err(DomainError.unprocessable('The amount is above what is left on the tax invoice', { reason: 'credit_note_exceeds', available: left.net }));
            }
            const rate = ti.companySnapshot?.vatRate ?? company.vatRate;
            const vat = amount === left.net ? left.vat : round2(Math.min(left.vat, amount * rate));
            const now = this.clock.now();
            const issueDate = body.issueDate ?? bangkokToday(now);
            const language = body.language ?? ti.language;
            const id = this.ids.newId();
            const customerSnapshot = await this.customers.snapshot(ws, ti.customerId, language);
            if (customerSnapshot === undefined) return err(DomainError.notFound('Customer'));
            const number = await this.numbering.issue({
                workspaceId: ws, docType: 'credit_note', issueDate, subjectType: 'ar_invoice', subjectId: id, projectId: ti.projectId, issuedBy: userId,
            });
            if (!number.ok) return number;
            const text = creditNoteText(ti.number, body.reason);
            const total = round2(amount + vat);
            const cn: InvoiceRecord = {
                id, workspaceId: ws, projectId: ti.projectId, contractId: ti.contractId, claimId: ti.claimId, milestoneId: null,
                customerId: ti.customerId, kind: 'credit_note', source: 'receipt', number: number.value.number, status: 'issued', issueDate,
                dueDate: issueDate, language, customerSnapshot, companySnapshot: await this.company.snapshot(ws, language),
                lines: [{ descTh: text.th, descEn: text.en, amount }], net: amount, vat, total, retention: 0, advanceRecovery: 0, penalty: 0,
                whtExpected: 0, payable: total, paidAmount: 0, relatedInvoiceId: ti.id, note: body.reason, voidReason: '', issuedBy: userId,
                issuedAt: now, createdBy: userId, createdAt: now, updatedAt: now,
            };
            await this.repo.insertInvoice(cn);
            const posted = await this.issuer.post(cn, 'ar.credit_noted', { net: amount, vat }, userId, {
                taxInvoiceId: ti.id, taxInvoiceNumber: ti.number, invoiceId: ti.relatedInvoiceId, reason: body.reason,
            });
            if (!posted.ok) return posted;
            await this.audit.record({
                workspaceId: ws, projectId: ti.projectId, actor: userId, entityType: 'ar_invoice', entityId: cn.id, action: 'issue',
                data: { kind: 'credit_note', number: cn.number, taxInvoiceId: ti.id, net: amount, vat, reason: body.reason },
            });
            return ok(cn);
        });
        if (!done.ok) return done;
        return ok(invoiceDto(done.value));
    }
}

// ── receivables ──

/** GET /workspaces/:workspaceId/receivables/aging — `billing.read`; open invoices by days past due (Bangkok today). */
@Injectable()
export class ReceivablesAgingUseCase {
    constructor(private readonly access: BillingAccess, private readonly repo: BillingRepository, private readonly clock: Clock) {}

    async execute(userId: UserId, workspaceId: WorkspaceId): Promise<Result<ArAgingDto, DomainError>> {
        const grant = await this.access.workspace(userId, workspaceId, ['billing.read']);
        if (!grant.ok) return grant;
        const today = bangkokToday(this.clock.now());
        const invoices = await this.repo.openInvoices(grant.value.workspaceId);
        const rows = invoices.map(i => ({
            invoiceId: i.id, number: i.number, kind: i.kind, projectId: i.projectId, customerId: i.customerId,
            customerName: i.customerSnapshot?.name ?? '', issueDate: i.issueDate, dueDate: i.dueDate, due: invoiceDue(i),
            paidAmount: i.paidAmount, outstanding: invoiceOutstanding(i, i.paidAmount), daysOverdue: Math.max(0, daysOverdue(i.dueDate, today)),
            bucket: agingBucket(i.dueDate, today),
        }));
        const all = agingSummary(rows, today);
        const byCustomer = new Map<string, typeof rows>();
        for (const r of rows) byCustomer.set(r.customerId, [...(byCustomer.get(r.customerId) ?? []), r]);
        const customers = [...byCustomer.entries()].map(([customerId, items]) => {
            const s = agingSummary(items, today);
            return { customerId, customerName: items[0]?.customerName ?? '', buckets: s.buckets, total: s.total, overdue: s.overdue };
        }).sort((a, b) => b.total - a.total);
        return ok({ asOf: today, buckets: all.buckets, total: all.total, overdue: all.overdue, customers, invoices: rows });
    }
}

/** GET /customers/:customerId/statement?from&to — `billing.read`; invoices (debit) and receipts (credit) with a running balance. */
@Injectable()
export class CustomerStatementUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly customers: CustomerLookup,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, customerId: string, query: CustomerStatementQuery): Promise<Result<CustomerStatementDto, DomainError>> {
        if (!isUuid(customerId)) return err(DomainError.notFound('Customer'));
        const id = customerId.toLowerCase();
        const where = await this.customers.locate(id);
        if (where === undefined) return err(DomainError.notFound('Customer'));
        const grant = await this.access.workspace(userId, where, ['billing.read']);
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('Customer')) : grant;
        const ws = grant.value.workspaceId;
        const customer = await this.customers.find(ws, id);
        if (customer === undefined) return err(DomainError.notFound('Customer'));
        const to = query.to ?? bangkokToday(this.clock.now());
        const from = query.from ?? null;
        if (from !== null && from > to) return err(DomainError.validation('from is after to', { reason: 'invalid_range' }));

        const invoices = (await this.repo.invoicesOfCustomer(ws, id)).filter(i => RECEIVABLE_KIND(i) && i.status !== 'draft' && i.status !== 'voided');
        const receipts = (await this.repo.receiptsOfCustomer(ws, id)).filter(r => r.status === 'issued');
        const allocs = await this.repo.allocationsOf(ws, receipts.map(r => r.id));
        const moves = [
            ...invoices.map(i => ({
                date: i.issueDate, order: 0, type: 'invoice' as const, documentId: i.id, number: i.number, kind: i.kind, projectId: i.projectId,
                debit: invoiceDue(i), credit: 0,
            })),
            ...receipts.map(r => ({
                date: r.receiptDate, order: 1, type: 'receipt' as const, documentId: r.id, number: r.number, kind: null, projectId: r.projectId,
                debit: 0, credit: sumMoney(allocs.filter(a => a.receiptId === r.id).map(a => a.settled)),
            })),
        ].filter(m => m.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
        const before = from === null ? [] : moves.filter(m => m.date < from);
        const opening = round2(sumMoney(before.map(m => m.debit)) - sumMoney(before.map(m => m.credit)));
        let balance = opening;
        const entries = moves.filter(m => from === null || m.date >= from).map(m => {
            balance = round2(balance + m.debit - m.credit);
            return {
                date: m.date, type: m.type, documentId: m.documentId, number: m.number, kind: m.kind, projectId: m.projectId,
                debit: m.debit, credit: m.credit, balance,
            };
        });
        return ok({
            customerId: id, customerName: customer.nameTh || customer.nameEn, from, to, openingBalance: opening, entries, closingBalance: balance,
            openInvoices: invoices.filter(OPEN_RECEIVABLE).map(invoiceDto),
        });
    }
}

/** GET /invoices/:invoiceId/promptpay — `billing.read`; payload of the cash still to pay on an open invoice. */
@Injectable()
export class InvoicePromptPayUseCase {
    constructor(private readonly access: BillingAccess, private readonly company: CompanyProfiles) {}

    async execute(userId: UserId, invoiceId: string): Promise<Result<InvoicePromptPayDto, DomainError>> {
        const loaded = await this.access.invoice(userId, invoiceId, ['billing.read'], false);
        if (!loaded.ok) return loaded;
        const inv = loaded.value.invoice;
        if (!RECEIVABLE_KIND(inv)) return err(notReceivable(inv));
        const company = await this.company.get(loaded.value.grant.workspaceId);
        return promptPayFor(inv, company.promptpayId);
    }
}
