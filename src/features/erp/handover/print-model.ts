// ─── The handover note as plain data (printed page): checklist in the document's language, no costs ───
// Pure (no React). Numbers and dates are formatted by the component.
import type { DocLanguage, HandoverAttendee, HandoverCheckStatus, HandoverDocumentKind, HandoverDto } from '@/shared/contract';
import type { PrintCompany, PrintCustomer } from '../quotations/print-model';

export interface HandoverPrintItem {
    text: string;
    status: HandoverCheckStatus;
    note: string;
}

export interface HandoverPrintDocument {
    kind: HandoverDocumentKind;
    title: string;
}

export interface HandoverPrintModel {
    language: DocLanguage;
    /** `draft` until the customer has accepted. */
    watermark: 'draft' | null;
    number: string | null;
    company: PrintCompany;
    customer: PrintCustomer | null;
    projectName: string;
    contractNumber: string | null;
    scheduledDate: string | null;
    inspectionDate: string | null;
    handoverDate: string | null;
    attendees: HandoverAttendee[];
    items: HandoverPrintItem[];
    defectsNote: string;
    acceptedByName: string;
    accepted: boolean;
    warrantyMonths: number;
    documents: HandoverPrintDocument[];
}

const pick = (th: string, en: string, language: DocLanguage): string => {
    const first = language === 'en' ? en : th;
    return first.trim() !== '' ? first : language === 'en' ? th : en;
};

export function buildHandoverPrintModel(args: {
    handover: HandoverDto;
    company: PrintCompany;
    customer: PrintCustomer | null;
    projectName: string;
    contractNumber: string | null;
    warrantyMonths: number;
}): HandoverPrintModel {
    const h = args.handover;
    const language = h.language;
    return {
        language,
        watermark: h.status === 'accepted' ? null : 'draft',
        number: h.number,
        company: args.company,
        customer: args.customer,
        projectName: args.projectName,
        contractNumber: args.contractNumber,
        scheduledDate: h.scheduledDate,
        inspectionDate: h.inspectionDate,
        handoverDate: h.handoverDate,
        attendees: h.attendees,
        items: h.checklist.map(c => ({ text: pick(c.itemTh, c.itemEn, language), status: c.status, note: c.note })),
        defectsNote: h.defectsNote,
        acceptedByName: h.acceptedByName,
        accepted: h.status === 'accepted',
        warrantyMonths: args.warrantyMonths,
        documents: h.documents.map(d => ({ kind: d.kind, title: d.title !== '' ? d.title : d.file?.name ?? '' })),
    };
}
