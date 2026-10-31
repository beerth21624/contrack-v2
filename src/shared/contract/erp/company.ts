// ─── Company profile, business profiles and project types (docs/erp/00-vision.md §4, 02-domain-model.md §1.3) ───
// Owns the constants and zod schemas; src/domain/erp/profiles.ts holds the default values and `resolveSettings`.
import { z } from 'zod';
import { fileDtoSchema } from '../files';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { docLanguageSchema, rateSchema } from './common';

export const BUSINESS_PROFILES = ['residential', 'government', 'commercial'] as const;
export const businessProfileSchema = z.enum(BUSINESS_PROFILES);
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export const PROJECT_TYPES = ['residential_new', 'residential_renovation', 'government', 'commercial'] as const;
export const projectTypeSchema = z.enum(PROJECT_TYPES);
export type ProjectType = z.infer<typeof projectTypeSchema>;

export const PRICE_SOURCES = ['market', 'government'] as const;
export const QUOTATION_FORMATS = ['lump_sum_by_category', 'detailed', 'government'] as const;
export const DETAIL_LEVELS = ['full', 'per_category', 'lump_sum'] as const;
export const BILLING_MODES = ['milestone', 'progress'] as const;
export const MILESTONE_TRIGGERS = ['signing', 'progress', 'handover', 'manual'] as const;
export type MilestoneTrigger = (typeof MILESTONE_TRIGGERS)[number];

/** One payment milestone of a template. `pct` = share of the contract value (0.2 = 20%). */
export const milestoneTemplateItemSchema = z.object({
    labelTh: z.string().trim().min(1).max(120),
    labelEn: z.string().trim().min(1).max(120),
    pct: z.number().finite().gt(0).max(1),
    trigger: z.enum(MILESTONE_TRIGGERS),
    /** Work progress (0.125 = 12.5%) at which a `progress` milestone falls due. */
    progressAt: z.number().finite().gt(0).max(1).optional(),
});
export type MilestoneTemplateItem = z.infer<typeof milestoneTemplateItemSchema>;

/** A template is empty (progress billing) or its shares add up to 100%. */
export const milestoneTemplateSchema = z.array(milestoneTemplateItemSchema).max(24)
    .refine(items => items.length === 0 || Math.abs(items.reduce((s, i) => s + i.pct, 0) - 1) < 0.0001, { message: 'Milestone shares must add up to 100%' });

const commercialShape = {
    priceSource: z.enum(PRICE_SOURCES),
    quotationFormat: z.enum(QUOTATION_FORMATS),
    detailLevel: z.enum(DETAIL_LEVELS),
    billingMode: z.enum(BILLING_MODES),
    milestoneTemplate: milestoneTemplateSchema,
    advancePct: rateSchema,
    retentionPct: rateSchema,
    customerWhtRate: rateSchema,
    escalation: z.boolean(),
    penaltyRatePerDay: rateSchema,
    guaranteePct: rateSchema,
    warrantyMonths: z.number().int().min(0).max(240),
    paymentTermDays: z.number().int().min(0).max(365),
    documentLanguage: docLanguageSchema,
};

/** Commercial terms of a project (defaults per project type, overridable by company, then by project). */
export const projectCommercialSettingsSchema = z.object(commercialShape);
export type ProjectCommercialSettings = z.infer<typeof projectCommercialSettingsSchema>;

/** Any subset of the commercial terms (a company or project override). */
export const projectSettingsOverrideSchema = z.object(commercialShape).partial().strict();
export type ProjectSettingsOverride = z.infer<typeof projectSettingsOverrideSchema>;

/** The company's overrides per project type (`company_profiles.defaults`). */
export const companyDefaultsSchema = z.object({
    residential_new: projectSettingsOverrideSchema.optional(),
    residential_renovation: projectSettingsOverrideSchema.optional(),
    government: projectSettingsOverrideSchema.optional(),
    commercial: projectSettingsOverrideSchema.optional(),
}).strict();
export type CompanyDefaults = z.infer<typeof companyDefaultsSchema>;

export const bankAccountSchema = z.object({
    bankCode: z.string().trim().max(10),
    bankName: z.string().trim().min(1).max(80),
    accountName: z.string().trim().min(1).max(120),
    accountNo: z.string().trim().min(1).max(30).regex(/^[0-9-]+$/),
    branch: z.string().trim().max(80),
});
export type BankAccount = z.infer<typeof bankAccountSchema>;

export const DOCUMENT_YEAR_STYLES = ['ce', 'be'] as const;

/** Tax id: empty or 13 digits (the check digit is verified by the backend: 400 `validation_failed`). */
const taxIdField = z.string().trim().regex(/^(\d{13})?$/);
const promptPayField = z.string().trim().regex(/^(\d{10}|\d{13})?$/);

/** PUT /workspaces/:workspaceId/company: the whole profile (every field). */
export const putCompanyProfileRequestSchema = z.object({
    legalNameTh: z.string().trim().max(200),
    legalNameEn: z.string().trim().max(200),
    taxId: taxIdField,
    branchCode: z.string().trim().regex(/^\d{5}$/),
    branchNameTh: z.string().trim().max(120),
    branchNameEn: z.string().trim().max(120),
    addressTh: z.string().trim().max(1000),
    addressEn: z.string().trim().max(1000),
    phone: z.string().trim().max(40),
    email: z.string().trim().max(200).refine(v => v === '' || z.string().email().safeParse(v).success, { message: 'Not an email' }),
    website: z.string().trim().max(200),
    logoFileId: uuidSchema.nullable(),
    stampFileId: uuidSchema.nullable(),
    signatureFileId: uuidSchema.nullable(),
    vatRegistered: z.boolean(),
    vatRate: rateSchema,
    businessProfiles: z.array(businessProfileSchema).max(BUSINESS_PROFILES.length)
        .refine(a => new Set(a).size === a.length, { message: 'Duplicate business profile' }),
    defaultProjectType: projectTypeSchema.nullable(),
    defaultDocLanguage: docLanguageSchema,
    documentYearStyle: z.enum(DOCUMENT_YEAR_STYLES),
    bankAccounts: z.array(bankAccountSchema).max(10),
    promptpayId: promptPayField,
    defaults: companyDefaultsSchema,
    brandColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/),
    documentFooterTh: z.string().trim().max(500),
    documentFooterEn: z.string().trim().max(500),
});
export type PutCompanyProfileRequest = z.infer<typeof putCompanyProfileRequestSchema>;

/** GET/PUT /workspaces/:workspaceId/company. `isDefault`: nothing saved yet (names = workspace name). */
export const companyProfileDtoSchema = putCompanyProfileRequestSchema.omit({ logoFileId: true, stampFileId: true, signatureFileId: true }).extend({
    logo: fileDtoSchema.nullable(),
    stamp: fileDtoSchema.nullable(),
    signature: fileDtoSchema.nullable(),
    /** `workspaces.name`, shown where a legal name is still empty. */
    workspaceName: z.string(),
    isDefault: z.boolean(),
    /** Project type a new project starts with (saved choice, else from the business profiles). */
    effectiveProjectType: projectTypeSchema,
    updatedBy: uuidSchema.nullable(),
    updatedAt: isoDateTimeSchema.nullable(),
});
export type CompanyProfileDto = z.infer<typeof companyProfileDtoSchema>;
