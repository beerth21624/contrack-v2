// ─── Payment runs (WP-50, docs/erp/02-domain-model.md §10): grouping, scheduling bills, views, paying ───
import { Injectable } from '@nestjs/common';
import {
    type ApPaymentMethod, type ApPaymentSummaryDto, type LabourPaymentMethod, type PaymentRunDto, type PaymentRunGroupDto,
    type PaymentRunSummaryDto, type Role, WHT_PRESET_INCOME_TYPE, type WhtIncomeType,
} from '@contrack/contract';
import { round2, sumMoney } from '@contrack/domain/money';
import {
    AuditLog, Clock, CompanyProfiles, DocumentNumbering, FinancialEvents, IdGenerator, PayPeriodPayments, SubcontractClaimPayer,
    SupplierLookup,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../shared/domain/ids';
import { can } from '../../../shared/domain/permissions';
import { type Result, err, ok, okVoid } from '../../../shared/domain/result';
import { requireBillTransition } from '../domain/payables-state';
import { BILL_SOURCE, BillViews, MANAGE, supplierDisplayName } from './payables.service';
import {
    type BillRecord, PayablesRepository, type PaymentAllocationRecord, type PaymentRecord, type PaymentRunRecord, type WhtCertificateRecord,
} from './ports/payables.repository';

export const RUN_SOURCE = 'payment_run';
export const PAYMENT_SOURCE = 'payment_voucher';
export const CERTIFICATE_SOURCE = 'wht_certificate';
export const RUN_APPROVAL_SUBJECT = 'payment_run.approve' as const;
export const PAY = 'payables.pay' as const;

export const runNotFound = (): DomainError => DomainError.notFound('PaymentRun');

/** What a run pays on a bill: the rest of its payable (v1 pays in full) and its WHT. */
export const billCash = (b: Pick<BillRecord, 'payable' | 'paidAmount'>): number => round2(b.payable - b.paidAmount);

/** Labour wages go out in cash or by transfer; a cheque counts as a transfer for the pay period. */
export const labourMethodOf = (m: ApPaymentMethod): LabourPaymentMethod => (m === 'cash' ? 'cash' : 'transfer');

export interface RunGroup {
    supplierId: string | null;
    bills: BillRecord[];
    cash: number;
    wht: number;
}

/** Payees of a run: one per supplier (bills in run order), one per labour bill. */
export function groupBills(bills: readonly BillRecord[]): RunGroup[] {
    const out: RunGroup[] = [];
    const bySupplier = new Map<string, RunGroup>();
    for (const b of bills) {
        if (b.supplierId === null) {
            out.push({ supplierId: null, bills: [b], cash: 0, wht: 0 });
            continue;
        }
        let g = bySupplier.get(b.supplierId);
        if (g === undefined) {
            g = { supplierId: b.supplierId, bills: [], cash: 0, wht: 0 };
            bySupplier.set(b.supplierId, g);
            out.push(g);
        }
        g.bills.push(b);
    }
    for (const g of out) {
        g.cash = sumMoney(g.bills.map(billCash));
        g.wht = sumMoney(g.bills.map(b => b.whtAmount));
    }
    return out;
}

/** 409 `bill_not_payable` unless the bill is `allowed` (approved, or already scheduled in this run); 422 `nothing_to_pay`. */
export function requirePayable(b: BillRecord, allowed: readonly BillRecord['status'][]): Result<void, DomainError> {
    if (!allowed.includes(b.status)) {
        return err(DomainError.conflict(`The supplier bill is ${b.status}`, { reason: 'bill_not_payable', billId: b.id, status: b.status }));
    }
    if (billCash(b) <= 0) return err(DomainError.unprocessable('Nothing is left to pay on the bill', { reason: 'nothing_to_pay', billId: b.id }));
    return okVoid();
}

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

export function runSummaryDto(r: PaymentRunRecord): PaymentRunSummaryDto {
    return {
        id: r.id, workspaceId: r.workspaceId, number: r.number, status: r.status, payDate: r.payDate, method: r.method, note: r.note,
        billCount: r.billIds.length, totalCash: r.totalCash, totalWht: r.totalWht, approvedBy: r.approvedBy, approvedAt: iso(r.approvedAt),
        paidAt: iso(r.paidAt), cancelledAt: iso(r.cancelledAt), createdBy: r.createdBy, createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    };
}

export function paymentSummaryDto(p: PaymentRecord, certificateNumber: string | null): ApPaymentSummaryDto {
    return {
        id: p.id, workspaceId: p.workspaceId, runId: p.runId, supplierId: p.supplierId, payeeName: p.payeeName, number: p.number,
        payDate: p.payDate, method: p.method, bankRef: p.bankRef, cashAmount: p.cashAmount, whtAmount: p.whtAmount,
        whtCertificateId: p.whtCertificateId, whtCertificateNumber: certificateNumber, status: p.status, createdAt: p.createdAt.toISOString(),
    };
}

@Injectable()
export class RunViews {
    constructor(
        private readonly repo: PayablesRepository,
        private readonly bills: BillViews,
        private readonly suppliers: SupplierLookup,
        private readonly periods: PayPeriodPayments,
    ) {}

    /** Bills of a run in run order (missing ones skipped). */
    async billsOf(r: Pick<PaymentRunRecord, 'workspaceId' | 'billIds'>): Promise<BillRecord[]> {
        const found = new Map((await this.repo.findMany(r.workspaceId, r.billIds)).map(b => [b.id, b]));
        return r.billIds.flatMap(id => {
            const b = found.get(id);
            return b === undefined ? [] : [b];
        });
    }

    /** Payee name of a group: the supplier's, or the pay period key of a labour bill. */
    async payeeNames(workspaceId: WorkspaceId, groups: readonly RunGroup[]): Promise<string[]> {
        const ids = [...new Set(groups.flatMap(g => (g.supplierId === null ? [] : [g.supplierId])))];
        const names = new Map((ids.length === 0 ? [] : await this.suppliers.findMany(workspaceId, ids)).map(s => [s.id, supplierDisplayName(s)]));
        const out: string[] = [];
        for (const g of groups) {
            if (g.supplierId !== null) {
                out.push(names.get(g.supplierId) ?? '');
                continue;
            }
            const periodId = g.bills[0]?.payPeriodId ?? null;
            const period = periodId === null ? undefined : await this.periods.find(workspaceId, periodId);
            out.push(period?.periodKey ?? '');
        }
        return out;
    }

    async payments(workspaceId: WorkspaceId, runId: string): Promise<ApPaymentSummaryDto[]> {
        const payments = await this.repo.paymentsOfRun(workspaceId, runId);
        const certIds = payments.flatMap(p => (p.whtCertificateId === null ? [] : [p.whtCertificateId]));
        const numbers = new Map((await this.repo.certificatesOf(workspaceId, certIds)).map(c => [c.id, c.number]));
        return payments.map(p => paymentSummaryDto(p, p.whtCertificateId === null ? null : numbers.get(p.whtCertificateId) ?? null));
    }

    async detail(r: PaymentRunRecord, role: Role): Promise<PaymentRunDto> {
        const ws = r.workspaceId;
        const bills = await this.billsOf(r);
        const payments = r.status === 'paid' ? await this.payments(ws, r.id) : [];
        let groups: PaymentRunGroupDto[];
        if (r.status === 'paid') {
            // As paid: one group per voucher with the bills it settled.
            groups = [];
            for (const p of payments) {
                const allocations = await this.repo.allocationsOf(ws, p.id);
                groups.push({
                    supplierId: p.supplierId, payeeName: p.payeeName, billIds: allocations.map(a => a.billId), cash: p.cashAmount, wht: p.whtAmount,
                });
            }
        } else {
            const live = groupBills(bills);
            const names = await this.payeeNames(ws, live);
            groups = live.map((g, i) => ({ supplierId: g.supplierId, payeeName: names[i] ?? '', billIds: g.bills.map(b => b.id), cash: g.cash, wht: g.wht }));
        }
        const manage = can(role, MANAGE);
        return {
            ...runSummaryDto(r),
            billIds: [...r.billIds],
            bills: await this.bills.summaries(ws, bills),
            groups,
            payments,
            canEdit: manage && r.status === 'draft',
            canApprove: manage && r.status === 'draft',
            canPay: can(role, PAY) && r.status === 'approved',
            canCancel: manage && (r.status === 'draft' || r.status === 'pending_approval' || r.status === 'approved'),
        };
    }
}

/** Moving bills in and out of a run (inside the caller's transaction, the workspace locked). */
@Injectable()
export class RunBills {
    constructor(private readonly repo: PayablesRepository, private readonly clock: Clock) {}

    /**
     * The bills of `wanted` (deduplicated, in order) locked and checked: approved, or scheduled in this run (`current`);
     * not_found `SupplierBill` for an id of another workspace.
     */
    async load(workspaceId: WorkspaceId, wanted: readonly string[], current: readonly string[]): Promise<Result<BillRecord[], DomainError>> {
        const ids = [...new Set(wanted.map(id => id.toLowerCase()))];
        const out: BillRecord[] = [];
        for (const id of ids) {
            const b = await this.repo.lock(workspaceId, id);
            if (b === undefined) return err(DomainError.notFound('SupplierBill'));
            const ok_ = requirePayable(b, current.includes(id) ? ['scheduled'] : ['approved']);
            if (!ok_.ok) return ok_;
            out.push(b);
        }
        return ok(out);
    }

    /** approved → scheduled for the bills not scheduled yet. */
    async schedule(bills: readonly BillRecord[]): Promise<Result<void, DomainError>> {
        const now = this.clock.now();
        for (const b of bills) {
            if (b.status === 'scheduled') continue;
            const move = requireBillTransition(b.status, 'scheduled');
            if (!move.ok) return move;
            await this.repo.save({ ...b, status: 'scheduled', updatedAt: now });
        }
        return okVoid();
    }

    /** scheduled → approved for the bills of `ids` still scheduled (removed from a run, or the run cancelled). */
    async release(workspaceId: WorkspaceId, ids: readonly string[]): Promise<void> {
        const now = this.clock.now();
        for (const id of ids) {
            const b = await this.repo.lock(workspaceId, id);
            if (b?.status === 'scheduled') await this.repo.save({ ...b, status: 'approved', updatedAt: now });
        }
    }
}

/** Income type, rate and description of a certificate from the bills it covers (mixed presets → `other`). */
function incomeOf(bills: readonly BillRecord[], base: number, wht: number): { incomeType: WhtIncomeType; rate: number; desc: string } {
    const withWht = bills.filter(b => b.whtAmount > 0);
    const types = [...new Set(withWht.map(b => WHT_PRESET_INCOME_TYPE[b.whtPreset]))];
    const rates = [...new Set(withWht.map(b => b.whtRate))];
    const incomeType: WhtIncomeType = types.length === 1 ? types[0] ?? 'other' : 'other';
    const rate = rates.length === 1 ? rates[0] ?? 0 : base > 0 ? Math.round((wht / base) * 1e6) / 1e6 : 0;
    const desc = withWht.map(b => b.number ?? b.supplierInvoiceNo).filter(x => x !== '').join(', ');
    return { incomeType, rate, desc };
}

/** Paying an approved run, inside the caller's transaction (workspace and run locked). */
@Injectable()
export class RunPayment {
    constructor(
        private readonly repo: PayablesRepository,
        private readonly views: RunViews,
        private readonly suppliers: SupplierLookup,
        private readonly company: CompanyProfiles,
        private readonly numbering: DocumentNumbering,
        private readonly events: FinancialEvents,
        private readonly periods: PayPeriodPayments,
        private readonly claims: SubcontractClaimPayer,
        private readonly audit: AuditLog,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    /**
     * Per payee: a voucher `PV` with its allocations; WHT > 0 → a 50 ทวิ `WHT` (pnd53 for a juristic supplier, else
     * pnd3) and fin_events `ap.wht_withheld`; `ap.payment` per bill (not labour: the pay period posts `lb.wages_paid`);
     * labour bill → PayPeriodPayments.markPaid; subcontract bill → SubcontractClaimPayer.markPaid; bills → paid.
     * Returns what to run after the commit (vendor notices).
     */
    async pay(run: PaymentRunRecord, input: { payDate: string; bankRef: string; by: UserId }): Promise<Result<{ run: PaymentRunRecord; afterCommit: (() => Promise<void>)[] }, DomainError>> {
        const ws = run.workspaceId;
        const now = this.clock.now();
        const { payDate, bankRef, by } = input;
        const bills: BillRecord[] = [];
        for (const id of run.billIds) {
            const b = await this.repo.lock(ws, id);
            if (b === undefined) return err(DomainError.notFound('SupplierBill'));
            const payable = requirePayable(b, ['scheduled']);
            if (!payable.ok) return payable;
            bills.push(b);
        }
        const groups = groupBills(bills);
        const names = await this.views.payeeNames(ws, groups);
        const afterCommit: (() => Promise<void>)[] = [];
        const payer = groups.some(g => g.wht > 0) ? await this.company.snapshot(ws, 'th') : undefined;

        for (const [gi, g] of groups.entries()) {
            const paymentId = this.ids.newId();
            const pv = await this.numbering.issue({
                workspaceId: ws, docType: 'payment_voucher', issueDate: payDate, subjectType: PAYMENT_SOURCE, subjectId: paymentId,
                projectId: null, issuedBy: by,
            });
            if (!pv.ok) return pv;
            const supplier = g.supplierId === null ? undefined : await this.suppliers.find(ws, g.supplierId);
            const payeeName = names[gi] ?? '';

            let certificate: WhtCertificateRecord | undefined;
            if (g.wht > 0 && g.supplierId !== null) {
                const certificateId = this.ids.newId();
                const issued = await this.numbering.issue({
                    workspaceId: ws, docType: 'wht_certificate', issueDate: payDate, subjectType: CERTIFICATE_SOURCE, subjectId: certificateId,
                    projectId: null, issuedBy: by,
                });
                if (!issued.ok) return issued;
                const base = sumMoney(g.bills.filter(b => b.whtAmount > 0).map(b => round2(b.subtotal - b.discount)));
                const income = incomeOf(g.bills, base, g.wht);
                const snap = await this.suppliers.snapshot(ws, g.supplierId, 'th');
                certificate = {
                    id: certificateId, workspaceId: ws, number: issued.value.number, bookNo: '', paymentId,
                    payeeSnapshot: {
                        name: snap?.name ?? payeeName, taxId: snap?.taxId ?? supplier?.taxId ?? '', branchCode: snap?.branchCode ?? supplier?.branchCode ?? '',
                        address: snap?.address ?? '', isJuristic: supplier?.isJuristic ?? false,
                    },
                    payerSnapshot: { name: payer?.legalName ?? '', taxId: payer?.taxId ?? '', branchCode: payer?.branchCode ?? '', address: payer?.address ?? '' },
                    form: supplier?.isJuristic === true ? 'pnd53' : 'pnd3', incomeType: income.incomeType, incomeDesc: income.desc, payDate,
                    baseAmount: base, whtRate: income.rate, whtAmount: g.wht, condition: 'withheld', status: 'issued', issuedAt: now, createdBy: by,
                };
            }

            const payment: PaymentRecord = {
                id: paymentId, workspaceId: ws, runId: run.id, supplierId: g.supplierId, payeeName, number: pv.value.number, payDate,
                method: run.method, bankRef, cashAmount: g.cash, whtAmount: g.wht, whtCertificateId: certificate?.id ?? null, status: 'issued',
                fileIds: [], createdBy: by, createdAt: now,
            };
            const allocations: PaymentAllocationRecord[] = g.bills.map(b => {
                const cash = billCash(b);
                return { paymentId, billId: b.id, workspaceId: ws, settled: round2(cash + b.whtAmount), wht: b.whtAmount, cash };
            });
            await this.repo.insertPayment(payment, allocations);
            if (certificate !== undefined) await this.repo.insertCertificate(certificate);

            const counterparty = {
                counterpartyId: g.supplierId, counterpartyName: payeeName, counterpartyTaxId: supplier?.taxId ?? '',
                counterpartyBranch: supplier?.branchCode ?? '',
            };
            for (const b of g.bills) {
                const cash = billCash(b);
                if (b.kind === 'labour' && b.payPeriodId !== null) {
                    const paid = await this.periods.markPaid(ws, b.payPeriodId, { paidAt: payDate, method: labourMethodOf(run.method), by });
                    if (!paid.ok) return paid;
                } else {
                    const posted = await this.events.post(ws, {
                        projectId: b.projectId, eventDate: payDate, eventType: 'ap.payment', direction: 'out',
                        counterpartyType: b.kind === 'subcontract' ? 'subcontractor' : 'supplier', ...counterparty, docType: PAYMENT_SOURCE,
                        docNumber: payment.number, docDate: payDate, sourceType: PAYMENT_SOURCE, sourceId: paymentId,
                        net: round2(b.subtotal - b.discount), vat: b.vat, wht: b.whtAmount, retention: b.retentionAmount, cash,
                        data: { billId: b.id, billNumber: b.number, runId: run.id, method: run.method, bankRef, kind: b.kind },
                        by,
                    });
                    if (!posted.ok) return posted;
                }
                if (b.kind === 'subcontract' && b.scClaimId !== null) {
                    const paid = await this.claims.markPaid(ws, b.scClaimId, { paidAt: payDate, amount: cash, channel: run.method, ref: bankRef, by });
                    if (!paid.ok) return paid;
                    afterCommit.push(paid.value.afterCommit);
                }
                const move = requireBillTransition(b.status, 'paid');
                if (!move.ok) return move;
                await this.repo.save({ ...b, status: 'paid', paidAmount: round2(b.paidAmount + cash), updatedAt: now });
                await this.audit.record({
                    workspaceId: ws, projectId: b.projectId, actor: by, entityType: BILL_SOURCE, entityId: b.id, action: 'pay',
                    data: { status: [b.status, 'paid'], paid: cash, wht: b.whtAmount, paymentNumber: payment.number },
                });
            }

            if (certificate !== undefined) {
                const posted = await this.events.post(ws, {
                    projectId: null, eventDate: payDate, eventType: 'ap.wht_withheld', direction: 'none', counterpartyType: 'supplier', ...counterparty,
                    counterpartyName: certificate.payeeSnapshot.name !== '' ? certificate.payeeSnapshot.name : payeeName,
                    counterpartyTaxId: certificate.payeeSnapshot.taxId, counterpartyBranch: certificate.payeeSnapshot.branchCode,
                    docType: CERTIFICATE_SOURCE, docNumber: certificate.number, docDate: payDate, sourceType: CERTIFICATE_SOURCE,
                    sourceId: certificate.id, net: certificate.baseAmount, wht: certificate.whtAmount, cash: 0,
                    data: {
                        form: certificate.form, incomeType: certificate.incomeType, whtRate: certificate.whtRate, paymentId, paymentNumber: payment.number,
                        billIds: g.bills.filter(b => b.whtAmount > 0).map(b => b.id),
                    },
                    by,
                });
                if (!posted.ok) return posted;
            }
        }

        const paid: PaymentRunRecord = {
            ...run, status: 'paid', payDate, totalCash: sumMoney(groups.map(g => g.cash)), totalWht: sumMoney(groups.map(g => g.wht)),
            paidAt: now, paidBy: by, updatedAt: now,
        };
        await this.repo.saveRun(paid);
        await this.audit.record({
            workspaceId: ws, projectId: null, actor: by, entityType: RUN_SOURCE, entityId: run.id, action: 'pay',
            data: { status: [run.status, 'paid'], payDate, totalCash: paid.totalCash, totalWht: paid.totalWht, payments: groups.length },
        });
        return ok({ run: paid, afterCommit });
    }
}
