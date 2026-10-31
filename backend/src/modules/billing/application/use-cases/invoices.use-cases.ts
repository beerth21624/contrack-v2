// ─── Invoice use cases (docs/erp/04-implementation-plan.md WP-29, docs/erp/02-domain-model.md §4.2, §4.4) ───
// Read `billing.read`; advance / retention release invoices, issue, void `billing.manage`. Receipts are WP-30.
import { Injectable } from '@nestjs/common';
import type {
    ContractAdvanceDto, ContractRetentionDto, CreateAdvanceInvoiceRequest, CreateRetentionReleaseInvoiceRequest, DocLanguage, InvoiceDto,
    IssueInvoiceRequest, MainContractStatus, VoidInvoiceRequest,
} from '@contrack/contract';
import { advanceInvoiceAmounts, arRetentionTotals, retentionReleaseInvoiceAmounts } from '@contrack/domain/billing';
import { addDays, bangkokToday, daysBetween } from '@contrack/domain/dates/business-date';
import { round2 } from '@contrack/domain/money';
import {
    AuditLog, Clock, CostCodeLookup, DocumentNumbering, IdGenerator, type MainContractInfo, MainContracts, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { INVOICE_TEXT } from '../../domain/billing-rules';
import { requireInvoiceStatus } from '../../domain/billing-state';
import { BillingAccess, InvoiceIssuer, transact } from '../billing.service';
import { BillingViews, advanceAmountOf, invoiceDto, liveAdvanceInvoice, pendingRelease } from '../billing-views';
import { BillingRepository, type InvoiceRecord } from '../ports/billing.repository';

const contractNotBillable = (status: string): DomainError =>
    DomainError.conflict('The contract is not signed', { reason: 'contract_not_signed', status });

/** Retention may be paid back while the contract is signed, completed or closed. */
const RETENTION_CONTRACT: readonly MainContractStatus[] = ['signed', 'completed', 'closed'];
/** The advance invoice may be issued while the contract is signed or completed. */
const ADVANCE_CONTRACT: readonly MainContractStatus[] = ['signed', 'completed'];

const releaseExceeds = (releasable: number): DomainError =>
    DomainError.unprocessable('The amount is above the retention still held', { reason: 'retention_release_exceeds_balance', releasable });

/** Dates and language of a new invoice (defaults: today, + payment term days, the contract's language). */
function invoiceDates(
    contract: MainContractInfo, body: { issueDate?: string; dueDate?: string; language?: DocLanguage }, today: string,
): Result<{ issueDate: string; dueDate: string; language: DocLanguage }, DomainError> {
    const issueDate = body.issueDate ?? today;
    const dueDate = body.dueDate ?? addDays(issueDate, contract.terms.paymentTermDays);
    if (dueDate < issueDate) return err(DomainError.validation('dueDate is before issueDate', { reason: 'due_before_issue' }));
    return ok({ issueDate, dueDate, language: body.language ?? contract.language });
}

// ── reads ──

/** GET /projects/:projectId/invoices — `billing.read`, newest first. */
@Injectable()
export class ListProjectInvoicesUseCase {
    constructor(private readonly access: BillingAccess, private readonly repo: BillingRepository) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<InvoiceDto[], DomainError>> {
        const grant = await this.access.project(userId, projectId, ['billing.read']);
        if (!grant.ok) return grant;
        return ok((await this.repo.invoicesOfProject(grant.value.workspaceId, projectId)).map(invoiceDto));
    }
}

/** GET /invoices/:invoiceId — `billing.read`. */
@Injectable()
export class GetInvoiceUseCase {
    constructor(private readonly access: BillingAccess) {}

    async execute(userId: UserId, invoiceId: string): Promise<Result<InvoiceDto, DomainError>> {
        const loaded = await this.access.invoice(userId, invoiceId, ['billing.read'], false);
        if (!loaded.ok) return loaded;
        return ok(invoiceDto(loaded.value.invoice));
    }
}

/** GET /main-contracts/:contractId/retention — `billing.read`: ledger, totals and the release plan. */
@Injectable()
export class GetContractRetentionUseCase {
    constructor(private readonly access: BillingAccess, private readonly views: BillingViews) {}

    async execute(userId: UserId, contractId: string): Promise<Result<ContractRetentionDto, DomainError>> {
        const loaded = await this.access.contract(userId, contractId, ['billing.read'], false);
        if (!loaded.ok) return loaded;
        return ok(await this.views.retention(loaded.value.contract));
    }
}

/** GET /main-contracts/:contractId/advance — `billing.read`: advance ledger and its invoice. */
@Injectable()
export class GetContractAdvanceUseCase {
    constructor(private readonly access: BillingAccess, private readonly views: BillingViews) {}

    async execute(userId: UserId, contractId: string): Promise<Result<ContractAdvanceDto, DomainError>> {
        const loaded = await this.access.contract(userId, contractId, ['billing.read'], false);
        if (!loaded.ok) return loaded;
        return ok(await this.views.advance(loaded.value.grant, loaded.value.contract));
    }
}

// ── writes ──

/**
 * POST /main-contracts/:contractId/advance-invoice — `billing.manage`; a draft advance invoice (VAT and WHT on the
 * advance) when the contract is signed, `advancePct > 0` and no advance invoice exists (409 `advance_invoice_exists`).
 */
@Injectable()
export class CreateAdvanceInvoiceUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; contractId: string; body: CreateAdvanceInvoiceRequest }): Promise<Result<InvoiceDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.contract(userId, input.contractId, ['billing.manage'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<InvoiceRecord, DomainError>> => {
            const contract = await this.contracts.find(ws, loaded.value.contract.id);
            if (contract === undefined) return err(DomainError.notFound('MainContract'));
            if (contract.status !== 'signed') return err(contractNotBillable(contract.status));
            if (contract.terms.advancePct <= 0) return err(DomainError.unprocessable('The contract has no advance payment', { reason: 'no_advance' }));
            if (liveAdvanceInvoice(await this.repo.invoicesOfContract(ws, contract.id)) !== undefined) {
                return err(DomainError.conflict('The advance invoice exists already', { reason: 'advance_invoice_exists' }));
            }
            const now = this.clock.now();
            const dates = invoiceDates(contract, body, bangkokToday(now));
            if (!dates.ok) return dates;
            const amount = advanceAmountOf(contract);
            const milestone = contract.milestones.find(m => m.kind === 'advance');
            const label = { th: milestone?.labelTh.trim() ? milestone.labelTh : INVOICE_TEXT.advance.th, en: milestone?.labelEn.trim() ? milestone.labelEn : INVOICE_TEXT.advance.en };
            const inv: InvoiceRecord = {
                id: this.ids.newId(), workspaceId: ws, projectId: contract.projectId, contractId: contract.id, claimId: null,
                milestoneId: milestone?.id ?? null, customerId: contract.customerId, kind: 'advance_invoice', source: 'advance', number: null,
                status: 'draft', ...dates.value, customerSnapshot: null, companySnapshot: null,
                lines: [{ descTh: label.th, descEn: label.en, amount }],
                ...advanceInvoiceAmounts(amount, contract.vatRate, contract.terms.customerWhtRate), paidAmount: 0, relatedInvoiceId: null,
                note: body.note ?? '', voidReason: '', issuedBy: null, issuedAt: null, createdBy: userId, createdAt: now, updatedAt: now,
            };
            await this.repo.insertInvoice(inv);
            await this.audit.record({
                workspaceId: ws, projectId: contract.projectId, actor: userId, entityType: 'ar_invoice', entityId: inv.id, action: 'create_invoice',
                data: { source: 'advance', net: inv.net, total: inv.total },
            });
            return ok(inv);
        });
        if (!done.ok) return done;
        return ok(invoiceDto(done.value));
    }
}

