// ─── Subcontracting contract: work packages, invitations, questions, guest view ───
// Buyer DTOs (Buyer*) may carry estimates from the BOQ; vendor/guest DTOs NEVER do (separate schemas on purpose:
// a field that is not in the vendor schema cannot leak).
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { fileDtoSchema } from '../files';
import {
    dateSchema, installmentSchema, installmentsSchema, inviteChannelSchema, labourBasisSchema, locationSchema,
    materialBySchema, packageTermsSchema, pricingModeSchema, qtySchema, scheduleSchema, sourcingModeSchema,
    supplyModeSchema, tradeIdSchema, vendorTierSchema,
} from './common';

export const PACKAGE_STATUSES = ['draft', 'open', 'reviewing', 'awarded', 'closed', 'cancelled', 'expired'] as const;
export const packageStatusSchema = z.enum(PACKAGE_STATUSES);
export type PackageStatus = z.infer<typeof packageStatusSchema>;

export const INVITATION_STATUSES = ['sent', 'viewed', 'declined', 'submitted', 'withdrawn', 'won', 'lost', 'closed'] as const;
export const invitationStatusSchema = z.enum(INVITATION_STATUSES);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export const DECLINE_REASONS = ['busy', 'too_far', 'not_my_trade', 'price_too_low', 'other'] as const;
export const declineReasonSchema = z.enum(DECLINE_REASONS);
export type DeclineReason = z.infer<typeof declineReasonSchema>;

// ── Lines (snapshot of BOQ rows at send time) ──

/** What a vendor sees of one line. `idx` is the stable position inside the package version (0-based). */
export const packageLineDtoSchema = z.object({
    idx: z.number().int().nonnegative(),
    /** BOQ (Home) section 0–31; null for a typed (custom) line. */
    section: z.number().int().nullable(),
    sectionTitle: z.string(),
    desc: z.string(),
    unit: z.string(),
    /** Net quantity (BOQ E). */
    qtyNet: z.number(),
    /** Gross quantity incl. waste (BOQ H); null when the row has none. */
    qtyGross: z.number().nullable(),
    /** Quantity the price is multiplied by (qtyNet, or qtyGross for gross-basis rows). */
    qtyPriced: z.number(),
    /** Quantity a material unit price is multiplied by (BOQ H, or E for net-basis rows); used when the vendor supplies material. */
    qtyMaterial: z.number(),
    labourBasis: labourBasisSchema,
    materialBy: materialBySchema,
});
export type PackageLineDto = z.infer<typeof packageLineDtoSchema>;

/** Buyer view of a line: + BOQ key and the estimate (unit prices from BOQ I/K). */
export const buyerPackageLineDtoSchema = packageLineDtoSchema.extend({
    lineKey: z.string().nullable(),
    estLabUnit: z.number(),
    estMatUnit: z.number(),
    /** estLabUnit × qtyPriced (+ estMatUnit × gross qty when the vendor supplies material). */
    estTotal: z.number(),
});
export type BuyerPackageLineDto = z.infer<typeof buyerPackageLineDtoSchema>;

export const customLineInputSchema = z.object({
    desc: z.string().trim().min(1).max(300),
    unit: z.string().trim().min(1).max(20),
    qty: qtySchema,
    /** Optional estimate for the comparison column. */
    estUnit: z.number().finite().min(0).max(1e9).default(0),
});
export type CustomLineInput = z.infer<typeof customLineInputSchema>;

// ── Package (buyer) ──

const packageEditableFields = {
    title: z.string().trim().min(1).max(160),
    trade: tradeIdSchema,
    /** BOQ line keys from computeProject().boq (item rows only). */
    lineKeys: z.array(z.string().min(1).max(160)).max(400),
    customLines: z.array(customLineInputSchema).max(100),
    supplyMode: supplyModeSchema,
    /** Only for supplyMode 'per_line': who supplies material, by BOQ line key (missing = buyer). */
    materialByLine: z.record(z.string(), materialBySchema),
    pricingMode: pricingModeSchema,
    sourcingMode: sourcingModeSchema,
    terms: packageTermsSchema,
    schedule: scheduleSchema,
    installments: installmentsSchema,
    location: locationSchema,
    hideOwnerIdentity: z.boolean(),
    bidDeadline: isoDateTimeSchema,
    priceValidUntil: dateSchema,
    /** Free text shown to vendors above the lines. */
    description: z.string().trim().max(4000),
};

