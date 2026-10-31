// ─── Quotations (docs/erp/02-domain-model.md §2) ───
// WP-22: the constants the pricing domain (src/domain/quotation) uses; WP-23: statuses, requests and DTOs.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { businessDateSchema, docLanguageSchema, quantitySchema, rateSchema, unitPriceSchema } from './common';
import { DETAIL_LEVELS, QUOTATION_FORMATS, bankAccountSchema, milestoneTemplateItemSchema, milestoneTemplateSchema } from './company';
import { customerKindSchema } from './customers';

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

// ─── WP-23: statuses, request and DTO schemas (docs/erp/02-domain-model.md §2) ───

/** Status of one quotation version (transition table in backend/src/modules/quotations/domain/quotation-state.ts). */
export const QUOTATION_VERSION_STATUSES = [
    'draft', 'pending_approval', 'issued', 'accepted', 'change_requested', 'rejected', 'expired', 'superseded', 'cancelled',
] as const;
export const quotationVersionStatusSchema = z.enum(QUOTATION_VERSION_STATUSES);
export type QuotationVersionStatus = z.infer<typeof quotationVersionStatusSchema>;

/** The customer's answer (customer link or recorded by the team). */
export const QUOTATION_RESPONSE_ACTIONS = ['accept', 'request_change', 'reject'] as const;
export const quotationResponseActionSchema = z.enum(QUOTATION_RESPONSE_ACTIONS);
export type QuotationResponseAction = z.infer<typeof quotationResponseActionSchema>;

/** Days a quotation stays valid when issued without `validUntil`. */
export const QUOTATION_DEFAULT_VALID_DAYS = 30;

/** Markup / overhead / profit: share of cost, 0–9 (numeric(7,6)). */
const shareSchema = z.number().finite().min(0).max(9);

export const quotationRatesSchema = z.object({ markupRate: shareSchema, overheadRate: shareSchema, profitRate: shareSchema });

export const quotationPartSchema = z.object({
    key: z.string().trim().min(1).max(40),
    titleTh: z.string().max(200),
    titleEn: z.string().max(200),
    sectionNos: z.array(z.number().int().min(0).max(9999)).max(300),
    factorF: z.number().finite().gt(0).max(10),
});

export const quotationPricingSchema = z.object({
    vatMode: z.enum(QUOTATION_VAT_MODES),
    vatRate: rateSchema,
    defaults: quotationRatesSchema,
    discount: z.object({ kind: z.enum(QUOTATION_DISCOUNT_KINDS), value: z.number().finite().min(0).max(1e11) }).nullable(),
    rounding: z.enum(QUOTATION_ROUNDINGS),
    parts: z.array(quotationPartSchema).max(50),
});
export type QuotationPricingDto = z.infer<typeof quotationPricingSchema>;

// ── Snapshots stored when a version is issued (mirror CompanySnapshot / CustomerSnapshot of the backend ports) ──

export const quotationCompanySnapshotSchema = z.object({
    language: docLanguageSchema,
    legalName: z.string(),
    taxId: z.string(),
    branchCode: z.string(),
    branchName: z.string(),
    address: z.string(),
    phone: z.string(),
    email: z.string(),
    website: z.string(),
    logoFileId: z.string().nullable(),
    stampFileId: z.string().nullable(),
    signatureFileId: z.string().nullable(),
    vatRegistered: z.boolean(),
    vatRate: z.number(),
    bankAccounts: z.array(bankAccountSchema),
    promptpayId: z.string(),
    brandColor: z.string(),
    footer: z.string(),
    yearStyle: z.enum(['ce', 'be']),
});
export type QuotationCompanySnapshot = z.infer<typeof quotationCompanySnapshotSchema>;

