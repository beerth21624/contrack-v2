// ─── Quotation draft from a BOQ version (docs/erp/02-domain-model.md §2 rule 6) ───
// Pure. Sections and lines come from boq_version_sections / boq_version_lines, English text from the BOQ overlay,
// commercial terms from resolveSettings (src/domain/erp/profiles.ts) and the company's VAT registration.
import type { MilestoneTemplateItem, ProjectCommercialSettings } from '../../shared/contract/erp/company';
import type { DocLanguage } from '../../shared/contract/erp/common';
import { BOQ_SECTION_TITLES_EN, boqLineEn } from '../boq/template.v5.en';
import type { BoqVersionLine, BoqVersionSection } from '../boq-control/version-lines';
import { roundQty } from '../money/money';
import { defaultGovernmentParts } from './government';
import { DEFAULT_QUOTATION_RATES, priceQuotation } from './pricing';
import type {
    DetailLevel, PricedQuotation, QuotationFormat, QuotationLineInput, QuotationPricing, QuotationRates,
    QuotationSectionInput,
} from './types';

export interface QuotationDraftSettings {
    /** `resolveSettings(projectType, company.defaults, project.settings)`. */
    project: ProjectCommercialSettings;
    /** `company_profiles.vat_registered` / `vat_rate`. */
    vatRegistered: boolean;
    vatRate: number;
    /** Rates every section starts with (default DEFAULT_QUOTATION_RATES; government always 0). */
    rates?: Partial<QuotationRates>;
}

export interface QuotationDraft extends PricedQuotation {
    format: QuotationFormat;
    detailLevel: DetailLevel;
    language: DocLanguage;
    pricing: QuotationPricing;
    paymentTerms: MilestoneTemplateItem[];
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);

/**
 * Cost units per quantity printed on the quotation. The BOQ prices material on the gross quantity (waste included)
 * and some lines (tie wire) have only a gross quantity, so the quotation uses the line's own amounts over its
 * quantity: qty × unit ≈ the BOQ total, waste included (D-180).
 */
function costUnits(line: BoqVersionLine): { qty: number; costMatUnit: number; costLabUnit: number } {
    const net = finite(line.qty);
    const gross = finite(line.grossQty ?? 0);
    const qty = net !== 0 ? net : gross !== 0 ? gross : 1;
    return {
        qty: roundQty(qty),
        costMatUnit: roundQty(finite(line.matTotal) / qty),
        costLabUnit: roundQty(finite(line.labTotal) / qty),
    };
}

/** Lines of a BOQ version as quotation lines (kind 'boq', English from the overlay or ''). */
export function quotationLinesFromBoq(lines: readonly BoqVersionLine[]): QuotationLineInput[] {
    return lines.map(l => ({
        sectionNo: l.sectionNo,
        sort: l.sort,
        kind: 'boq',
        lineKey: l.lineKey,
        descTh: l.descTh,
        descEn: boqLineEn(l.lineKey, l.descTh),
        unit: l.unit,
        ...costUnits(l),
        costAmount: finite(l.total),
    }));
}

/**
 * A priced draft quotation from a BOQ version: one section per BOQ section that has lines (included when it counts
 * in the construction total, so section 0 land inspection starts left out, D-181), terms from the project settings.
 */
export function buildQuotationDraft(
    boq: { sections: readonly BoqVersionSection[]; lines: readonly BoqVersionLine[] },
    settings: QuotationDraftSettings,
): QuotationDraft {
    const { project } = settings;
    const format = project.quotationFormat;
    const government = format === 'government';
    const rates: QuotationRates = government
        ? { markupRate: 0, overheadRate: 0, profitRate: 0 }
        : { ...DEFAULT_QUOTATION_RATES, ...settings.rates };
    const withLines = new Set(boq.lines.map(l => l.sectionNo));
    const sections: QuotationSectionInput[] = boq.sections
        .filter(s => withLines.has(s.sectionNo))
        .map((s, i) => ({
            sectionNo: s.sectionNo,
            titleTh: s.titleTh,
            titleEn: BOQ_SECTION_TITLES_EN[s.sectionNo] ?? '',
            included: s.inConstructionTotal,
            sort: i + 1,
            ...rates,
            vatRate: null,
        }));
    const lines = quotationLinesFromBoq(boq.lines);
    const pricing: QuotationPricing = {
        vatMode: government ? 'included_in_factor' : settings.vatRegistered ? 'document' : 'none',
        vatRate: settings.vatRegistered ? finite(settings.vatRate) : 0,
        defaults: rates,
        discount: null,
        rounding: 'none',
        parts: government ? defaultGovernmentParts(sections) : [],
    };
    const detailLevel = project.detailLevel;
    const priced = priceQuotation({ format, detailLevel, pricing, sections, lines, vatRegistered: settings.vatRegistered });
    return {
        ...priced,
        format,
        detailLevel,
        language: project.documentLanguage,
        pricing,
        paymentTerms: project.milestoneTemplate.map(m => ({ ...m })),
    };
}
