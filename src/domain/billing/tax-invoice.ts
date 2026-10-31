// ─── Settlement status and tax invoices on receipt (docs/erp/02-domain-model.md §4.2) ───
// Services: the tax point is the payment. Each receipt allocated to an invoice issues a tax invoice for the share
// settled: ratio = settled / (payable + wht_expected); TI net = round2(invoice.net × ratio), vat = round2(net × rate).
// The receipt that makes the invoice paid takes everything left, so Σ TI = the invoice exactly.
import { round2, sumMoney } from '../money/money';

export interface SettlableInvoice {
    net: number;
    vat: number;
    payable: number;
    whtExpected: number;
}

/** Amount that settles the invoice in full: cash payable + WHT the customer withholds. */
export function invoiceDue(inv: Pick<SettlableInvoice, 'payable' | 'whtExpected'>): number {
    return round2(inv.payable + inv.whtExpected);
}

/** Still to be settled (never below 0). */
export function invoiceOutstanding(inv: Pick<SettlableInvoice, 'payable' | 'whtExpected'>, paidAmount: number): number {
    return round2(Math.max(0, invoiceDue(inv) - paidAmount));
}

export type InvoiceSettlementStatus = 'issued' | 'partially_paid' | 'paid';

/** Status from `paid_amount`: ≥ due → paid, > 0 → partially_paid, else issued. Over the due → 'overpayment'. */
export function invoiceSettlementStatus(
    inv: Pick<SettlableInvoice, 'payable' | 'whtExpected'>,
    paidAmount: number,
): InvoiceSettlementStatus | 'overpayment' {
    const due = invoiceDue(inv);
    const paid = round2(paidAmount);
    if (paid > due) return 'overpayment';
    if (paid >= due) return 'paid';
    return paid > 0 ? 'partially_paid' : 'issued';
}

export interface TaxInvoicePart {
    net: number;
    vat: number;
    /** net + vat. */
    total: number;
}

export interface TaxInvoiceForReceiptInput {
    invoice: SettlableInvoice;
    /** Rate of VAT of the invoice (0 → no VAT). */
    vatRate: number;
    /** Paid on the invoice before this receipt (cash + WHT). */
    paidBefore: number;
    /** Settled by this receipt (cash + WHT allocated to the invoice). */
    settled: number;
    /** Tax invoices already issued for the invoice. */
    previous: readonly { net: number; vat: number }[];
}

/**
 * Tax invoice for one receipt allocation. The allocation that brings the invoice to paid gets the remainder
 * (invoice.net − Σ previous net, invoice.vat − Σ previous vat). Throws RangeError on an overpayment or a
 * non-positive settled amount (the caller answers 422 first).
 */
export function taxInvoiceForReceipt(input: TaxInvoiceForReceiptInput): TaxInvoicePart {
    const { invoice } = input;
    const settled = round2(input.settled);
    if (!(settled > 0)) throw new RangeError('taxInvoiceForReceipt: settled must be > 0');
    const status = invoiceSettlementStatus(invoice, round2(input.paidBefore + settled));
    if (status === 'overpayment') throw new RangeError('taxInvoiceForReceipt: overpayment');
    if (status === 'paid') return remainingTaxInvoice(invoice, input.previous);
    const due = invoiceDue(invoice);
    const ratio = due === 0 ? 1 : settled / due;
    const net = round2(invoice.net * ratio);
    const vat = round2(net * input.vatRate);
    return { net, vat, total: round2(net + vat) };
}

/** What is left to put on tax invoices (also the whole-invoice TI issued ahead of payment). */
export function remainingTaxInvoice(
    invoice: Pick<SettlableInvoice, 'net' | 'vat'>,
    previous: readonly { net: number; vat: number }[],
): TaxInvoicePart {
    const net = round2(invoice.net - sumMoney(previous.map(p => p.net)));
    const vat = round2(invoice.vat - sumMoney(previous.map(p => p.vat)));
    return { net, vat, total: round2(net + vat) };
}
