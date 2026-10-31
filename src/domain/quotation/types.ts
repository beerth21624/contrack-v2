// ─── Quotation domain types (docs/erp/02-domain-model.md §2) ───
// Pure. Money in baht (round2), rates as fractions (0.1 = 10 %), quantities and unit prices to 4 decimals.
import type { DETAIL_LEVELS, QUOTATION_FORMATS } from '../../shared/contract/erp/company';
import type {
    QuotationDiscountKind, QuotationLineKind, QuotationPricingIssueReason, QuotationRounding, QuotationVatMode,
} from '../../shared/contract/erp/quotations';

export type { QuotationDiscountKind, QuotationLineKind, QuotationPricingIssueReason, QuotationRounding, QuotationVatMode };
export type QuotationFormat = (typeof QUOTATION_FORMATS)[number];
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

/** markup + overhead + profit, each a share of cost: sellFactor = 1 + markup + overhead + profit (D-31). */
export interface QuotationRates {
    markupRate: number;
    overheadRate: number;
    profitRate: number;
}

/** Government: one ปร.5 per part; ปร.6 when there is more than one part. Factor F includes VAT (D-12, D-40). */
export interface QuotationPart {
    key: string;
    titleTh: string;
    titleEn: string;
    sectionNos: number[];
    factorF: number;
}

/** `qt_quotation_versions.pricing`. */
export interface QuotationPricing {
    vatMode: QuotationVatMode;
    vatRate: number;
    /** Rates a new section starts with. */
    defaults: QuotationRates;
    /** `pct`: value is a fraction of the subtotal (0.05 = 5 %); `amount`: baht. Not with vatMode 'per_category'. */
    discount: { kind: QuotationDiscountKind; value: number } | null;
    rounding: QuotationRounding;
    /** Government only (empty otherwise). */
    parts: QuotationPart[];
}

/** What the user sets on a section; costs and sell come from the lines (`priceQuotation`). */
export interface QuotationSectionInput extends QuotationRates {
    sectionNo: number;
    titleTh: string;
    titleEn: string;
    included: boolean;
    sort: number;
    /** VAT rate of this section for vatMode 'per_category' (null = the document rate). */
    vatRate: number | null;
}

/** `qt_quotation_sections`. */
export interface QuotationSection extends QuotationSectionInput {
    costMat: number;
    costLab: number;
    costTotal: number;
    sellTotal: number;
}

/** What a line carries before pricing. */
export interface QuotationLineInput {
    /** Row id once stored (lines without a line key are matched by it when versions are compared). */
    id?: string;
    sectionNo: number;
    sort: number;
    kind: QuotationLineKind;
    /** BOQ line key (`R58`, `footing:rebar:DB12`); null for custom and note lines. */
    lineKey: string | null;
    descTh: string;
    descEn: string;
    unit: string;
    qty: number;
    costMatUnit: number;
    costLabUnit: number;
    /** `boq`: the BOQ line's total (kept as is); `custom`: recomputed as qty × (mat + lab); `note`: 0. */
    costAmount: number;
}

/** `qt_quotation_lines`. */
export interface QuotationLine extends QuotationLineInput {
    sellMatUnit: number;
    sellLabUnit: number;
    sellUnit: number;
    sellAmount: number;
}

/** `qt_quotation_versions.totals`. */
export interface QuotationTotals {
    /** Σ cost of included sections. */
    cost: number;
    /** Σ sell of included sections (the subtotal before discount). */
    sell: number;
    discount: number;
    /** Rounding adjustment line (≤ 0). */
    roundingAdj: number;
    /** Amount before VAT. */
    vatBase: number;
    vat: number;
    grandTotal: number;
    marginAmount: number;
    /** marginAmount / vatBase (0 when vatBase = 0). */
    marginPct: number;
}

/** Government part totals (ปร.5 / ปร.6). */
export interface QuotationPartTotal {
    key: string;
    titleTh: string;
    titleEn: string;
    sectionNos: number[];
    factorF: number;
    /** Σ cost of the part's included sections. */
    cost: number;
    /** round2(cost × factorF), VAT included. */
    sell: number;
}

export interface QuotationPricingInput {
    format: QuotationFormat;
    detailLevel: DetailLevel;
    pricing: QuotationPricing;
    sections: readonly QuotationSectionInput[];
    lines: readonly QuotationLineInput[];
    /** `company_profiles.vat_registered`; false forces no VAT. */
    vatRegistered: boolean;
}

export interface PricedQuotation {
    sections: QuotationSection[];
    lines: QuotationLine[];
    totals: QuotationTotals;
    /** Government only (empty otherwise). */
    parts: QuotationPartTotal[];
    /** The VAT mode actually applied ('none' when the company is not VAT registered). */
    vatMode: QuotationVatMode;
}

export interface QuotationPricingIssue {
    reason: QuotationPricingIssueReason;
    /** Where it is, for zod `ctx.addIssue({ path })` (e.g. ['pricing', 'discount'], ['sections', 3]). */
    path: (string | number)[];
}