/**
 * POST /main-contracts/:contractId/retention-release-invoice — `billing.manage`; a draft invoice paying back retention
 * (no VAT / WHT), at most what is held minus other draft releases (422 `retention_release_exceeds_balance`).
 */
@Injectable()
export class CreateRetentionReleaseInvoiceUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; contractId: string; body: CreateRetentionReleaseInvoiceRequest }): Promise<Result<InvoiceDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.contract(userId, input.contractId, ['billing.manage'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<InvoiceRecord, DomainError>> => {
            const contract = await this.contracts.find(ws, loaded.value.contract.id);
            if (contract === undefined) return err(DomainError.notFound('MainContract'));
            if (!RETENTION_CONTRACT.includes(contract.status)) return err(contractNotBillable(contract.status));
            const amount = round2(body.amount);
            const balance = arRetentionTotals(await this.repo.retentionEntries(ws, contract.id)).balance;
            const releasable = round2(Math.max(0, balance - pendingRelease(await this.repo.invoicesOfContract(ws, contract.id))));
            if (amount > releasable) return err(releaseExceeds(releasable));
            const now = this.clock.now();
            const dates = invoiceDates(contract, body, bangkokToday(now));
            if (!dates.ok) return dates;
            const inv: InvoiceRecord = {
                id: this.ids.newId(), workspaceId: ws, projectId: contract.projectId, contractId: contract.id, claimId: null, milestoneId: null,
                customerId: contract.customerId, kind: 'invoice', source: 'retention_release', number: null, status: 'draft', ...dates.value,
                customerSnapshot: null, companySnapshot: null,
                lines: [{ descTh: INVOICE_TEXT.retentionRelease.th, descEn: INVOICE_TEXT.retentionRelease.en, amount }],
                ...retentionReleaseInvoiceAmounts(amount), paidAmount: 0, relatedInvoiceId: null, note: body.note ?? '', voidReason: '',
                issuedBy: null, issuedAt: null, createdBy: userId, createdAt: now, updatedAt: now,
            };
            await this.repo.insertInvoice(inv);
            await this.audit.record({
                workspaceId: ws, projectId: contract.projectId, actor: userId, entityType: 'ar_invoice', entityId: inv.id, action: 'create_invoice',
                data: { source: 'retention_release', net: inv.net },
            });
            return ok(inv);
        });
        if (!done.ok) return done;
        return ok(invoiceDto(done.value));
    }
}

