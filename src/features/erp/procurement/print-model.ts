// ─── PO and RFQ as plain data for the printed page (company letterhead, supplier block, lines, totals) ───
// Pure (no React). Line text is picked in the document's language; numbers and dates are formatted by the component.
import { pickLocalized } from '@/i18n/format';
import type { DocLanguage, PurchaseOrderDto, RfqDto, SupplierDto, SupplierSnapshot } from '@/shared/contract';
import type { PrintCompany, PrintCustomer } from '../quotations/print-model';

export type PrintWatermarkKind = 'draft' | 'void' | null;

export interface DocLine {
    code: string;
    text: string;
    unit: string;
    qty: number;
    unitPrice: number;
    amount: number;
}

export interface PurchaseOrderPrintModel {
    language: DocLanguage;
    watermark: PrintWatermarkKind;
    number: string | null;
    orderDate: string | null;
    deliveryDate: string | null;
    deliveryAddress: string;
    company: PrintCompany;
    supplier: PrintCustomer | null;
    projectName: string;
    paymentTermDays: number | null;
    terms: string;
    lines: DocLine[];
    subtotal: number;
    discount: number;
    vat: number;
    vatRate: number;
    total: number;
}

export interface RfqPrintModel {
    language: DocLanguage;
    watermark: PrintWatermarkKind;
    number: string | null;
    title: string;
    date: string;
    dueDate: string | null;
    deliveryAddress: string;
    company: PrintCompany;
    /** The supplier the copy is addressed to (null = left blank to write in). */
    supplier: PrintCustomer | null;
    projectName: string;
    lines: Pick<DocLine, 'code' | 'text' | 'unit' | 'qty'>[];
}

const pick = (th: string, en: string, language: DocLanguage): string => {
    const first = language === 'en' ? en : th;
    return first.trim() !== '' ? first : language === 'en' ? th : en;
};

export const supplierFromSnapshot = (s: SupplierSnapshot): PrintCustomer => ({
    name: s.name, taxId: s.taxId, branchCode: s.branchCode, address: s.address, contactName: s.contactName, phone: s.phone, email: s.email,
});

export const supplierFromDto = (s: SupplierDto, language: DocLanguage): PrintCustomer => ({
    name: pickLocalized(s.nameTh, s.nameEn, language), taxId: s.taxId, branchCode: s.branchCode,
    address: pickLocalized(s.addressTh, s.addressEn, language), contactName: s.contactName, phone: s.phone, email: s.email,
});

export function buildPurchaseOrderPrintModel(args: {
    order: PurchaseOrderDto;
    company: PrintCompany;
    /** The frozen snapshot is used when the PO has one, else this live supplier. */
    supplier: SupplierDto | undefined;
    projectName: string;
}): PurchaseOrderPrintModel {
    const o = args.order;
    const language = o.language;
    let supplier: PrintCustomer | null = null;
    if (o.supplierSnapshot !== null) supplier = supplierFromSnapshot(o.supplierSnapshot);
    else if (args.supplier !== undefined) supplier = supplierFromDto(args.supplier, language);
    return {
        language,
        watermark: o.status === 'cancelled' ? 'void' : o.status === 'draft' || o.status === 'pending_approval' ? 'draft' : null,
        number: o.number,
        orderDate: o.orderDate,
        deliveryDate: o.deliveryDate,
        deliveryAddress: o.deliveryAddress,
        company: args.company,
        supplier,
        projectName: args.projectName,
        paymentTermDays: o.paymentTermDays,
        terms: o.terms,
        lines: [...o.lines].sort((a, b) => a.sort - b.sort).map((l): DocLine => ({
            code: l.costCode ?? '', text: pick(l.descTh, l.descEn, language), unit: l.unit, qty: l.qty, unitPrice: l.unitPrice, amount: l.amount,
        })),
        subtotal: o.subtotal,
        discount: o.discount,
        vat: o.vat,
        vatRate: o.vatRate,
        total: o.total,
    };
}

export function buildRfqPrintModel(args: {
    rfq: RfqDto;
    company: PrintCompany;
    supplier: PrintCustomer | null;
    projectName: string;
}): RfqPrintModel {
    const r = args.rfq;
    const language = r.language;
    return {
        language,
        watermark: r.status === 'cancelled' ? 'void' : r.status === 'draft' ? 'draft' : null,
        number: r.number,
        title: r.title,
        date: r.sentAt ?? r.createdAt,
        dueDate: r.dueDate,
        deliveryAddress: r.deliveryAddress,
        company: args.company,
        supplier: args.supplier,
        projectName: args.projectName,
        lines: [...r.lines].sort((a, b) => a.sort - b.sort).map(l => ({
            code: l.costCode ?? '', text: pick(l.descTh, l.descEn, language), unit: l.unit, qty: l.qty,
        })),
    };
}
