// ─── Subcontracting contract: bids, leveling, negotiation, award, vendor inbox ───
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { fileDtoSchema } from '../files';
import { dateSchema, installmentSchema, installmentsSchema, moneySchema, signedMoneySchema, tradeIdSchema, vendorTierSchema } from './common';
import { invitationStatusSchema, packageStatusSchema } from './packages';

export const BID_STATUSES = ['draft', 'submitted', 'superseded', 'withdrawn', 'selected', 'not_selected'] as const;
export const bidStatusSchema = z.enum(BID_STATUSES);
export type BidStatus = z.infer<typeof bidStatusSchema>;

export const bidModeSchema = z.enum(['unit', 'lump']);
export type BidMode = z.infer<typeof bidModeSchema>;

export const bidLineInputSchema = z.object({
    idx: z.number().int().nonnegative(),
    /** Labour (or all-in when material is not split) price per unit; null = not priced yet (draft). */
    unitPrice: z.number().finite().min(0).max(1e9).nullable(),
    /** Material price per unit, only for lines where the vendor supplies material. */
    matUnitPrice: z.number().finite().min(0).max(1e9).nullable(),
    excluded: z.boolean(),
    reason: z.string().trim().max(300).default(''),
});
export type BidLineInput = z.infer<typeof bidLineInputSchema>;

const bidBody = {
    mode: bidModeSchema,
    lines: z.array(bidLineInputSchema).max(500),
    /** mode 'lump': the single amount. */
    lumpTotal: moneySchema.nullable(),
    /** Discount (negative) or extra (positive) on the whole bid. */
    adjustment: signedMoneySchema,
    adjustmentNote: z.string().trim().max(300).default(''),
    /** Lump bid: what is included / excluded (free text). */
    inclusions: z.string().trim().max(2000).default(''),
    days: z.number().int().min(1).max(3650).nullable(),
    earliestStart: dateSchema.nullable(),
    crewSkilled: z.number().int().min(0).max(10000).nullable(),
    crewLabourers: z.number().int().min(0).max(10000).nullable(),
    validUntil: dateSchema.nullable(),
    /** null = accepts the buyer's installments. */
    installmentsProposal: installmentsSchema.nullable(),
    /** One answer per package question (same order). */
    answers: z.array(z.string().trim().max(1000)).max(20),
    note: z.string().trim().max(2000).default(''),
    photoFileIds: z.array(uuidSchema).max(10),
};

/** PUT /vendor/invitations/:id/bid-draft (autosave; any field may be incomplete). */
export const saveBidDraftRequestSchema = z.object(bidBody).partial();
export type SaveBidDraftRequest = z.infer<typeof saveBidDraftRequestSchema>;

/** POST /vendor/invitations/:id/bid — submits a new version (the package version is the current one). */
export const submitBidRequestSchema = z.object(bidBody);
export type SubmitBidRequest = z.infer<typeof submitBidRequestSchema>;

/** POST /subcontracting/invitations/:id/manual-bid — the buyer types a price received by phone / paper. */
export const manualBidRequestSchema = submitBidRequestSchema;
export type ManualBidRequest = z.infer<typeof manualBidRequestSchema>;

export const bidLineDtoSchema = bidLineInputSchema.extend({ total: z.number() });

export const bidDtoSchema = z.object({
    id: uuidSchema,
    invitationId: uuidSchema,
    packageId: uuidSchema,
    packageVersion: z.number().int(),
    version: z.number().int(),
    status: bidStatusSchema,
    mode: bidModeSchema,
    lines: z.array(bidLineDtoSchema),
    lumpTotal: z.number().nullable(),
    adjustment: z.number(),
    adjustmentNote: z.string(),
    inclusions: z.string(),
    /** Σ line totals (or lump) + adjustment. */
    total: z.number(),
    days: z.number().int().nullable(),
    earliestStart: dateSchema.nullable(),
    crewSkilled: z.number().int().nullable(),
    crewLabourers: z.number().int().nullable(),
    validUntil: dateSchema.nullable(),
    installmentsProposal: z.array(installmentSchema).nullable(),
    answers: z.array(z.string()),
    note: z.string(),
    photos: z.array(fileDtoSchema),
    enteredByBuyer: z.boolean(),
    /** Submitted against an older package version (addendum since). */
    outdated: z.boolean(),
    submittedAt: isoDateTimeSchema.nullable(),
    updatedAt: isoDateTimeSchema,
});
export type BidDto = z.infer<typeof bidDtoSchema>;

