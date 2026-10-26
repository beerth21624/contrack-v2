// ─── Subcontracting (module 1) contract: shared vocabulary ───
// Plan: docs/marketplace/01-module1-subcontracting-plan.md. Every route of this module is gated by the
// `subcontracting` module flag (404 module_disabled when off).
import { z } from 'zod';

/** Trades (ประเภทงานช่าง) grouped from the BOQ sections; mapping in src/domain/subcontracting/trades.ts. */
export const TRADE_IDS = [
    'site-prep', 'temp-utilities', 'piling', 'structure', 'roof-structure', 'roofing', 'masonry',
    'electrical', 'plumbing', 'ceiling', 'tiling', 'painting', 'doors-windows', 'misc',
] as const;
export const tradeIdSchema = z.enum(TRADE_IDS);
export type TradeId = z.infer<typeof tradeIdSchema>;

/** Thai provinces are free text for now (validated by the UI list); max length guards the database. */
export const provinceSchema = z.string().trim().min(1).max(60);

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const moneySchema = z.number().finite().min(0).max(1e11);
/** Signed amount (adjustments, variations). */
export const signedMoneySchema = z.number().finite().min(-1e11).max(1e11);
export const qtySchema = z.number().finite().min(0).max(1e9);
/** 0–1 fraction (0.05 = 5 %). */
export const fractionSchema = z.number().finite().min(0).max(1);

export const SUPPLY_MODES = ['labour_only', 'with_materials', 'per_line'] as const;
export const supplyModeSchema = z.enum(SUPPLY_MODES);
export type SupplyMode = z.infer<typeof supplyModeSchema>;

export const PRICING_MODES = ['unit', 'lump', 'vendor_choice'] as const;
export const pricingModeSchema = z.enum(PRICING_MODES);
export type PricingMode = z.infer<typeof pricingModeSchema>;

export const SOURCING_MODES = ['direct', 'rfq', 'open'] as const;
/** `open` (public board) is reserved for phase 2: the API refuses it with 422 for now. */
export const sourcingModeSchema = z.enum(SOURCING_MODES);
export type SourcingMode = z.infer<typeof sourcingModeSchema>;

export const materialBySchema = z.enum(['buyer', 'vendor']);
export type MaterialBy = z.infer<typeof materialBySchema>;

/** Labour on net qty (BOQ L = K×E) or on gross qty (pipe / cable / frame rows: L = K×H). */
export const labourBasisSchema = z.enum(['net', 'gross']);
export type LabourBasis = z.infer<typeof labourBasisSchema>;

export const VENDOR_TIERS = ['L0', 'L1', 'L2', 'L3'] as const;
export const vendorTierSchema = z.enum(VENDOR_TIERS);
export type VendorTier = z.infer<typeof vendorTierSchema>;

export const INVITE_CHANNELS = ['link', 'sms', 'line'] as const;
export const inviteChannelSchema = z.enum(INVITE_CHANNELS);
export type InviteChannel = z.infer<typeof inviteChannelSchema>;

export const providerSchema = z.enum(['buyer', 'vendor', 'none']);
export type Provider = z.infer<typeof providerSchema>;

export const penaltySchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }),
    /** Baht per day late. */
    z.object({ kind: z.literal('per_day'), amount: moneySchema }),
    /** Fraction of the contract value per day late (0.001 = 0.1 %/day). */
    z.object({ kind: z.literal('pct_per_day'), rate: fractionSchema }),
]);
export type Penalty = z.infer<typeof penaltySchema>;

export const packageTermsSchema = z.object({
    retentionPct: z.number().finite().min(0).max(0.3),
    warrantyMonths: z.number().int().min(0).max(120),
    penalty: penaltySchema,
    /** Who provides site water, power, lodging and scaffolding. */
    provisions: z.object({
        water: providerSchema,
        power: providerSchema,
        lodging: providerSchema,
        scaffolding: providerSchema,
    }),
    safetyNote: z.string().max(2000).default(''),
    /** Trade-specific questions the bidder answers (one answer per question, same order). */
    questions: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
});
export type PackageTerms = z.infer<typeof packageTermsSchema>;

export const scheduleSchema = z.object({
    start: dateSchema.nullable(),
    finish: dateSchema.nullable(),
    days: z.number().int().min(0).max(3650).nullable(),
});
export type ScheduleDto = z.infer<typeof scheduleSchema>;

/** One payment stage (งวด) as proposed / agreed: pct of the contract value and what must be done to claim it. */
export const installmentSchema = z.object({
    no: z.number().int().min(1).max(60),
    pct: fractionSchema,
    condition: z.string().trim().min(1).max(300),
});
export type InstallmentDto = z.infer<typeof installmentSchema>;

/** Σ pct must be 1 (± 0.0001); numbers 1..n in order. */
export const installmentsSchema = z.array(installmentSchema).min(1).max(60).superRefine((list, ctx) => {
    const sum = list.reduce((s, i) => s + i.pct, 0);
    if (Math.abs(sum - 1) > 0.0001) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'งวดต้องรวมได้ 100%' });
    list.forEach((i, k) => {
        if (i.no !== k + 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k, 'no'], message: 'เลขงวดต้องเรียง 1..n' });
    });
});

export const locationSchema = z.object({
    district: z.string().trim().max(80).default(''),
    province: z.string().trim().max(60).default(''),
    /** Full address: shown to the vendor only after award when the package hides the owner identity. */
    address: z.string().trim().max(400).default(''),
});
export type LocationDto = z.infer<typeof locationSchema>;
