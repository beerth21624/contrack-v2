// ─── Printed billing documents as plain data: invoice, tax invoice / credit note, receipt, claim certificate ───
// Pure (no React). Text of lines is picked in the document's language; numbers and dates are formatted by the components.
import { round2 } from '@/domain/money';
import type { ArClaimDto, DocLanguage, InvoiceDto, MainContractDto, ReceiptDto, ReceiptMethod } from '@/shared/contract';
import type { PrintCompany, PrintCustomer } from '../quotations/print-model';

export type PrintWatermark = 'draft' | 'void' | null;

export interface PrintLine {
    text: string;
    amount: number;
}

const pick = (th: string, en: string, language: DocLanguage): string => {
    const first = language === 'en' ? en : th;
    return first.trim() !== '' ? first : language === 'en' ? th : en;
};

const watermarkOf = (status: string): PrintWatermark => (status === 'voided' || status === 'cancelled' ? 'void' : status === 'draft' ? 'draft' : null);

// ── Invoice / tax invoice / credit note ──

export type InvoiceDocKind = 'invoice' | 'advance' | 'retention' | 'taxInvoice' | 'creditNote';

export interface InvoiceTotalRow {
    key: 'subtotal' | 'vat' | 'total' | 'retention' | 'penalty' | 'otherDeduction' | 'wht' | 'payable';
    /** Signed as shown (a deduction is negative). */
    amount: number;
}

export interface InvoicePrintModel {
    kind: InvoiceDocKind;
    language: DocLanguage;
    watermark: PrintWatermark;
    number: string | null;
    issueDate: string;
    dueDate: string;
    company: PrintCompany;
    customer: PrintCustomer | null;
    projectName: string | null;
    lines: PrintLine[];
    rows: InvoiceTotalRow[];
    net: number;
    vat: number;
    total: number;
    payable: number;
    paid: number;
    /** What is still to pay in all (cash + the WHT the customer will withhold); 0 for tax documents. */
    outstanding: number;
    /** Number of the invoice (tax invoice, credit note: the tax invoice) this document refers to. */
    relatedNumber: string | null;
    relatedIsTaxInvoice: boolean;
    note: string;
    vatRate: number | null;
    vatRegistered: boolean;
}

export function invoiceDocKind(inv: Pick<InvoiceDto, 'kind' | 'source'>): InvoiceDocKind {
    if (inv.kind === 'tax_invoice') return 'taxInvoice';
    if (inv.kind === 'credit_note') return 'creditNote';
    if (inv.kind === 'advance_invoice' || inv.source === 'advance') return 'advance';
    if (inv.source === 'retention_release') return 'retention';
    return 'invoice';
}

export function buildInvoicePrintModel(args: {
    invoice: InvoiceDto;
    company: PrintCompany;
    customer: PrintCustomer | null;
    projectName?: string | null;
    relatedNumber?: string | null;
    vatRate?: number | null;
}): InvoicePrintModel {
    const { invoice: inv, company, customer } = args;
    const kind = invoiceDocKind(inv);
    const lines = inv.lines.map(l => ({ text: pick(l.descTh, l.descEn, inv.language), amount: l.amount }));
    const rows: InvoiceTotalRow[] = [];
    const isTax = kind === 'taxInvoice' || kind === 'creditNote';
    rows.push({ key: 'subtotal', amount: inv.net });
    if (inv.vat !== 0 || isTax) rows.push({ key: 'vat', amount: inv.vat });
    rows.push({ key: 'total', amount: inv.total });
    if (!isTax) {
        if (inv.retention > 0) rows.push({ key: 'retention', amount: -inv.retention });
        if (inv.penalty > 0) rows.push({ key: 'penalty', amount: -inv.penalty });
        // Anything else taken off the claim (other deduction) is the gap that is left.
        const other = round2(inv.total - inv.retention - inv.penalty - inv.whtExpected - inv.payable);
        if (Math.abs(other) >= 0.005) rows.push({ key: 'otherDeduction', amount: -other });
        if (inv.whtExpected > 0) rows.push({ key: 'wht', amount: -inv.whtExpected });
        rows.push({ key: 'payable', amount: inv.payable });
    }
    const due = round2(inv.payable + inv.whtExpected);
    return {
        kind,
        language: inv.language,
        watermark: watermarkOf(inv.status),
        number: inv.number,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        company,
        customer,
        projectName: args.projectName ?? null,
        lines,
        rows,
        net: inv.net,
        vat: inv.vat,
        total: inv.total,
        payable: inv.payable,
        paid: inv.paidAmount,
        outstanding: isTax || inv.status === 'voided' || inv.status === 'draft' ? 0 : Math.max(0, round2(due - inv.paidAmount)),
        relatedNumber: args.relatedNumber ?? null,
        relatedIsTaxInvoice: kind === 'creditNote',
        note: inv.status === 'voided' && inv.voidReason !== '' ? inv.voidReason : inv.note,
        vatRate: args.vatRate ?? inv.companySnapshot?.vatRate ?? null,
        vatRegistered: inv.companySnapshot?.vatRegistered ?? true,
    };
}