/** GET /vendor/invitations/:id/bid → current draft (or null) + submitted history. */
export const myBidStateDtoSchema = z.object({
    draft: bidDtoSchema.nullable(),
    submitted: z.array(bidDtoSchema),
});
export type MyBidStateDto = z.infer<typeof myBidStateDtoSchema>;

// ── Leveling (buyer) ──

export const levelingFlagSchema = z.enum(['high', 'low', 'very_low']).nullable();

export const levelingCellSchema = z.object({
    bidId: uuidSchema,
    unitPrice: z.number().nullable(),
    total: z.number(),
    /** (total − estimate) / estimate; null when the estimate is 0. */
    diffPct: z.number().nullable(),
    excluded: z.boolean(),
    /** Filled from the estimate (excluded / not priced / spread from a lump sum) for the normalised total. */
    filled: z.boolean(),
    flag: levelingFlagSchema,
});

export const levelingBidderSchema = z.object({
    bidId: uuidSchema,
    invitationId: uuidSchema,
    displayName: z.string(),
    vendorWorkspaceId: uuidSchema.nullable(),
    tier: vendorTierSchema.nullable(),
    version: z.number().int(),
    mode: z.enum(['unit', 'lump']),
    total: z.number(),
    normalizedTotal: z.number(),
    diffPct: z.number().nullable(),
    flag: levelingFlagSchema,
    days: z.number().int().nullable(),
    earliestStart: dateSchema.nullable(),
    crewSkilled: z.number().int().nullable(),
    crewLabourers: z.number().int().nullable(),
    validUntil: dateSchema.nullable(),
    expired: z.boolean(),
    installmentsProposal: z.array(installmentSchema).nullable(),
    answers: z.array(z.string()),
    note: z.string(),
    enteredByBuyer: z.boolean(),
    outdated: z.boolean(),
    ratingFromUs: z.number().nullable(),
    completedWithUs: z.number().int(),
});

export const levelingDtoSchema = z.object({
    packageId: uuidSchema,
    version: z.number().int(),
    estimateTotal: z.number(),
    /** Fraction above which a difference is flagged (workspace setting, default 0.2). */
    threshold: z.number(),
    questions: z.array(z.string()),
    bidders: z.array(levelingBidderSchema),
    lines: z.array(z.object({
        idx: z.number().int(),
        desc: z.string(),
        unit: z.string(),
        qtyPriced: z.number(),
        estUnit: z.number(),
        estTotal: z.number(),
        /** One cell per bidder, same order as `bidders`. */
        cells: z.array(levelingCellSchema),
    })),
});
export type LevelingDto = z.infer<typeof levelingDtoSchema>;

/** POST /subcontracting/invitations/:id/messages (buyer) and POST /vendor/invitations/:id/messages (vendor). */
export const sendMessageRequestSchema = z.object({
    text: z.string().trim().min(1).max(2000),
    /** Buyer only: the price the buyer hopes for. */
    targetTotal: moneySchema.nullable().default(null),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

// ── Award ──

/** POST /subcontracting/packages/:id/award. Every allocated line goes to exactly one bid; lines left out stay open. */
export const awardRequestSchema = z.object({
    allocations: z.array(z.object({ idx: z.number().int().nonnegative(), bidId: uuidSchema })).min(1).max(500),
    /** Per winning bid: use the buyer's installments or the bid's proposal. */
    installmentsFrom: z.record(uuidSchema, z.enum(['package', 'bid'])).default({}),
    note: z.string().trim().max(1000).default(''),
});
export type AwardRequest = z.infer<typeof awardRequestSchema>;

export const awardResponseSchema = z.object({
    packageStatus: packageStatusSchema,
    subcontractIds: z.array(uuidSchema),
});
export type AwardResponse = z.infer<typeof awardResponseSchema>;

// ── Vendor inbox ──

export const inboxInvitationDtoSchema = z.object({
    invitationId: uuidSchema,
    packageId: uuidSchema,
    buyerName: z.string(),
    title: z.string(),
    trade: tradeIdSchema,
    province: z.string(),
    bidDeadline: isoDateTimeSchema,
    status: invitationStatusSchema,
    packageStatus: packageStatusSchema,
    hasDraft: z.boolean(),
    latestBidTotal: z.number().nullable(),
    outcome: z.enum(['pending', 'won', 'lost', 'cancelled']),
    unreadMessages: z.number().int(),
    receivedAt: isoDateTimeSchema,
});
export type InboxInvitationDto = z.infer<typeof inboxInvitationDtoSchema>;

/** GET /vendor/inbox?workspaceId=… */
export const vendorInboxDtoSchema = z.object({ invitations: z.array(inboxInvitationDtoSchema) });
export type VendorInboxDto = z.infer<typeof vendorInboxDtoSchema>;
