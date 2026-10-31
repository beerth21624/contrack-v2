// ─── Receivables (WP-30): tax invoice writer, receipt DTO, PromptPay, daily sweeps, customer link, BillingTotals ───
import { Injectable, Logger } from '@nestjs/common';
import type { InvoiceLinkPayload, InvoicePromptPayDto, ReceiptDto, Role } from '@contrack/contract';
import {
    advanceTotals, arRetentionTotals, invoiceDue, invoiceOutstanding, retentionReleasePlan, type TaxInvoicePart,
} from '@contrack/domain/billing';
import { addDays, bangkokToday, daysBetween } from '@contrack/domain/dates/business-date';
import { round2, sumMoney } from '@contrack/domain/money';
import { promptPayPayload } from '@contrack/domain/payments/promptpay';
import {
    BillingTotals, type CompanyProfile, CompanyProfiles, type CustomerLinkSubjectView, CustomerLookup, DocumentNumbering, IdGenerator,
    MainContracts, ModuleFlags, Notifier, ProjectCatalog, type ProjectBillingTotals, type SweepContext, SweepMarks, WorkspaceDirectory,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../shared/domain/ids';
import { type Permission, can } from '../../../shared/domain/permissions';
import { type Result, err, ok, okVoid } from '../../../shared/domain/result';
import { taxInvoiceText } from '../domain/billing-rules';
import { InvoiceIssuer, MODULE, OPEN_RECEIVABLE, RECEIVABLE_KIND } from './billing.service';
import { invoiceDto } from './billing-views';
import { BillingRepository, type InvoiceRecord, type ReceiptAllocationRecord, type ReceiptRecord } from './ports/billing.repository';

export const INVOICE_DUE_SWEEP = 'billing.invoice-due';
export const RETENTION_DUE_SWEEP = 'billing.retention-release-due';
/** Overdue notices on these days after the due date; the due-soon notice from this many days before. */
const OVERDUE_DAYS = new Set([1, 7, 30]);
const DUE_SOON_DAYS = 3;

/** Invoice sources that get tax invoices (a retention release had its VAT on the claim already). */
export const TAX_INVOICE_SOURCES = new Set<InvoiceRecord['source']>(['claim', 'advance']);

/** Tax invoices of an invoice that are not voided. */
export const liveTaxInvoices = (related: readonly InvoiceRecord[]): InvoiceRecord[] =>
    related.filter(r => r.kind === 'tax_invoice' && r.status !== 'voided');

/** Credit notes of a tax invoice that are not voided. */
export const liveCreditNotes = (related: readonly InvoiceRecord[]): InvoiceRecord[] =>
    related.filter(r => r.kind === 'credit_note' && r.status !== 'voided');

/** Cash still to pay on an invoice: what is outstanding less the WHT share the customer will withhold. */
export function cashDue(inv: InvoiceRecord): number {
    const due = invoiceDue(inv);
    if (due <= 0) return 0;
    return round2(invoiceOutstanding(inv, inv.paidAmount) * (inv.payable / due));
}

/** Same Bangkok day as `createdAt`: a receipt may still be voided. */
export const voidableToday = (r: ReceiptRecord, now: Date): boolean => r.status === 'issued' && bangkokToday(r.createdAt) === bangkokToday(now);

/** PromptPay payload of an open invoice (company PromptPay id): 422 `promptpay_not_set` / `promptpay_invalid`. */
export function promptPayFor(inv: InvoiceRecord, promptpayId: string): Result<InvoicePromptPayDto, DomainError> {
    if (!OPEN_RECEIVABLE(inv)) return err(DomainError.conflict(`The invoice is ${inv.status}`, { reason: 'invalid_transition', status: inv.status }));
    const id = promptpayId.trim();
    if (id === '') return err(DomainError.unprocessable('The company has no PromptPay id', { reason: 'promptpay_not_set' }));
    const amount = cashDue(inv);
    try {
        return ok({ invoiceId: inv.id, promptpayId: id, amount, payload: promptPayPayload({ id, amount }) });
    } catch {
        return err(DomainError.unprocessable('The PromptPay id of the company is not valid', { reason: 'promptpay_invalid' }));
    }
}

/** Issues tax invoices (number `TI`) and checks they may be issued. Call inside the caller's transaction. */
@Injectable()
export class TaxDocumentWriter {
    constructor(
        private readonly repo: BillingRepository,
        private readonly numbering: DocumentNumbering,
        private readonly company: CompanyProfiles,
        private readonly customers: CustomerLookup,
        private readonly issuer: InvoiceIssuer,
        private readonly ids: IdGenerator,
    ) {}

    /** 422 `not_vat_registered` when the company does not charge VAT. */
    static requireVat(company: CompanyProfile): Result<void, DomainError> {
        return company.vatRegistered
            ? okVoid()
            : err(DomainError.unprocessable('The company is not VAT registered', { reason: 'not_vat_registered' }));
    }

    /** 422 `customer_tax_id_required` for a juristic customer without a tax id (a full tax invoice names it). */
    async requireCustomerTaxId(workspaceId: WorkspaceId, customerId: string): Promise<Result<void, DomainError>> {
        const c = await this.customers.find(workspaceId, customerId);
        if (c === undefined) return err(DomainError.notFound('Customer'));
        if (c.kind === 'juristic' && c.taxId.trim() === '') {
            return err(DomainError.unprocessable('The customer has no tax id', { reason: 'customer_tax_id_required' }));
        }
        return okVoid();
    }

    /** Tax invoice `part` of `inv`, numbered and saved, with its `ar.tax_invoiced` event. */
    async create(
        inv: InvoiceRecord, part: TaxInvoicePart,
        opts: { issueDate: string; language: InvoiceRecord['language']; note: string; by: UserId; now: Date; receiptId: string | null },
    ): Promise<Result<InvoiceRecord, DomainError>> {
        const ws = inv.workspaceId;
        const id = this.ids.newId();
        const customerSnapshot = await this.customers.snapshot(ws, inv.customerId, opts.language);
        if (customerSnapshot === undefined) return err(DomainError.notFound('Customer'));
        const issued = await this.numbering.issue({
            workspaceId: ws, docType: 'tax_invoice', issueDate: opts.issueDate, subjectType: 'ar_invoice', subjectId: id,
            projectId: inv.projectId, issuedBy: opts.by,
        });
        if (!issued.ok) return issued;
        const companySnapshot = await this.company.snapshot(ws, opts.language);
        const text = taxInvoiceText(inv.number);
        const ti: InvoiceRecord = {
            id, workspaceId: ws, projectId: inv.projectId, contractId: inv.contractId, claimId: inv.claimId, milestoneId: null,
            customerId: inv.customerId, kind: 'tax_invoice', source: 'receipt', number: issued.value.number, status: 'issued',
            issueDate: opts.issueDate, dueDate: opts.issueDate, language: opts.language, customerSnapshot, companySnapshot,
            lines: [{ descTh: text.th, descEn: text.en, amount: part.net }], net: part.net, vat: part.vat, total: part.total, retention: 0,
            advanceRecovery: 0, penalty: 0, whtExpected: 0, payable: part.total, paidAmount: 0, relatedInvoiceId: inv.id, note: opts.note,
            voidReason: '', issuedBy: opts.by, issuedAt: opts.now, createdBy: opts.by, createdAt: opts.now, updatedAt: opts.now,
        };
        await this.repo.insertInvoice(ti);
        const posted = await this.issuer.post(ti, 'ar.tax_invoiced', { net: ti.net, vat: ti.vat }, opts.by, {
            invoiceId: inv.id, invoiceNumber: inv.number, receiptId: opts.receiptId,
        });
        if (!posted.ok) return posted;
        return ok(ti);
    }
}

/** Receipt → DTO (allocations with invoice numbers, its tax invoices, whether it may still be voided). */
@Injectable()
export class ReceiptViews {
    constructor(private readonly repo: BillingRepository) {}

    async dto(r: ReceiptRecord, role: Role, now: Date, allocations?: readonly ReceiptAllocationRecord[]): Promise<ReceiptDto> {
        const allocs = allocations ?? await this.repo.allocationsOf(r.workspaceId, [r.id]);
        const invoices = new Map<string, InvoiceRecord>();
        for (const id of [...allocs.map(a => a.invoiceId), ...r.taxInvoiceIds]) {
            const inv = await this.repo.findInvoice(id);
            if (inv?.workspaceId === r.workspaceId) invoices.set(id, inv);
        }
        return {
            id: r.id, customerId: r.customerId, projectId: r.projectId, number: r.number, receiptDate: r.receiptDate, method: r.method,
            bankRef: r.bankRef, cashAmount: r.cashAmount, whtAmount: r.whtAmount, whtCertificateNo: r.whtCertificateNo,
            whtCertificateFileId: r.whtCertificateFileId, taxInvoiceIds: [...r.taxInvoiceIds], status: r.status, fileIds: [...r.fileIds],
            language: r.language, customerSnapshot: r.customerSnapshot, companySnapshot: r.companySnapshot, note: r.note,
            voidReason: r.voidReason, voidedAt: r.voidedAt?.toISOString() ?? null,
            allocations: allocs.map(a => ({
                invoiceId: a.invoiceId, invoiceNumber: invoices.get(a.invoiceId)?.number ?? null, projectId: invoices.get(a.invoiceId)?.projectId ?? null,
                cash: a.cash, wht: a.wht, settled: a.settled, taxInvoiceId: a.taxInvoiceId,
            })),
            taxInvoices: r.taxInvoiceIds.flatMap(id => {
                const ti = invoices.get(id);
                return ti === undefined ? [] : [invoiceDto(ti)];
            }),
            canVoid: voidableToday(r, now) && can(role, 'billing.receive'),
            createdBy: r.createdBy, createdAt: r.createdAt.toISOString(),
        };
    }
}

/** BillingTotals (closeout): figures of one project from the invoices and the customer ledgers. */
@Injectable()
export class RepositoryBillingTotals extends BillingTotals {
    constructor(private readonly repo: BillingRepository) {
        super();
    }

    async totalsByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<ProjectBillingTotals> {
        const invoices = (await this.repo.invoicesOfProjects(workspaceId, [projectId]))
            .filter(i => RECEIVABLE_KIND(i) && i.status !== 'draft' && i.status !== 'voided');
        const retention = arRetentionTotals(await this.repo.retentionEntriesOfProjects(workspaceId, [projectId]));
        const advance = advanceTotals(await this.repo.advanceEntriesOfProjects(workspaceId, [projectId]));
        return {
            billed: sumMoney(invoices.filter(i => i.source === 'claim' || i.source === 'advance').map(i => i.net)),
            received: sumMoney(invoices.map(i => i.paidAmount)),
            retentionHeld: retention.balance,
            advanceOutstanding: advance.balance,
        };
    }
}

/** Daily sweeps (invoice due / overdue, retention release due) and the customer link of an invoice. */
@Injectable()
export class ReceivablesHandlers {
    private readonly logger = new Logger(ReceivablesHandlers.name);

    constructor(
        private readonly repo: BillingRepository,
        private readonly flags: ModuleFlags,
        private readonly marks: SweepMarks,
        private readonly directory: WorkspaceDirectory,
        private readonly catalog: ProjectCatalog,
        private readonly contracts: MainContracts,
        private readonly company: CompanyProfiles,
        private readonly notifier: Notifier,
    ) {}

    /** Members of a workspace with `permission`, cached per sweep run; [] when the module is off there. */
    private recipients(cache: Map<WorkspaceId, UserId[]>, permission: Permission) {
        return async (ws: WorkspaceId): Promise<UserId[]> => {
            let ids = cache.get(ws);
            if (ids === undefined) {
                ids = (await this.flags.isEnabled(ws, MODULE))
                    ? (await this.directory.members(ws)).filter(m => can(m.role, permission)).map(m => m.userId)
                    : [];
                cache.set(ws, ids);
            }
            return ids;
        };
    }

    private href(projectId: ProjectId | null): string {
        return projectId === null ? '/receivables' : `/p/${projectId}/billing`;
    }

    /** `invoice.due_soon` once per invoice from 3 days before its due date; `invoice.overdue` on days 1, 7 and 30 after it. */
    async invoiceDue(ctx: SweepContext): Promise<void> {
        if (!this.flags.platformEnabled(MODULE)) return;
        const toUsers = this.recipients(new Map(), 'billing.read');
        const invoices = await this.repo.openInvoicesDueBetween(addDays(ctx.today, -30), addDays(ctx.today, DUE_SOON_DAYS), 5000);
        for (const inv of invoices) {
            try {
                const days = daysBetween(inv.dueDate, ctx.today);
                const soon = days >= -DUE_SOON_DAYS && days <= -1;
                if (!soon && !OVERDUE_DAYS.has(days)) continue;
                const toUserIds = await toUsers(inv.workspaceId);
                if (toUserIds.length === 0) continue;
                // Due soon: the due date as the mark's date (one notice per invoice); overdue: one per notice day.
                const marked = soon
                    ? await this.marks.markOnce(INVOICE_DUE_SWEEP, `${inv.id}:due_soon`, inv.dueDate)
                    : await this.marks.markOnce(INVOICE_DUE_SWEEP, `${inv.id}:overdue:${days}`, ctx.today);
                if (!marked) continue;
                await this.notifier.notify({
                    template: soon ? 'invoice.due_soon' : 'invoice.overdue',
                    toUserIds,
                    payload: {
                        docNumber: inv.number ?? '',
                        customerName: inv.customerSnapshot?.name ?? '',
                        amount: invoiceOutstanding(inv, inv.paidAmount),
                        date: inv.dueDate,
                        ...(soon ? {} : { days }),
                        href: this.href(inv.projectId),
                    },
                });
            } catch (e) {
                this.logger.error(`${INVOICE_DUE_SWEEP} ${inv.id}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }

    /** `retention.release_due` once per release stage (completion / warranty end) that is due and still held. */
    async retentionDue(ctx: SweepContext): Promise<void> {
        if (!this.flags.platformEnabled(MODULE)) return;
        const toUsers = this.recipients(new Map(), 'billing.read');
        for (const { workspaceId, contractId } of await this.repo.contractsWithRetention(5000)) {
            try {
                const toUserIds = await toUsers(workspaceId);
                if (toUserIds.length === 0) continue;
                const contract = await this.contracts.find(workspaceId, contractId);
                if (contract?.completedAt == null) continue;
                const plan = retentionReleasePlan(await this.repo.retentionEntries(workspaceId, contractId), {
                    release: contract.terms.retentionRelease, completedAt: contract.completedAt, warrantyMonths: contract.terms.warrantyMonths,
                });
                for (const s of plan.schedule) {
                    if (s.amount <= 0 || s.dueAt === null || s.dueAt > ctx.today) continue;
                    if (!(await this.marks.markOnce(RETENTION_DUE_SWEEP, `${contractId}:${s.stage}`, s.dueAt))) continue;
                    const projectName = (await this.catalog.find(workspaceId, contract.projectId))?.name ?? '';
                    await this.notifier.notify({
                        template: 'retention.release_due',
                        toUserIds,
                        payload: {
                            projectName, title: contract.number ?? contract.title, amount: s.amount, date: s.dueAt, href: this.href(contract.projectId),
                        },
                    });
                }
            } catch (e) {
                this.logger.error(`${RETENTION_DUE_SWEEP} ${contractId}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }

    /** Customer link `invoice` (view only): the invoice, what is left, PromptPay payload and the company's bank accounts. */
    async linkView(workspaceId: WorkspaceId, subjectId: string): Promise<CustomerLinkSubjectView | undefined> {
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return undefined;
        const inv = await this.repo.findInvoice(subjectId.toLowerCase());
        if (inv?.workspaceId !== workspaceId || inv.projectId === null || !RECEIVABLE_KIND(inv)) return undefined;
        if (inv.status === 'draft' || inv.status === 'voided') return undefined;
        const company = await this.company.get(workspaceId);
        const pp = OPEN_RECEIVABLE(inv) && company.promptpayId.trim() !== '' ? promptPayFor(inv, company.promptpayId) : undefined;
        const payload: InvoiceLinkPayload = {
            invoice: invoiceDto(inv),
            projectName: (await this.catalog.find(workspaceId, inv.projectId))?.name ?? '',
            outstanding: invoiceOutstanding(inv, inv.paidAmount),
            promptpay: pp?.ok === true && pp.value.amount > 0 ? pp.value : null,
            bankAccounts: inv.companySnapshot?.bankAccounts ?? company.bankAccounts,
        };
        return { projectId: inv.projectId, language: inv.language, title: inv.number ?? '', respondable: false, payload };
    }
}
