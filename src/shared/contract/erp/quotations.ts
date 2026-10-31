// ─── Quotations (docs/erp/02-domain-model.md §2) ───
// WP-22 adds the constants the pricing domain (src/domain/quotation) uses; WP-23 adds the zod schemas and DTOs here
// and exports this file from ./index.ts.

/** How VAT is computed: once on the document, per section, none (company not VAT registered), or inside Factor F (government). */
export const QUOTATION_VAT_MODES = ['document', 'per_category', 'none', 'included_in_factor'] as const;
export type QuotationVatMode = (typeof QUOTATION_VAT_MODES)[number];

/** Rounding of the amount after discount down to a multiple of 100 / 1,000 (an adjustment line). */
export const QUOTATION_ROUNDINGS = ['none', 'to_100', 'to_1000'] as const;
export type QuotationRounding = (typeof QUOTATION_ROUNDINGS)[number];

export const QUOTATION_DISCOUNT_KINDS = ['amount', 'pct'] as const;
export type QuotationDiscountKind = (typeof QUOTATION_DISCOUNT_KINDS)[number];

/** `boq` = from a BOQ version line, `custom` = typed by the user, `note` = text only (no amounts). */
export const QUOTATION_LINE_KINDS = ['boq', 'custom', 'note'] as const;
export type QuotationLineKind = (typeof QUOTATION_LINE_KINDS)[number];

/** Section numbers from here up are sections the user added (BOQ sections are 0–31). */
export const CUSTOM_SECTION_NO_MIN = 100;

/** Why a quotation's pricing is refused (details.reason of a 400 validation_failed in WP-23). */
export const QUOTATION_PRICING_ISSUES = [
    'per_category_vat_with_discount',
    'per_category_vat_with_rounding',
    'government_requires_included_vat',
    'included_vat_requires_government',
    'government_with_discount',
    'government_with_rounding',
    'government_without_parts',
    'government_duplicate_part',
    'government_bad_factor',
    'government_section_without_part',
    'government_section_in_many_parts',
    'government_unknown_section',
    'discount_invalid',
    'discount_exceeds_subtotal',
    'line_without_section',
    'duplicate_section',
] as const;
export type QuotationPricingIssueReason = (typeof QUOTATION_PRICING_ISSUES)[number];
