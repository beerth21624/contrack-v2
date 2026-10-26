// ─── Subcontracting contract: vendor profiles (owned by the crew) and vendor lists (owned by a buyer workspace) ───
import { z } from 'zod';
import { isoDateTimeSchema, roleSchema, uuidSchema } from '../common';
import { fileDtoSchema } from '../files';
import { phoneSchema } from '../phone-auth';
import { provinceSchema, tradeIdSchema, vendorTierSchema } from './common';

// ── Vendor profile (the crew's own data, one per vendor workspace) ──

export const portfolioItemDtoSchema = z.object({
    id: uuidSchema,
    title: z.string(),
    trade: tradeIdSchema,
    year: z.number().int().nullable(),
    district: z.string(),
    province: z.string(),
    photos: z.array(fileDtoSchema),
    note: z.string(),
    createdAt: isoDateTimeSchema,
});
export type PortfolioItemDto = z.infer<typeof portfolioItemDtoSchema>;

export const vendorProfileDtoSchema = z.object({
    workspaceId: uuidSchema,
    teamName: z.string(),
    contactName: z.string(),
    /** E.164, verified by OTP. */
    phone: z.string(),
    lineLinked: z.boolean(),
    trades: z.array(tradeIdSchema),
    provinces: z.array(z.string()),
    crewSkilled: z.number().int().nullable(),
    crewLabourers: z.number().int().nullable(),
    tools: z.array(z.string()),
    vatRegistered: z.boolean(),
    /** Reference labour rates per trade (บาท/หน่วย, free text unit) used to prefill bids. */
    referenceRates: z.array(z.object({ trade: tradeIdSchema, label: z.string(), unit: z.string(), rate: z.number() })),
    /** Months (YYYY-MM) the crew says it is free. */
    availableMonths: z.array(z.string()),
    tier: vendorTierSchema,
    /** L1 is reached when the profile is complete (team size, ≥ 3 portfolio items, trades, provinces). */
    profileComplete: z.boolean(),
    portfolio: z.array(portfolioItemDtoSchema),
    updatedAt: isoDateTimeSchema,
});
export type VendorProfileDto = z.infer<typeof vendorProfileDtoSchema>;

/** PUT /vendor/profile (vendor workspace owner/admin). Creates the profile when the workspace has none. */
export const putVendorProfileRequestSchema = z.object({
    workspaceId: uuidSchema,
    teamName: z.string().trim().min(1).max(120),
    contactName: z.string().trim().min(1).max(80),
    trades: z.array(tradeIdSchema).min(1).max(14),
    provinces: z.array(provinceSchema).max(77),
    crewSkilled: z.number().int().min(0).max(10000).nullable(),
    crewLabourers: z.number().int().min(0).max(10000).nullable(),
    tools: z.array(z.string().trim().min(1).max(60)).max(40),
    vatRegistered: z.boolean(),
    referenceRates: z.array(z.object({
        trade: tradeIdSchema, label: z.string().trim().min(1).max(120), unit: z.string().trim().min(1).max(20),
        rate: z.number().finite().min(0).max(1e7),
    })).max(60),
    availableMonths: z.array(z.string().regex(/^\d{4}-\d{2}$/)).max(24),
});
export type PutVendorProfileRequest = z.infer<typeof putVendorProfileRequestSchema>;

export const createPortfolioItemRequestSchema = z.object({
    title: z.string().trim().min(1).max(160),
    trade: tradeIdSchema,
    year: z.number().int().min(1950).max(2100).nullable(),
    district: z.string().trim().max(80).default(''),
    province: z.string().trim().max(60).default(''),
    photoFileIds: z.array(uuidSchema).max(10),
    note: z.string().trim().max(1000).default(''),
});
export type CreatePortfolioItemRequest = z.infer<typeof createPortfolioItemRequestSchema>;

/** GET /vendor/me → the vendor workspaces of the signed-in user (a user may run more than one crew). */
export const myVendorsDtoSchema = z.array(z.object({
    workspaceId: uuidSchema, teamName: z.string(), tier: vendorTierSchema,
    /** The caller's role in that crew workspace (hide actions it cannot do). */
    role: roleSchema,
}));
export type MyVendorsDto = z.infer<typeof myVendorsDtoSchema>;

// ── Vendor list (ทะเบียนทีมช่าง) of a buyer workspace ──

export const vendorListEntryDtoSchema = z.object({
    id: uuidSchema,
    displayName: z.string(),
    phone: z.string(),
    lineId: z.string(),
    trades: z.array(tradeIdSchema),
    province: z.string(),
    /** Visible only to the buyer workspace. */
    privateNote: z.string(),
    /** Linked once the crew signs up with this phone. */
    vendorWorkspaceId: uuidSchema.nullable(),
    hasAccount: z.boolean(),
    tier: vendorTierSchema.nullable(),
    profileComplete: z.boolean(),
    /** Last subcontract with this buyer (any status). */
    lastEngagedAt: isoDateTimeSchema.nullable(),
    /** Average score (1–5) this buyer gave, null when none. */
    ratingFromUs: z.number().nullable(),
    completedWithUs: z.number().int().nonnegative(),
    hidden: z.boolean(),
    createdAt: isoDateTimeSchema,
});
export type VendorListEntryDto = z.infer<typeof vendorListEntryDtoSchema>;

export const createVendorListEntryRequestSchema = z.object({
    displayName: z.string().trim().min(1).max(120),
    phone: phoneSchema,
    lineId: z.string().trim().max(60).default(''),
    trades: z.array(tradeIdSchema).max(14).default([]),
    province: z.string().trim().max(60).default(''),
    privateNote: z.string().trim().max(1000).default(''),
});
export type CreateVendorListEntryRequest = z.infer<typeof createVendorListEntryRequestSchema>;

export const updateVendorListEntryRequestSchema = createVendorListEntryRequestSchema.partial().extend({
    hidden: z.boolean().optional(),
});
export type UpdateVendorListEntryRequest = z.infer<typeof updateVendorListEntryRequestSchema>;

/** POST /workspaces/:ws/vendor-list/import — rows parsed from CSV/Excel on the client. */
export const importVendorListRequestSchema = z.object({
    rows: z.array(z.object({
        displayName: z.string().trim().min(1).max(120),
        phone: z.string().trim().min(1).max(30),
        trades: z.array(tradeIdSchema).max(14).default([]),
        province: z.string().trim().max(60).default(''),
        lineId: z.string().trim().max(60).default(''),
    })).min(1).max(1000),
});
export type ImportVendorListRequest = z.infer<typeof importVendorListRequestSchema>;

export const importVendorListResponseSchema = z.object({
    created: z.number().int().nonnegative(),
    /** Phone already in the list (row index). */
    duplicates: z.array(z.number().int()),
    /** Row index + reason (bad phone, …). */
    invalid: z.array(z.object({ row: z.number().int(), reason: z.string() })),
});
export type ImportVendorListResponse = z.infer<typeof importVendorListResponseSchema>;

/** Public card of a vendor shown to a buyer (from the profile; never the vendor's private data). */
export const vendorCardDtoSchema = z.object({
    workspaceId: uuidSchema,
    teamName: z.string(),
    trades: z.array(tradeIdSchema),
    provinces: z.array(z.string()),
    crewSkilled: z.number().int().nullable(),
    crewLabourers: z.number().int().nullable(),
    tier: vendorTierSchema,
    profileComplete: z.boolean(),
    portfolio: z.array(portfolioItemDtoSchema),
});
export type VendorCardDto = z.infer<typeof vendorCardDtoSchema>;
