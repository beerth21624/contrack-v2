// ─── Editor state of a quotation draft: form <-> DTO, live pricing, PATCH body, small pure edits ───
// Pure (no React). Money / rates follow src/domain/quotation: rates are fractions, amounts in baht.
import {
    DEFAULT_QUOTATION_RATES, QuotationPricingError, defaultGovernmentParts, lineCostAmount, priceQuotation, quotationPricingIssues,
    type QuotationLine, type QuotationLineInput, type QuotationPart, type QuotationPartTotal, type QuotationPricing, type QuotationPricingIssue,
    type QuotationRates, type QuotationSection, type QuotationSectionInput, type QuotationTotals,
} from '@/domain/quotation';
import { CUSTOM_SECTION_NO_MIN, type MilestoneTemplateItem, type PatchQuotationVersionInput, type QuotationVersionDto } from '@/shared/contract';

/** A line of the editor: `ck` is a client key that survives pricing (stored lines: their id). */
export type FormLine = QuotationLineInput & { ck: string };
export type PricedLine = QuotationLine & { ck: string };

export interface EditorForm {
    title: string;
    customerId: string | null;
    format: QuotationVersionDto['format'];
    detailLevel: QuotationVersionDto['detailLevel'];
    language: QuotationVersionDto['language'];
    issueDate: string | null;
    validUntil: string | null;
    termsTh: string;
    termsEn: string;
    note: string;
    paymentTerms: MilestoneTemplateItem[];
    pricing: QuotationPricing;
    sections: QuotationSectionInput[];
    lines: FormLine[];
}
export type FormKey = keyof EditorForm;

/** What the screen shows: sections, lines, totals and government parts, priced. */
export interface PricedView {
    sections: QuotationSection[];
    lines: PricedLine[];
    totals: QuotationTotals;
    parts: QuotationPartTotal[];
}

let counter = 0;
export function newClientKey(): string {
    counter += 1;
    return `new-${Date.now().toString(36)}-${counter}`;
}

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;
/** A rate (fraction) from a percent typed by the user. */
export const rateFromPercent = (pct: number): number => round6(pct / 100);
/** A percent to show for a rate (fraction). */
export const percentOfRate = (rate: number): number => round6(rate * 100);

export function formFromDto(v: QuotationVersionDto): EditorForm {
    return {
        title: v.title,
        customerId: v.customerId,
        format: v.format,
        detailLevel: v.detailLevel,
        language: v.language,
        issueDate: v.issueDate,
        validUntil: v.validUntil,
        termsTh: v.termsTh,
        termsEn: v.termsEn,
        note: v.note,
        paymentTerms: v.paymentTerms.map(p => ({ ...p })),
        pricing: {
            vatMode: v.pricing.vatMode,
            vatRate: v.pricing.vatRate,
            defaults: v.pricing.defaults ?? { ...DEFAULT_QUOTATION_RATES },
            discount: v.pricing.discount,
            rounding: v.pricing.rounding,
            parts: v.pricing.parts.map(p => ({ ...p, sectionNos: [...p.sectionNos] })),
        },
        sections: v.sections.map(s => ({
            sectionNo: s.sectionNo, titleTh: s.titleTh, titleEn: s.titleEn, included: s.included, sort: s.sort, vatRate: s.vatRate,
            markupRate: s.markupRate ?? 0, overheadRate: s.overheadRate ?? 0, profitRate: s.profitRate ?? 0,
        })),
        lines: v.lines.map(l => ({
            id: l.id, ck: l.id, sectionNo: l.sectionNo, sort: l.sort, kind: l.kind, lineKey: l.lineKey, descTh: l.descTh, descEn: l.descEn,
            unit: l.unit, qty: l.qty, costMatUnit: l.costMatUnit ?? 0, costLabUnit: l.costLabUnit ?? 0, costAmount: l.costAmount ?? 0,
        })),
    };
}