/**
 * POST /invoices/:invoiceId/issue — `billing.manage`, draft → issued (number `INV`, snapshots). Advance: `ar.advance_invoiced`,
 * milestone 0 → invoiced. Retention release: ledger `released` + `ar.retention_released`.
 */
@Injectable()
export class IssueInvoiceUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly issuer: InvoiceIssuer,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; invoiceId: string; body: IssueInvoiceRequest }): Promise<Result<InvoiceDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.invoice(userId, input.invoiceId, ['billing.manage'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<InvoiceRecord, DomainError>> => {
            const inv = await this.repo.lockInvoice(ws, loaded.value.invoice.id);
            if (inv === undefined) return err(DomainError.notFound('Invoice'));
            const allowed = requireInvoiceStatus(inv.status, ['draft']);
            if (!allowed.ok) return allowed;
            const contract = inv.contractId === null ? undefined : await this.contracts.find(ws, inv.contractId);
            if (contract === undefined) return err(DomainError.notFound('MainContract'));
            const issueDate = body.issueDate ?? inv.issueDate;
            // A new issue date keeps the payment term of the draft unless a due date is given.
            const dueDate = body.dueDate ?? (body.issueDate === undefined ? inv.dueDate : addDays(issueDate, Math.max(0, daysBetween(inv.issueDate, inv.dueDate))));

            if (inv.source === 'advance' && !ADVANCE_CONTRACT.includes(contract.status)) return err(contractNotBillable(contract.status));
            if (inv.source === 'retention_release') {
                if (!RETENTION_CONTRACT.includes(contract.status)) return err(contractNotBillable(contract.status));
                const balance = arRetentionTotals(await this.repo.retentionEntries(ws, contract.id)).balance;
                if (inv.net > balance) return err(releaseExceeds(balance));
            }
            const issued = await this.issuer.issue({ ...inv, issueDate, dueDate }, userId);
            if (!issued.ok) return issued;
            const out = issued.value;
            await this.repo.saveInvoice(out);

            if (out.source === 'advance') {
                const posted = await this.issuer.post(out, 'ar.advance_invoiced', { net: out.net, vat: out.vat, wht: out.whtExpected }, userId, { payable: out.payable });
                if (!posted.ok) return posted;
                if (out.milestoneId !== null) {
                    const marked = await this.contracts.markMilestone(ws, out.milestoneId, 'invoiced');
                    if (!marked.ok) return marked;
                }
            } else if (out.source === 'retention_release') {
                await this.repo.insertRetentionEntry({
                    id: this.ids.newId(), workspaceId: ws, contractId: contract.id, projectId: contract.projectId, kind: 'released', amount: out.net,
                    claimId: null, invoiceId: out.id, entryDate: issueDate, note: out.note, createdBy: userId, createdAt: this.clock.now(),
                });
                const posted = await this.issuer.post(out, 'ar.retention_released', { net: out.net, retention: out.net }, userId);
                if (!posted.ok) return posted;
            }
            await this.audit.record({
                workspaceId: ws, projectId: out.projectId, actor: userId, entityType: 'ar_invoice', entityId: out.id, action: 'issue',
                data: { status: [inv.status, 'issued'], number: out.number, source: out.source, total: out.total },
            });
            return ok(out);
        });
        if (!done.ok) return done;
        return ok(invoiceDto(done.value));
    }
}

