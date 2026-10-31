// ─── Billing records → DTOs ───
import { Injectable } from '@nestjs/common';
import type {
    ArAdvanceEntryDto, ArRetentionEntryDto, ArClaimDto, ArClaimLineDto, ArClaimSummaryDto, ContractAdvanceDto, ContractRetentionDto, InvoiceDto,
} from '@contrack/contract';
import { advanceTotals, retentionCap, retentionReleasePlan } from '@contrack/domain/billing';
import { round2, sumMoney } from '@contrack/domain/money';
import type { ProjectGrant } from '../../../shared/application/module-access';
import { CostCodeLookup, type MainContractInfo } from '../../../shared/application/ports';
import { can } from '../../../shared/domain/permissions';
import {
    type AdvanceEntryRecord, BillingRepository, type ClaimLineRecord, type ClaimRecord, type InvoiceRecord, type RetentionEntryRecord,
} from './ports/billing.repository';

export const claimSummaryDto = (c: ClaimRecord): ArClaimSummaryDto => ({
    id: c.id, contractId: c.contractId, projectId: c.projectId, mode: c.mode, milestoneId: c.milestoneId, claimNo: c.claimNo,
    periodFrom: c.periodFrom, periodTo: c.periodTo, status: c.status, workValue: c.workValue, previousValue: c.previousValue,
    cumulativeValue: c.cumulativeValue, isFinal: c.isFinal, advanceRecovery: c.advanceRecovery, retention: c.retention, penalty: c.penalty,
    penaltyDays: c.penaltyDays, penaltyOverride: c.penaltyOverride, penaltyMax: c.penaltyMax, escalation: c.escalation,
    escalationK: c.escalationK, escalationIndices: { ...c.escalationIndices }, otherDeduction: c.otherDeduction,
    otherDeductionNote: c.otherDeductionNote, vatBase: c.vatBase, vat: c.vat, wht: c.wht, payable: c.payable,
    certifiedByName: c.certifiedByName, certifiedAt: c.certifiedAt, certifiedNote: c.certifiedNote, invoiceId: c.invoiceId,
    createdBy: c.createdBy, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
});

export const invoiceDto = (i: InvoiceRecord): InvoiceDto => ({
    id: i.id, projectId: i.projectId, contractId: i.contractId, claimId: i.claimId, milestoneId: i.milestoneId, customerId: i.customerId,
    kind: i.kind, source: i.source, number: i.number, status: i.status, issueDate: i.issueDate, dueDate: i.dueDate, language: i.language,
    customerSnapshot: i.customerSnapshot, companySnapshot: i.companySnapshot, lines: i.lines.map(l => ({ ...l })), net: i.net, vat: i.vat,
    total: i.total, retention: i.retention, advanceRecovery: i.advanceRecovery, penalty: i.penalty, whtExpected: i.whtExpected,
    payable: i.payable, paidAmount: i.paidAmount, relatedInvoiceId: i.relatedInvoiceId, note: i.note, voidReason: i.voidReason,
    issuedBy: i.issuedBy, issuedAt: i.issuedAt?.toISOString() ?? null, createdBy: i.createdBy, createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
});

const retentionEntryDto = (e: RetentionEntryRecord): ArRetentionEntryDto => ({
    id: e.id, kind: e.kind, amount: e.amount, claimId: e.claimId, invoiceId: e.invoiceId, entryDate: e.entryDate, note: e.note,
    createdAt: e.createdAt.toISOString(),
});

const advanceEntryDto = (e: AdvanceEntryRecord): ArAdvanceEntryDto => ({
    id: e.id, kind: e.kind, amount: e.amount, claimId: e.claimId, invoiceId: e.invoiceId, entryDate: e.entryDate,
    createdAt: e.createdAt.toISOString(),
});

/** Amount of the advance payment of a contract (milestone `no` 0, else from the terms). */
export function advanceAmountOf(contract: MainContractInfo): number {
    const m = contract.milestones.find(x => x.kind === 'advance');
    return m?.amount ?? round2(contract.originalValue * contract.terms.advancePct);
}