/** The server's figures as the screen model (cost fields are 0 when the caller may not see them). */
export function pricedFromDto(v: QuotationVersionDto): PricedView {
    const t = v.totals;
    return {
        sections: v.sections.map(s => ({
            sectionNo: s.sectionNo, titleTh: s.titleTh, titleEn: s.titleEn, included: s.included, sort: s.sort, vatRate: s.vatRate,
            markupRate: s.markupRate ?? 0, overheadRate: s.overheadRate ?? 0, profitRate: s.profitRate ?? 0,
            costMat: s.costMat ?? 0, costLab: s.costLab ?? 0, costTotal: s.costTotal ?? 0, sellTotal: s.sellTotal,
        })),
        lines: v.lines.map(l => ({
            id: l.id, ck: l.id, sectionNo: l.sectionNo, sort: l.sort, kind: l.kind, lineKey: l.lineKey, descTh: l.descTh, descEn: l.descEn,
            unit: l.unit, qty: l.qty, costMatUnit: l.costMatUnit ?? 0, costLabUnit: l.costLabUnit ?? 0, costAmount: l.costAmount ?? 0,
            sellMatUnit: l.sellMatUnit, sellLabUnit: l.sellLabUnit, sellUnit: l.sellUnit, sellAmount: l.sellAmount,
        })),
        totals: {
            cost: t.cost ?? 0, sell: t.sell, discount: t.discount, roundingAdj: t.roundingAdj, vatBase: t.vatBase, vat: t.vat,
            grandTotal: t.grandTotal, marginAmount: t.marginAmount ?? 0, marginPct: t.marginPct ?? 0,
        },
        parts: v.parts.map(p => ({ ...p, sectionNos: [...p.sectionNos], cost: p.cost ?? 0 })),
    };
}

export type PriceResult = { ok: true; priced: PricedView } | { ok: false; issues: QuotationPricingIssue[] };

/** Live pricing of the form with src/domain/quotation (the server prices again on save). */
export function priceForm(form: EditorForm, vatRegistered: boolean): PriceResult {
    const input = { format: form.format, detailLevel: form.detailLevel, pricing: form.pricing, sections: form.sections, lines: form.lines };
    const issues = quotationPricingIssues(input);
    if (issues.length > 0) return { ok: false, issues };
    try {
        const r = priceQuotation({ ...input, vatRegistered });
        return { ok: true, priced: { sections: r.sections, lines: r.lines as PricedLine[], totals: r.totals, parts: r.parts } };
    } catch (e) {
        if (e instanceof QuotationPricingError) return { ok: false, issues: [...e.issues] };
        throw e;
    }
}

/** The PATCH body for the changed parts of the form (sections / lines / pricing go whole). */
export function buildPatch(form: EditorForm, keys: Iterable<FormKey>): PatchQuotationVersionInput {
    const body: PatchQuotationVersionInput = {};
    for (const k of keys) {
        switch (k) {
            case 'title': body.title = form.title.trim() === '' ? undefined : form.title.trim(); break;
            case 'customerId': body.customerId = form.customerId; break;
            case 'format': body.format = form.format; break;
            case 'detailLevel': body.detailLevel = form.detailLevel; break;
            case 'language': body.language = form.language; break;
            case 'issueDate': body.issueDate = form.issueDate; break;
            case 'validUntil': body.validUntil = form.validUntil; break;
            case 'termsTh': body.termsTh = form.termsTh; break;
            case 'termsEn': body.termsEn = form.termsEn; break;
            case 'note': body.note = form.note; break;
            case 'paymentTerms': body.paymentTerms = form.paymentTerms; break;
            case 'pricing': body.pricing = form.pricing; break;
            case 'sections': body.sections = form.sections; break;
            case 'lines':
                body.lines = form.lines.map(l => ({
                    ...(l.id !== undefined ? { id: l.id } : {}),
                    sectionNo: l.sectionNo, sort: l.sort, kind: l.kind, lineKey: l.lineKey, descTh: l.descTh, descEn: l.descEn,
                    unit: l.unit, qty: l.qty, costMatUnit: l.costMatUnit, costLabUnit: l.costLabUnit,
                }));
                break;
        }
    }
    if (body.title === undefined) delete body.title;
    return body;
}

// ── edits ──

/** Government parts that cover every included section exactly once (as the server's fitParts). */
export function fitParts(parts: readonly QuotationPart[], sections: readonly QuotationSectionInput[]): QuotationPart[] {
    const nos = new Set(sections.map(s => s.sectionNo));
    const seen = new Set<number>();
    const fitted = parts.map(p => ({
        ...p,
        sectionNos: p.sectionNos.filter(n => {
            if (!nos.has(n) || seen.has(n)) return false;
            seen.add(n);
            return true;
        }),
    }));
    if (fitted.length === 0) return defaultGovernmentParts(sections);
    const missing = sections.filter(s => s.included && !seen.has(s.sectionNo)).map(s => s.sectionNo);
    const first = fitted[0];
    if (missing.length > 0 && first !== undefined) fitted[0] = { ...first, sectionNos: [...first.sectionNos, ...missing] };
    return fitted;
}