export const quotationCustomerSnapshotSchema = z.object({
    id: z.string(),
    kind: customerKindSchema,
    name: z.string(),
    taxId: z.string(),
    branchCode: z.string(),
    address: z.string(),
    contactName: z.string(),
    phone: z.string(),
    email: z.string(),
    whtRate: z.number(),
    paymentTermDays: z.number(),
    language: docLanguageSchema,
});
export type QuotationCustomerSnapshot = z.infer<typeof quotationCustomerSnapshotSchema>;

// ── DTOs. Fields marked "cost" are left out for callers without `quotations.seeMargins` and on customer links. ──

export const quotationTotalsDtoSchema = z.object({
    /** cost */
    cost: z.number().optional(),
    sell: z.number(),
    discount: z.number(),
    roundingAdj: z.number(),
    vatBase: z.number(),
    vat: z.number(),
    grandTotal: z.number(),
    /** cost */
    marginAmount: z.number().optional(),
    /** cost */
    marginPct: z.number().optional(),
});
export type QuotationTotalsDto = z.infer<typeof quotationTotalsDtoSchema>;

export const quotationSectionDtoSchema = z.object({
    sectionNo: z.number().int(),
    titleTh: z.string(),
    titleEn: z.string(),
    included: z.boolean(),
    sort: z.number().int(),
    vatRate: z.number().nullable(),
    /** cost */
    markupRate: z.number().optional(),
    /** cost */
    overheadRate: z.number().optional(),
    /** cost */
    profitRate: z.number().optional(),
    /** cost */
    costMat: z.number().optional(),
    /** cost */
    costLab: z.number().optional(),
    /** cost */
    costTotal: z.number().optional(),
    sellTotal: z.number(),
});
export type QuotationSectionDto = z.infer<typeof quotationSectionDtoSchema>;

export const quotationLineDtoSchema = z.object({
    id: uuidSchema,
    sectionNo: z.number().int(),
    sort: z.number().int(),
    kind: z.enum(QUOTATION_LINE_KINDS),
    lineKey: z.string().nullable(),
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    qty: z.number(),
    /** cost */
    costMatUnit: z.number().optional(),
    /** cost */
    costLabUnit: z.number().optional(),
    /** cost */
    costAmount: z.number().optional(),
    sellMatUnit: z.number(),
    sellLabUnit: z.number(),
    sellUnit: z.number(),
    sellAmount: z.number(),
});
export type QuotationLineDto = z.infer<typeof quotationLineDtoSchema>;

/** Government part (ปร.5 / ปร.6): sell = Σ sell of its sections, VAT included. */
export const quotationPartTotalDtoSchema = quotationPartSchema.extend({
    /** cost */
    cost: z.number().optional(),
    sell: z.number(),
});
export type QuotationPartTotalDto = z.infer<typeof quotationPartTotalDtoSchema>;

/** `defaults` (the starting rates) is cost data. */
export const quotationPricingDtoSchema = quotationPricingSchema.extend({ defaults: quotationRatesSchema.optional() });