/** The advance invoice of a contract that is not voided. */
export const liveAdvanceInvoice = (invoices: readonly InvoiceRecord[]): InvoiceRecord | undefined =>
    invoices.find(i => i.source === 'advance' && i.status !== 'voided');

/** Draft retention release invoices (asked but not issued yet). */
export const pendingRelease = (invoices: readonly InvoiceRecord[]): number =>
    sumMoney(invoices.filter(i => i.source === 'retention_release' && i.status === 'draft').map(i => i.net));

@Injectable()
export class BillingViews {
    constructor(private readonly repo: BillingRepository, private readonly costCodes: CostCodeLookup) {}

    async claim(grant: ProjectGrant, c: ClaimRecord, lines?: readonly ClaimLineRecord[]): Promise<ArClaimDto> {
        const rows = lines ?? await this.repo.linesOf(c.workspaceId, [c.id]);
        const codes = await this.costCodes.findMany(c.workspaceId, c.projectId, rows.map(l => l.costCodeId));
        const byId = new Map(codes.map(cc => [cc.id, cc]));
        const lineDtos: ArClaimLineDto[] = rows.map(l => {
            const cc = byId.get(l.costCodeId);
            return {
                costCodeId: l.costCodeId, code: cc?.code ?? '', sectionNo: cc?.sectionNo ?? 0, descTh: cc?.descTh ?? '', descEn: cc?.descEn ?? '',
                unit: cc?.unit ?? '', contractAmount: l.contractAmount, prevProgress: l.prevProgress, cumProgress: l.cumProgress,
                prevAmount: l.prevAmount, cumAmount: l.cumAmount, thisAmount: l.thisAmount, reportedProgress: cc?.reportedProgress ?? 0, note: l.note,
            };
        });
        const order = new Map(codes.map(cc => [cc.id, cc.sort]));
        lineDtos.sort((a, b) => (order.get(a.costCodeId) ?? 0) - (order.get(b.costCodeId) ?? 0));
        return {
            ...claimSummaryDto(c),
            lines: lineDtos,
            canEdit: (c.status === 'draft' || c.status === 'submitted') && can(grant.role, 'billing.manage') && !grant.archived,
        };
    }

    async retention(contract: MainContractInfo): Promise<ContractRetentionDto> {
        const entries = await this.repo.retentionEntries(contract.workspaceId, contract.id);
        const plan = retentionReleasePlan(entries, {
            release: contract.terms.retentionRelease, completedAt: contract.completedAt, warrantyMonths: contract.terms.warrantyMonths,
        });
        const pending = pendingRelease(await this.repo.invoicesOfContract(contract.workspaceId, contract.id));
        return {
            contractId: contract.id, withheld: plan.withheld, released: plan.released, forfeited: plan.forfeited, balance: plan.balance,
            cap: retentionCap(contract.terms.retentionCapPct, contract.currentValue), pendingRelease: pending,
            releasable: round2(Math.max(0, plan.balance - pending)), schedule: plan.schedule, entries: entries.map(retentionEntryDto),
        };
    }

    async advance(grant: ProjectGrant, contract: MainContractInfo): Promise<ContractAdvanceDto> {
        const entries = await this.repo.advanceEntries(contract.workspaceId, contract.id);
        const totals = advanceTotals(entries);
        const invoice = liveAdvanceInvoice(await this.repo.invoicesOfContract(contract.workspaceId, contract.id));
        const amount = contract.terms.advancePct > 0 ? advanceAmountOf(contract) : 0;
        return {
            contractId: contract.id, advancePct: contract.terms.advancePct, amount, received: totals.received, recovered: totals.recovered,
            balance: totals.balance, invoice: invoice === undefined ? null : invoiceDto(invoice),
            canCreateInvoice: invoice === undefined && amount > 0 && contract.status === 'signed' && can(grant.role, 'billing.manage') && !grant.archived,
            entries: entries.map(advanceEntryDto),
        };
    }
}