/** POST /projects/:projectId/subcontracting/packages → BuyerPackageDto (status draft). */
export const createPackageRequestSchema = z.object(packageEditableFields).refine(
    p => p.lineKeys.length + p.customLines.length > 0, { message: 'เลือกงานอย่างน้อย 1 รายการ' },
);
export type CreatePackageRequest = z.infer<typeof createPackageRequestSchema>;

/** PATCH /subcontracting/packages/:id — any field while draft; after send only bidDeadline (later), description. */
export const updatePackageRequestSchema = z.object(packageEditableFields).partial();
export type UpdatePackageRequest = z.infer<typeof updatePackageRequestSchema>;

/** POST /subcontracting/packages/:id/addendum — new version of the lines (sent packages). */
export const addendumRequestSchema = z.object({
    lineKeys: z.array(z.string().min(1).max(160)).max(400),
    customLines: z.array(customLineInputSchema).max(100),
    materialByLine: z.record(z.string(), materialBySchema).default({}),
    note: z.string().trim().min(1).max(1000),
});
export type AddendumRequest = z.infer<typeof addendumRequestSchema>;

export const extendDeadlineRequestSchema = z.object({ bidDeadline: isoDateTimeSchema });
export type ExtendDeadlineRequest = z.infer<typeof extendDeadlineRequestSchema>;

export const cancelRequestSchema = z.object({ reason: z.string().trim().min(1).max(500) });
export type CancelRequest = z.infer<typeof cancelRequestSchema>;

/** One line whose BOQ quantity changed since the package version was taken. */
export const lineDriftSchema = z.object({ idx: z.number().int(), desc: z.string(), was: z.number(), now: z.number() });

export const invitationCountsSchema = z.object({
    total: z.number().int(), viewed: z.number().int(), submitted: z.number().int(), declined: z.number().int(),
});

export const packageSummaryDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    /** The buyer workspace that owns the package (role, settings and vendor list come from it, not from the UI's current workspace). */
    buyerWorkspaceId: uuidSchema,
    title: z.string(),
    trade: tradeIdSchema,
    status: packageStatusSchema,
    version: z.number().int(),
    sourcingMode: sourcingModeSchema,
    bidDeadline: isoDateTimeSchema,
    estimateTotal: z.number(),
    /** Lowest normalised bid total (null before any bid). */
    bestBidTotal: z.number().nullable(),
    invitations: invitationCountsSchema,
    createdAt: isoDateTimeSchema,
    sentAt: isoDateTimeSchema.nullable(),
});
export type PackageSummaryDto = z.infer<typeof packageSummaryDtoSchema>;

export const buyerPackageDtoSchema = z.object({
    ...packageSummaryDtoSchema.shape,
    projectName: z.string(),
    description: z.string(),
    supplyMode: supplyModeSchema,
    pricingMode: pricingModeSchema,
    terms: packageTermsSchema,
    schedule: scheduleSchema,
    installments: z.array(installmentSchema),
    location: locationSchema,
    hideOwnerIdentity: z.boolean(),
    priceValidUntil: dateSchema,
    lines: z.array(buyerPackageLineDtoSchema),
    files: z.array(fileDtoSchema),
    /** BOQ rows of this package whose quantity changed since the current version (empty = up to date). */
    boqDrift: z.array(lineDriftSchema),
    versions: z.array(z.object({ version: z.number().int(), note: z.string(), createdAt: isoDateTimeSchema })),
    createdBy: uuidSchema,
    awardedAt: isoDateTimeSchema.nullable(),
    cancelledAt: isoDateTimeSchema.nullable(),
    cancelReason: z.string().nullable(),
});
export type BuyerPackageDto = z.infer<typeof buyerPackageDtoSchema>;

// ── Invitations ──

export const scInvitationDtoSchema = z.object({
    id: uuidSchema,
    packageId: uuidSchema,
    vendorListEntryId: uuidSchema,
    displayName: z.string(),
    phone: z.string(),
    vendorWorkspaceId: uuidSchema.nullable(),
    tier: vendorTierSchema.nullable(),
    channel: inviteChannelSchema,
    status: invitationStatusSchema,
    sentAt: isoDateTimeSchema,
    viewedAt: isoDateTimeSchema.nullable(),
    declinedAt: isoDateTimeSchema.nullable(),
    declineReason: declineReasonSchema.nullable(),
    declineNote: z.string().nullable(),
    /** Latest submitted bid. */
    latestBid: z.object({
        id: uuidSchema, version: z.number().int(), total: z.number(), submittedAt: isoDateTimeSchema,
        enteredByBuyer: z.boolean(), outdated: z.boolean(),
    }).nullable(),
    resentCount: z.number().int(),
});
export type ScInvitationDto = z.infer<typeof scInvitationDtoSchema>;

