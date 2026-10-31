// ─── The VO document as plain data (printed page and the customer link): sell prices only, never costs ───
// Pure (no React). Line text is picked in the document's language; numbers and dates are formatted by the component.
import { round2 } from '@/domain/money';
import type { ContractVariationBilling, DocLanguage, VariationEvidenceKind, VariationOrderDto, VariationReason } from '@/shared/contract';
import type { PrintCompany, PrintCustomer } from '../quotations/print-model';

export type VariationWatermark = 'draft' | 'void' | null;

export interface VariationPrintLine {
    code: string;
    text: string;
    unit: string;
    qty: number;
    unitPrice: number;
    amount: number;
}

export interface VariationPrintEvidence {
    id: string;
    kind: VariationEvidenceKind;
    /** Signed link of the photo / document (null for a note). */
    url: string | null;
    name: string;
    isImage: boolean;
    note: string;
    takenAt: string | null;
}

export interface VariationPrintModel {
    language: DocLanguage;
    watermark: VariationWatermark;
    number: string | null;
    title: string;
    /** When it was sent (else when it was made). */
    date: string;
    reason: VariationReason;
    requestedByName: string;
    requestedDate: string | null;
    company: PrintCompany;
    customer: PrintCustomer | null;
    projectName: string;
    contractNumber: string | null;
    lines: VariationPrintLine[];
    sellTotal: number;
    vat: number;
    grandTotal: number;
    scheduleImpactDays: number;
    billing: ContractVariationBilling;
    evidence: VariationPrintEvidence[];
    accepted: boolean;
    rejected: boolean;
    acceptedByName: string;
    acceptedAt: string | null;
    responseNote: string;
}

const pick = (th: string, en: string, language: DocLanguage): string => {
    const first = language === 'en' ? en : th;
    return first.trim() !== '' ? first : language === 'en' ? th : en;
};

function watermarkOf(status: VariationOrderDto['status']): VariationWatermark {
    if (status === 'cancelled' || status === 'withdrawn') return 'void';
    if (status === 'draft' || status === 'pending_approval') return 'draft';
    return null;
}

export function buildVariationPrintModel(args: {
    variation: VariationOrderDto;
    company: PrintCompany;
    customer: PrintCustomer | null;
    projectName: string;
    contractNumber: string | null;
}): VariationPrintModel {
    const v = args.variation;
    const language = v.language;
    const lines = [...v.lines].sort((a, b) => a.sort - b.sort).map((l): VariationPrintLine => ({
        code: l.costCode ?? '',
        text: pick(l.descTh, l.descEn, language),
        unit: l.unit,
        qty: l.qtyDelta,
        unitPrice: l.sellUnit,
        amount: l.sellAmount,
    }));
    return {
        language,
        watermark: watermarkOf(v.status),
        number: v.number,
        title: v.title,
        date: v.submittedAt ?? v.createdAt,
        reason: v.reason,
        requestedByName: v.requestedByName,
        requestedDate: v.requestedDate,
        company: args.company,
        customer: args.customer,
        projectName: args.projectName,
        contractNumber: args.contractNumber,
        lines,
        sellTotal: v.sellTotal,
        vat: v.vat,
        grandTotal: round2(v.sellTotal + v.vat),
        scheduleImpactDays: v.scheduleImpactDays,
        billing: v.billing,
        evidence: v.evidence.map(e => ({
            id: e.id,
            kind: e.kind,
            url: e.file?.url ?? null,
            name: e.file?.name ?? '',
            isImage: e.file?.contentType.startsWith('image/') === true,
            note: e.note,
            takenAt: e.takenAt,
        })),
        accepted: v.status === 'accepted',
        rejected: v.status === 'rejected',
        acceptedByName: v.acceptedByName,
        acceptedAt: v.acceptedAt,
        responseNote: v.responseNote,
    };
}