// ── Receipt ──

export interface ReceiptPrintRow {
    invoiceNumber: string;
    taxInvoiceNumber: string | null;
    cash: number;
    wht: number;
    settled: number;
}

export interface ReceiptPrintModel {
    language: DocLanguage;
    watermark: PrintWatermark;
    number: string;
    receiptDate: string;
    company: PrintCompany;
    customer: PrintCustomer | null;
    method: ReceiptMethod;
    bankRef: string;
    rows: ReceiptPrintRow[];
    cashAmount: number;
    whtAmount: number;
    settledTotal: number;
    whtCertificateNo: string;
    /** Numbers of every tax invoice of the receipt. */
    taxInvoiceNumbers: string[];
    /** One tax invoice: the receipt is printed as "receipt / tax invoice" with its lines and VAT. */
    combined: { number: string; lines: PrintLine[]; net: number; vat: number; total: number } | null;
    note: string;
    voidReason: string;
}

export function buildReceiptPrintModel(args: { receipt: ReceiptDto; company: PrintCompany; customer: PrintCustomer | null }): ReceiptPrintModel {
    const { receipt: r, company, customer } = args;
    const tiNumber = new Map(r.taxInvoices.map(t => [t.id, t.number ?? '']));
    const rows = r.allocations.map(a => ({
        invoiceNumber: a.invoiceNumber ?? '',
        taxInvoiceNumber: a.taxInvoiceId === null ? null : (tiNumber.get(a.taxInvoiceId) ?? null),
        cash: a.cash,
        wht: a.wht,
        settled: a.settled,
    }));
    const liveTis = r.taxInvoices.filter(t => t.status !== 'voided');
    const only = r.taxInvoiceIds.length === 1 ? liveTis.find(t => t.id === r.taxInvoiceIds[0]) : undefined;
    return {
        language: r.language,
        watermark: r.status === 'voided' ? 'void' : null,
        number: r.number,
        receiptDate: r.receiptDate,
        company,
        customer,
        method: r.method,
        bankRef: r.bankRef,
        rows,
        cashAmount: r.cashAmount,
        whtAmount: r.whtAmount,
        settledTotal: round2(r.cashAmount + r.whtAmount),
        whtCertificateNo: r.whtCertificateNo,
        taxInvoiceNumbers: r.taxInvoices.map(t => t.number ?? '').filter(n => n !== ''),
        combined: only === undefined
            ? null
            : {
                number: only.number ?? '',
                lines: only.lines.map(l => ({ text: pick(l.descTh, l.descEn, r.language), amount: l.amount })),
                net: only.net,
                vat: only.vat,
                total: only.total,
            },
        note: r.note,
        voidReason: r.voidReason,
    };
}

// ── Claim certificate ──