/** Sections changed: a government quotation keeps its parts covering the included sections. Returns the changed keys too. */
export function withSections(form: EditorForm, sections: QuotationSectionInput[], lines?: FormLine[]): { form: EditorForm; keys: FormKey[] } {
    const next: EditorForm = { ...form, sections, ...(lines !== undefined ? { lines } : {}) };
    const keys: FormKey[] = lines !== undefined ? ['sections', 'lines'] : ['sections'];
    if (form.format === 'government') {
        next.pricing = { ...form.pricing, parts: fitParts(form.pricing.parts, sections) };
        keys.push('pricing');
    }
    return { form: next, keys };
}

export function patchSection(form: EditorForm, sectionNo: number, patch: Partial<QuotationSectionInput>): { form: EditorForm; keys: FormKey[] } {
    return withSections(form, form.sections.map(s => (s.sectionNo === sectionNo ? { ...s, ...patch } : s)));
}

export function addCustomSection(form: EditorForm, titleTh: string, titleEn: string): { form: EditorForm; keys: FormKey[]; sectionNo: number } {
    const sectionNo = Math.max(CUSTOM_SECTION_NO_MIN - 1, ...form.sections.map(s => s.sectionNo)) + 1;
    const sort = Math.max(0, ...form.sections.map(s => s.sort)) + 1;
    const section: QuotationSectionInput = { sectionNo, titleTh, titleEn, included: true, sort, vatRate: null, ...form.pricing.defaults };
    return { ...withSections(form, [...form.sections, section]), sectionNo };
}

export function removeSection(form: EditorForm, sectionNo: number): { form: EditorForm; keys: FormKey[] } {
    return withSections(form, form.sections.filter(s => s.sectionNo !== sectionNo), form.lines.filter(l => l.sectionNo !== sectionNo));
}

/** Gives every section the starting rates of `pricing.defaults`. */
export function applyDefaultRates(form: EditorForm): { form: EditorForm; keys: FormKey[] } {
    const r: QuotationRates = form.pricing.defaults;
    return withSections(form, form.sections.map(s => ({ ...s, markupRate: r.markupRate, overheadRate: r.overheadRate, profitRate: r.profitRate })));
}

export function addLine(form: EditorForm, sectionNo: number, kind: 'custom' | 'note'): EditorForm {
    const sort = Math.max(0, ...form.lines.filter(l => l.sectionNo === sectionNo).map(l => l.sort)) + 1;
    const line: FormLine = {
        ck: newClientKey(), sectionNo, sort, kind, lineKey: null, descTh: '', descEn: '', unit: '', qty: kind === 'note' ? 0 : 1,
        costMatUnit: 0, costLabUnit: 0, costAmount: 0,
    };
    return { ...form, lines: [...form.lines, line] };
}

export function removeLine(form: EditorForm, ck: string): EditorForm {
    return { ...form, lines: form.lines.filter(l => l.ck !== ck) };
}

/**
 * Edit a line. A BOQ line keeps its BOQ cost until qty or a unit cost changes (then qty × units, as the server);
 * `original` is the stored line to return to when the edit is undone.
 */
export function patchLine(form: EditorForm, ck: string, patch: Partial<FormLine>, original: ReadonlyMap<string, FormLine>): EditorForm {
    return {
        ...form,
        lines: form.lines.map(l => {
            if (l.ck !== ck) return l;
            const next = { ...l, ...patch };
            if (next.kind === 'boq') {
                const o = original.get(ck);
                next.costAmount = o?.qty === next.qty && o.costMatUnit === next.costMatUnit && o.costLabUnit === next.costLabUnit
                    ? o.costAmount
                    : lineCostAmount(next.qty, next.costMatUnit, next.costLabUnit);
            }
            return next;
        }),
    };
}

/** The title of a section in the UI language (the Thai title when the English one is empty). */
export function sectionTitle(s: { sectionNo: number; titleTh: string; titleEn: string }, language: 'th' | 'en'): string {
    const own = language === 'en' && s.titleEn !== '' ? s.titleEn : s.titleTh;
    return own === '' ? s.titleTh : own;
}

export type FormProblem = 'payment_terms_total' | 'payment_terms_label' | 'dates_order';

/** Problems the server would refuse that the pricing rules do not cover (payment terms, dates). */
export function formProblems(form: EditorForm): FormProblem[] {
    const out: FormProblem[] = [];
    const terms = form.paymentTerms;
    if (terms.length > 0) {
        if (Math.abs(terms.reduce((s, i) => s + i.pct, 0) - 1) >= 0.0001 || terms.some(i => !(i.pct > 0))) out.push('payment_terms_total');
        if (terms.some(i => i.labelTh.trim() === '' || i.labelEn.trim() === '')) out.push('payment_terms_label');
    }
    if (form.issueDate !== null && form.validUntil !== null && form.validUntil < form.issueDate) out.push('dates_order');
    return out;
}