/** POST /subcontracting/packages/:id/invitations — also sends a draft package (status → open). */
export const createInvitationsRequestSchema = z.object({
    entries: z.array(z.object({ vendorListEntryId: uuidSchema, channel: inviteChannelSchema })).min(1).max(20),
});
export type CreateInvitationsRequest = z.infer<typeof createInvitationsRequestSchema>;

/** The raw link is returned once (to copy and send by hand); only a hash of its token is stored. */
export const invitationLinkSchema = z.object({ invitationId: uuidSchema, url: z.string() });
export const createInvitationsResponseSchema = z.object({
    invitations: z.array(scInvitationDtoSchema),
    links: z.array(invitationLinkSchema),
});
export type CreateInvitationsResponse = z.infer<typeof createInvitationsResponseSchema>;

/** POST /subcontracting/invitations/:id/resend → a fresh link (old one keeps working until it expires). */
export const resendInvitationResponseSchema = z.object({ invitation: scInvitationDtoSchema, link: invitationLinkSchema });
export type ResendInvitationResponse = z.infer<typeof resendInvitationResponseSchema>;

// ── Questions (Q&A, answers visible to every invitee without the asker's name) ──

export const questionDtoSchema = z.object({
    id: uuidSchema,
    question: z.string(),
    answer: z.string().nullable(),
    askedAt: isoDateTimeSchema,
    answeredAt: isoDateTimeSchema.nullable(),
    /** Buyer view only: who asked. Vendor view: true when the caller asked it. */
    askedBy: z.string().nullable(),
    mine: z.boolean(),
});
export type QuestionDto = z.infer<typeof questionDtoSchema>;

export const askQuestionRequestSchema = z.object({ question: z.string().trim().min(1).max(1000) });
export type AskQuestionRequest = z.infer<typeof askQuestionRequestSchema>;

export const answerQuestionRequestSchema = z.object({ answer: z.string().trim().min(1).max(2000) });
export type AnswerQuestionRequest = z.infer<typeof answerQuestionRequestSchema>;

// ── Negotiation messages (buyer ↔ one invitee) ──

export const negotiationMessageDtoSchema = z.object({
    id: uuidSchema,
    from: z.enum(['buyer', 'vendor']),
    text: z.string(),
    targetTotal: z.number().nullable(),
    at: isoDateTimeSchema,
});
export type NegotiationMessageDto = z.infer<typeof negotiationMessageDtoSchema>;

// ── Guest / vendor view of a package (GET /s/:token, public; GET /vendor/invitations/:id, signed in) ──

export const guestPackageDtoSchema = z.object({
    invitationId: uuidSchema,
    invitationStatus: invitationStatusSchema,
    packageStatus: packageStatusSchema,
    buyerName: z.string(),
    /** Hidden ('') until award when the buyer chose to hide the owner identity. */
    projectName: z.string(),
    title: z.string(),
    trade: tradeIdSchema,
    description: z.string(),
    location: locationSchema,
    schedule: scheduleSchema,
    supplyMode: supplyModeSchema,
    pricingMode: pricingModeSchema,
    terms: packageTermsSchema,
    installments: z.array(installmentSchema),
    bidDeadline: isoDateTimeSchema,
    priceValidUntil: dateSchema,
    version: z.number().int(),
    lines: z.array(packageLineDtoSchema),
    /** Lines changed by the latest addendum (empty when version 1). */
    addendumNote: z.string().nullable(),
    changedLineIdx: z.array(z.number().int()),
    files: z.array(fileDtoSchema),
    questions: z.array(questionDtoSchema),
    /** The invitation is linked to a vendor account (sign in to bid) or not yet (sign up with OTP). */
    linkedToVendor: z.boolean(),
    /** Phone the buyer invited (masked except last 4 digits) — prefill for OTP. */
    invitedPhoneMasked: z.string(),
    /** What the buyer calls the invitee in its vendor list — prefill for the team name at sign-up. */
    invitedDisplayName: z.string(),
    /** Outcome after the decision. */
    outcome: z.enum(['pending', 'won', 'lost', 'cancelled']),
});
export type GuestPackageDto = z.infer<typeof guestPackageDtoSchema>;

export const declineRequestSchema = z.object({ reason: declineReasonSchema, note: z.string().trim().max(500).default('') });
export type DeclineRequest = z.infer<typeof declineRequestSchema>;
