// ─── Shared API contract: the workspace rate-card library (คลังอัตราค่าแรงของบริษัท) ───
// A rate card is a named pair of daily wages (skilled ฿/day, labourer ฿/day) that every project of the workspace can
// pick from in Man-Day. Rates are whole baht per day (integers): Excel's sets are whole numbers (A 800/500,
// B 1,000/600) and Thai daily wages are quoted in whole baht.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';

export const RATE_CARD_NAME_MAX = 60;
export const RATE_CARD_NOTE_MAX = 500;
/** Highest accepted daily rate (baht per day). */
export const RATE_CARD_RATE_MAX = 100_000;
/** Most active (not archived) rate cards a workspace may keep. */
export const MAX_ACTIVE_RATE_CARDS = 50;

/** Trimmed, 1–60 characters; unique (case-insensitive) among the workspace's active cards. */
export const rateCardNameSchema = z.string().trim().min(1).max(RATE_CARD_NAME_MAX);
/** Whole baht per day, 0–100,000. */
export const dailyRateSchema = z.number().int().min(0).max(RATE_CARD_RATE_MAX);
/** Trimmed; an empty note is stored as null. */
export const rateCardNoteSchema = z.string().trim().max(RATE_CARD_NOTE_MAX);

export const rateCardDtoSchema = z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    name: z.string(),
    /** ค่าแรงช่าง: baht per day. */
    skilledRate: z.number().int().nonnegative(),
    /** ค่าแรงคนงาน: baht per day. */
    labourerRate: z.number().int().nonnegative(),
    note: z.string().nullable(),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    /** Always null in the list (archived cards are not listed); kept for symmetry with projects. */
    archivedAt: isoDateTimeSchema.nullable(),
});
export type RateCardDto = z.infer<typeof rateCardDtoSchema>;

export const createRateCardRequestSchema = z.object({
    name: rateCardNameSchema,
    skilledRate: dailyRateSchema,
    labourerRate: dailyRateSchema,
    /** Omitted, null or blank = no note. */
    note: rateCardNoteSchema.nullish(),
});
export type CreateRateCardRequest = z.infer<typeof createRateCardRequestSchema>;

export const updateRateCardRequestSchema = z.object({
    name: rateCardNameSchema.optional(),
    skilledRate: dailyRateSchema.optional(),
    labourerRate: dailyRateSchema.optional(),
    /** null or blank clears the note; omitted keeps it. */
    note: rateCardNoteSchema.nullable().optional(),
}).refine(
    v => v.name !== undefined || v.skilledRate !== undefined || v.labourerRate !== undefined || v.note !== undefined,
    { message: 'nothing to update' },
);
export type UpdateRateCardRequest = z.infer<typeof updateRateCardRequestSchema>;

/**
 * `details` of a 409 `conflict` from create / update: the name is already used by another active card, or the
 * workspace already keeps MAX_ACTIVE_RATE_CARDS active cards.
 */
export const rateCardConflictDetailsSchema = z.discriminatedUnion('reason', [
    z.object({ reason: z.literal('name_taken'), name: z.string() }),
    z.object({ reason: z.literal('limit_reached'), limit: z.number().int().positive() }),
]);
export type RateCardConflictDetails = z.infer<typeof rateCardConflictDetailsSchema>;