/**
 * POST /invoices/:invoiceId/void — `billing.manage`; draft or issued with nothing received (409 `invoice_has_receipts`).
 * An issued one: number voided, its money events reversed, its ledger rows removed; a claim invoice puts the claim back
 * to certified (certified progress back to the previous claim's), the advance one puts milestone 0 back to claimable.
 */
@Injectable()
export class VoidInvoiceUseCase {
    constructor(
        private readonly access: BillingAccess,
        private readonly repo: BillingRepository,
        private readonly contracts: MainContracts,
        private readonly costCodes: CostCodeLookup,
        private readonly numbering: DocumentNumbering,
        private readonly issuer: InvoiceIssuer,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; invoiceId: string; body: VoidInvoiceRequest }): Promise<Result<InvoiceDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.invoice(userId, input.invoiceId, ['billing.manage'], true);
        if (!loaded.ok) return loaded;
        const ws = loaded.value.grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<InvoiceRecord, DomainError>> => {
            const inv = await this.repo.lockInvoice(ws, loaded.value.invoice.id);
            if (inv === undefined) return err(DomainError.notFound('Invoice'));
            if (inv.paidAmount > 0 || inv.status === 'partially_paid' || inv.status === 'paid') {
                return err(DomainError.conflict('Money was received on this invoice; void the receipt first', { reason: 'invoice_has_receipts' }));
            }
            const allowed = requireInvoiceStatus(inv.status, ['draft', 'issued']);
            if (!allowed.ok) return allowed;
            const now = this.clock.now();
            if (inv.status === 'issued') {
                const voided = await this.numbering.void({ workspaceId: ws, docType: 'invoice', subjectId: inv.id, reason: body.reason, by: userId });
                if (!voided.ok) return voided;
                const reversed = await this.issuer.reverseAll(inv, userId, bangkokToday(now));
                if (!reversed.ok) return reversed;
                await this.repo.deleteRetentionEntriesOfInvoice(ws, inv.id);
                await this.repo.deleteAdvanceEntriesOfInvoice(ws, inv.id);
                if (inv.source === 'claim' && inv.claimId !== null) {
                    const c = await this.repo.lockClaim(ws, inv.claimId);
                    if (c?.status === 'invoiced' && c.invoiceId === inv.id) {
                        const lines = await this.repo.linesOf(ws, [c.id]);
                        if (lines.length > 0) {
                            await this.costCodes.setCertifiedProgress(ws, c.projectId, lines.map(l => ({ costCodeId: l.costCodeId, progress: l.prevProgress })));
                        }
                        await this.repo.saveClaim({ ...c, status: 'certified', invoiceId: null, updatedAt: now });
                        if (c.milestoneId !== null) await this.contracts.markMilestone(ws, c.milestoneId, 'claimed');
                    }
                } else if (inv.source === 'advance' && inv.milestoneId !== null) {
                    await this.contracts.markMilestone(ws, inv.milestoneId, 'claimable');
                }
            }
            const out: InvoiceRecord = { ...inv, status: 'voided', voidReason: body.reason, updatedAt: now };
            await this.repo.saveInvoice(out);
            await this.audit.record({
                workspaceId: ws, projectId: inv.projectId, actor: userId, entityType: 'ar_invoice', entityId: inv.id, action: 'void',
                data: { status: [inv.status, 'voided'], number: inv.number, reason: body.reason },
            });
            return ok(out);
        });
        if (!done.ok) return done;
        return ok(invoiceDto(done.value));
    }
}
