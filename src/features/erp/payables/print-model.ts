// ─── The 50 ทวิ certificate and the payment voucher as plain data for the printed page ───
// Pure (no React). Both documents are printed in Thai with Buddhist-era dates (the 50 ทวิ is a Revenue Department form);
// the payer / payee blocks are the snapshots frozen on the certificate when it was issued.
import type { ApPaymentDto, WhtCertificateDto, WhtCondition, WhtForm, WhtIncomeType, WhtPayeeSnapshot, WhtPayerSnapshot } from '@/shared/contract';
import type { PrintCompany } from '../quotations/print-model';

/** `1234567890123` → `1-2345-67890-12-3`; anything that is not 13 digits is shown as it is. */
export function formatTaxId(taxId: string): string {
    const d = taxId.replace(/\D/g, '');
    if (d.length !== 13) return taxId;
    return `${d.slice(0, 1)}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d.slice(12)}`;
}

export interface WhtCertificatePrintModel {
    watermark: 'void' | null;
    number: string;
    bookNo: string;
    payer: WhtPayerSnapshot;
    payee: WhtPayeeSnapshot;
    form: WhtForm;
    incomeType: WhtIncomeType;
    incomeDesc: string;
    payDate: string;
    baseAmount: number;
    whtRate: number;
    whtAmount: number;
    condition: WhtCondition;
    /** Signature and stamp images of the company (live files; null when none). */
    signatureUrl: string | null;
    stampUrl: string | null;
}

export function buildWhtCertificatePrintModel(cert: WhtCertificateDto, company: PrintCompany | null): WhtCertificatePrintModel {
    return {
        watermark: cert.status === 'voided' ? 'void' : null,
        number: cert.number,
        bookNo: cert.bookNo,
        payer: cert.payer,
        payee: cert.payee,
        form: cert.form,
        incomeType: cert.incomeType,
        incomeDesc: cert.incomeDesc,
        payDate: cert.payDate,
        baseAmount: cert.baseAmount,
        whtRate: cert.whtRate,
        whtAmount: cert.whtAmount,
        condition: cert.condition,
        signatureUrl: company?.signatureUrl ?? null,
        stampUrl: company?.stampUrl ?? null,
    };
}

export interface PaymentVoucherPrintModel {
    watermark: 'void' | null;
    company: PrintCompany;
    number: string;
    payDate: string;
    payeeName: string;
    method: ApPaymentDto['method'];
    bankRef: string;
    whtCertificateNumber: string | null;
    rows: { billNumber: string; supplierInvoiceNo: string; settled: number; wht: number; cash: number }[];
    settledTotal: number;
    whtTotal: number;
    cashTotal: number;
}

export function buildPaymentVoucherPrintModel(payment: ApPaymentDto, company: PrintCompany): PaymentVoucherPrintModel {
    const rows = payment.allocations.map(a => ({
        billNumber: a.billNumber ?? '', supplierInvoiceNo: a.supplierInvoiceNo, settled: a.settled, wht: a.wht, cash: a.cash,
    }));
    return {
        watermark: payment.status === 'voided' ? 'void' : null,
        company,
        number: payment.number,
        payDate: payment.payDate,
        payeeName: payment.payeeName,
        method: payment.method,
        bankRef: payment.bankRef,
        whtCertificateNumber: payment.whtCertificateNumber,
        rows,
        settledTotal: rows.reduce((s, r) => s + r.settled, 0),
        whtTotal: payment.whtAmount,
        cashTotal: payment.cashAmount,
    };
}