export interface ClaimPrintLine {
    code: string;
    text: string;
    contractAmount: number;
    prevProgress: number;
    cumProgress: number;
    prevAmount: number;
    cumAmount: number;
    thisAmount: number;
    note: string;
}

export interface ClaimSummaryRow {
    key: 'workValue' | 'previousValue' | 'cumulativeValue' | 'advanceRecovery' | 'escalation' | 'base' | 'vat' | 'retention' | 'penalty' | 'otherDeduction' | 'wht' | 'payable';
    amount: number;
}

export interface ClaimPrintModel {
    language: DocLanguage;
    watermark: PrintWatermark;
    claimNo: number;
    contractNumber: string | null;
    projectName: string;
    periodFrom: string | null;
    periodTo: string | null;
    company: PrintCompany;
    customer: PrintCustomer | null;
    /** Progress mode: the cost-code lines; milestone mode: none. */
    lines: ClaimPrintLine[];
    milestone: boolean;
    summary: ClaimSummaryRow[];
    certifiedByName: string;
    certifiedAt: string | null;
    certifiedNote: string;
    certified: boolean;
}

export function buildClaimPrintModel(args: {
    claim: ArClaimDto;
    contract: Pick<MainContractDto, 'number' | 'language'>;
    company: PrintCompany;
    customer: PrintCustomer | null;
    projectName: string;
}): ClaimPrintModel {
    const { claim: c, contract, company, customer } = args;
    const language = contract.language;
    const milestone = c.mode === 'milestone';
    // Lines that carry something (progress or money); a claim with no progress at all still lists its lines.
    const live = c.lines.filter(l => l.cumProgress !== 0 || l.prevProgress !== 0 || l.thisAmount !== 0 || l.cumAmount !== 0);
    const used = live.length > 0 ? live : c.lines;
    const lines = milestone ? [] : used.map(l => ({
        code: l.code,
        text: pick(l.descTh, l.descEn, language),
        contractAmount: l.contractAmount,
        prevProgress: l.prevProgress,
        cumProgress: l.cumProgress,
        prevAmount: l.prevAmount,
        cumAmount: l.cumAmount,
        thisAmount: l.thisAmount,
        note: l.note,
    }));
    const summary: ClaimSummaryRow[] = [{ key: 'workValue', amount: c.workValue }];
    if (!milestone) {
        summary.push({ key: 'previousValue', amount: c.previousValue }, { key: 'cumulativeValue', amount: c.cumulativeValue });
    }
    if (c.advanceRecovery !== 0) summary.push({ key: 'advanceRecovery', amount: -c.advanceRecovery });
    if (c.escalation !== 0) summary.push({ key: 'escalation', amount: c.escalation });
    summary.push({ key: 'base', amount: round2(c.workValue - c.advanceRecovery + c.escalation) }, { key: 'vat', amount: c.vat });
    if (c.retention !== 0) summary.push({ key: 'retention', amount: -c.retention });
    if (c.penalty !== 0) summary.push({ key: 'penalty', amount: -c.penalty });
    if (c.otherDeduction !== 0) summary.push({ key: 'otherDeduction', amount: -c.otherDeduction });
    if (c.wht !== 0) summary.push({ key: 'wht', amount: -c.wht });
    summary.push({ key: 'payable', amount: c.payable });
    return {
        language,
        watermark: watermarkOf(c.status === 'draft' || c.status === 'pending_approval' || c.status === 'submitted' ? 'draft' : c.status),
        claimNo: c.claimNo,
        contractNumber: contract.number,
        projectName: args.projectName,
        periodFrom: c.periodFrom,
        periodTo: c.periodTo,
        company,
        customer,
        lines,
        milestone,
        summary,
        certifiedByName: c.certifiedByName,
        certifiedAt: c.certifiedAt,
        certifiedNote: c.certifiedNote,
        certified: c.status === 'certified' || c.status === 'invoiced',
    };
}