export const quotationVersionSummaryDtoSchema = z.object({
    id: uuidSchema,
    quotationId: uuidSchema,
    projectId: uuidSchema,
    versionNo: z.number().int(),
    status: quotationVersionStatusSchema,
    /** Base number on the first issued version, `${base}-R<n>` on the later ones; null until issued. */
    number: z.string().nullable(),
    boqVersionId: uuidSchema.nullable(),
    format: z.enum(QUOTATION_FORMATS),
    detailLevel: z.enum(DETAIL_LEVELS),
    language: docLanguageSchema,
    issueDate: businessDateSchema.nullable(),
    validUntil: businessDateSchema.nullable(),
    vatBase: z.number(),
    grandTotal: z.number(),
    issuedAt: isoDateTimeSchema.nullable(),
    acceptedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type QuotationVersionSummaryDto = z.infer<typeof quotationVersionSummaryDtoSchema>;

export const quotationVersionDtoSchema = quotationVersionSummaryDtoSchema.extend({
    title: z.string(),
    customerId: uuidSchema.nullable(),
    pricing: quotationPricingDtoSchema,
    totals: quotationTotalsDtoSchema,
    sections: z.array(quotationSectionDtoSchema),
    lines: z.array(quotationLineDtoSchema),
    parts: z.array(quotationPartTotalDtoSchema),
    paymentTerms: z.array(milestoneTemplateItemSchema),
    termsTh: z.string(),
    termsEn: z.string(),
    note: z.string(),
    customerSnapshot: quotationCustomerSnapshotSchema.nullable(),
    companySnapshot: quotationCompanySnapshotSchema.nullable(),
    acceptedByName: z.string(),
    responseNote: z.string(),
    issuedBy: uuidSchema.nullable(),
    /** The caller sees cost fields. */
    seesMargins: z.boolean(),
    /** Draft and the caller has `quotations.manage` on an active project. */
    canEdit: z.boolean(),
});
export type QuotationVersionDto = z.infer<typeof quotationVersionDtoSchema>;

export const quotationDtoSchema = z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    projectId: uuidSchema,
    customerId: uuidSchema.nullable(),
    title: z.string(),
    /** Base number (first issue). */
    number: z.string().nullable(),
    currentVersionId: uuidSchema.nullable(),
    acceptedVersionId: uuidSchema.nullable(),
    /** Every version, version_no ascending. */
    versions: z.array(quotationVersionSummaryDtoSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type QuotationDto = z.infer<typeof quotationDtoSchema>;
export const quotationListDtoSchema = z.array(quotationDtoSchema);

// ── Requests ──

/** POST /projects/:projectId/quotations — from a BOQ version, or from a new revision `QT-<n>` of the current BOQ. */
export const createQuotationRequestSchema = z.object({
    title: z.string().trim().max(200).optional(),
    boqVersionId: uuidSchema.optional(),
    /** Default: the project's customer. */
    customerId: uuidSchema.nullable().optional(),
    /** Default: the project's commercial settings. */
    format: z.enum(QUOTATION_FORMATS).optional(),
    detailLevel: z.enum(DETAIL_LEVELS).optional(),
    language: docLanguageSchema.optional(),
}).strict();
export type CreateQuotationRequest = z.infer<typeof createQuotationRequestSchema>;

/** A section as the editor sends it; omitted rates keep the stored ones (new sections: `pricing.defaults`). */
export const quotationSectionInputSchema = z.object({
    sectionNo: z.number().int().min(0).max(9999),
    titleTh: z.string().max(300),
    titleEn: z.string().max(300).default(''),
    included: z.boolean(),
    sort: z.number().int().min(0).max(100000),
    vatRate: rateSchema.nullable().default(null),
    markupRate: shareSchema.optional(),
    overheadRate: shareSchema.optional(),
    profitRate: shareSchema.optional(),
});

/**
 * A line as the editor sends it. `id` of a stored line keeps its BOQ cost (`boq` lines are re-costed only when qty or
 * unit costs change); omitted cost units keep the stored ones.
 */
export const quotationLineInputSchema = z.object({
    id: uuidSchema.optional(),
    sectionNo: z.number().int().min(0).max(9999),
    sort: z.number().int().min(0).max(1000000),
    kind: z.enum(QUOTATION_LINE_KINDS),
    lineKey: z.string().max(200).nullable().default(null),
    descTh: z.string().max(2000),
    descEn: z.string().max(2000).default(''),
    unit: z.string().max(40).default(''),
    qty: quantitySchema.default(0),
    costMatUnit: unitPriceSchema.optional(),
    costLabUnit: unitPriceSchema.optional(),
});

/** PATCH /quotation-versions/:versionId — draft only; sections / lines replace the whole list when sent. */
export const patchQuotationVersionRequestSchema = z.object({
    title: z.string().trim().min(1).max(200),
    customerId: uuidSchema.nullable(),
    format: z.enum(QUOTATION_FORMATS),
    detailLevel: z.enum(DETAIL_LEVELS),
    language: docLanguageSchema,
    issueDate: businessDateSchema.nullable(),
    validUntil: businessDateSchema.nullable(),
    pricing: quotationPricingSchema.partial(),
    sections: z.array(quotationSectionInputSchema).max(300),
    lines: z.array(quotationLineInputSchema).max(5000),
    paymentTerms: milestoneTemplateSchema,
    termsTh: z.string().max(10000),
    termsEn: z.string().max(10000),
    note: z.string().max(5000),
}).partial().strict();
export type PatchQuotationVersionRequest = z.infer<typeof patchQuotationVersionRequestSchema>;
export type PatchQuotationVersionInput = z.input<typeof patchQuotationVersionRequestSchema>;

/** POST /quotations/:quotationId/versions — copy a version (default the latest) or rebuild from a BOQ version. */
export const newQuotationVersionRequestSchema = z.object({
    fromVersionId: uuidSchema.optional(),
    /** Rebuild sections and lines from the BOQ: this version, or a new revision `QT-<n>` when `fromBoq` without it. */
    fromBoq: z.boolean().default(false),
    boqVersionId: uuidSchema.optional(),
}).strict();
export type NewQuotationVersionRequest = z.infer<typeof newQuotationVersionRequestSchema>;

/** POST /quotation-versions/:versionId/issue — dates default to today and today + 30 days. */
export const issueQuotationVersionRequestSchema = z.object({
    issueDate: businessDateSchema.optional(),
    validUntil: businessDateSchema.optional(),
}).strict();
export type IssueQuotationVersionRequest = z.infer<typeof issueQuotationVersionRequestSchema>;

/** POST /quotation-versions/:versionId/record-response — an answer the customer gave outside the link. */
export const recordQuotationResponseRequestSchema = z.object({
    action: quotationResponseActionSchema,
    acceptedByName: z.string().trim().min(1).max(200),
    note: z.string().max(2000).default(''),
}).strict();
export type RecordQuotationResponseRequest = z.infer<typeof recordQuotationResponseRequestSchema>;

/** GET /quotations/:quotationId/compare?from=&to= */
export const quotationCompareQuerySchema = z.object({ from: uuidSchema, to: uuidSchema });
export type QuotationCompareQuery = z.infer<typeof quotationCompareQuerySchema>;

const changeSchema = z.enum(['added', 'removed', 'changed', 'same']);

export const quotationCompareDtoSchema = z.object({
    from: quotationVersionSummaryDtoSchema,
    to: quotationVersionSummaryDtoSchema,
    sections: z.array(z.object({
        sectionNo: z.number().int(),
        titleTh: z.string(),
        titleEn: z.string(),
        change: changeSchema,
        sellBefore: z.number(),
        sellAfter: z.number(),
        deltaSell: z.number(),
        /** cost */
        deltaCost: z.number().optional(),
    })),
    lines: z.array(z.object({
        key: z.string(),
        sectionNo: z.number().int(),
        change: changeSchema,
        before: quotationLineDtoSchema.optional(),
        after: quotationLineDtoSchema.optional(),
        deltaQty: z.number(),
        deltaSell: z.number(),
        /** cost */
        deltaCost: z.number().optional(),
    })),
    totals: z.object({ before: quotationTotalsDtoSchema, after: quotationTotalsDtoSchema, delta: quotationTotalsDtoSchema }),
    counts: z.record(changeSchema, z.number().int()),
});
export type QuotationCompareDto = z.infer<typeof quotationCompareDtoSchema>;

/** `payload` of a quotation customer link (no cost fields). */
export const quotationLinkPayloadSchema = z.object({
    quotationId: uuidSchema,
    version: quotationVersionDtoSchema,
    projectName: z.string(),
});
export type QuotationLinkPayload = z.infer<typeof quotationLinkPayloadSchema>;
