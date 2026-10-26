// ─── Shared API contract: AI assist (module `ai-assist`) ───
// Typed decisions from a decision model (Jev by TypeSafe AI: `choice` / `score` / `noul` answers, never free text).
// The model never computes BOQ numbers: it only flags rows for review and matches free text to catalogue items.
// Everything here is a proposal the user confirms; the pure BOQ engine stays the single source of numbers.
import { z } from 'zod';

// ─── BOQ review ───

/** Kinds of inconsistency the model is asked about (one `choice` per row). */
export const AI_FINDING_KINDS = ['unit', 'note', 'waste', 'price', 'qty'] as const;
export const aiFindingKindSchema = z.enum(AI_FINDING_KINDS);
export type AiFindingKind = z.infer<typeof aiFindingKindSchema>;

/** Short Thai label per kind, shown in the review list and used as the model's choice criteria. */
export const AI_FINDING_KIND_LABEL: Record<AiFindingKind, string> = {
    unit: 'หน่วยไม่สอดคล้องกับรายการ',
    note: 'หมายเหตุขัดกับปริมาณหรือราคา',
    waste: 'เปอร์เซ็นต์เผื่อเสียผิดปกติ',
    price: 'ราคาวัสดุหรือค่าแรงผิดปกติ',
    qty: 'ปริมาณไม่สมเหตุสมผล',
};

/** Rows at or above these probabilities are shown; below AI_REVIEW_MIN the server leaves them out. */
export const AI_REVIEW_MIN = 0.5;
export const AI_REVIEW_WARN = 0.7;
export const AI_REVIEW_ERROR = 0.9;

/** One computed BOQ item row as sent for review: engine output (E/H/G/I/K), never template rules. */
export const boqReviewRowSchema = z.object({
    /** BOQ line key, e.g. "R43" or a slot row key. */
    key: z.string().min(1).max(120),
    section: z.string().max(200),
    desc: z.string().max(300),
    unit: z.string().max(40),
    qty: z.number().finite(),
    grossQty: z.number().finite().nullable(),
    /** Waste as a percentage (10 = 10 %). */
    wastePct: z.number().finite(),
    matUnit: z.number().finite(),
    labUnit: z.number().finite(),
    note: z.string().max(500),
    /**
     * Values the engine derives from other rows (qty rules `line` / `sumLines` / `none`, price rules
     * `consumables` / `linePrice`). The model is told not to flag these as 0 or missing.
     */
    derived: z.object({ qty: z.boolean(), mat: z.boolean(), lab: z.boolean() }),
});
export type BoqReviewRow = z.infer<typeof boqReviewRowSchema>;

export const boqReviewProjectSchema = z.object({
    name: z.string().max(200).optional(),
    /** e.g. "บ้านพักอาศัย 2 ชั้น" */
    type: z.string().max(200).optional(),
    usableAreaSqm: z.number().positive().optional(),
    floors: z.number().int().positive().optional(),
});
export type BoqReviewProject = z.infer<typeof boqReviewProjectSchema>;

/** POST /workspaces/:workspaceId/ai/boq-review */
export const boqReviewRequestSchema = z.object({
    project: boqReviewProjectSchema,
    rows: z.array(boqReviewRowSchema).min(1).max(400),
});
export type BoqReviewRequest = z.infer<typeof boqReviewRequestSchema>;

export const aiFindingSchema = z.object({
    key: z.string(),
    kind: aiFindingKindSchema,
    /** `noul` probability (0–1) that the row is inconsistent. */
    probability: z.number().min(0).max(1),
    /** Confidence (0–1) of the `kind` choice. */
    kindConfidence: z.number().min(0).max(1),
});
export type AiFinding = z.infer<typeof aiFindingSchema>;

export const boqReviewResponseSchema = z.object({
    /** Model version that answered, e.g. "jev-1.14.0". */
    model: z.string(),
    /** Only rows with probability ≥ AI_REVIEW_MIN, most probable first. */
    findings: z.array(aiFindingSchema),
    usage: z.object({ inputTokens: z.number().int().nonnegative(), costUsd: z.number().nonnegative() }).optional(),
});
export type BoqReviewResponse = z.infer<typeof boqReviewResponseSchema>;

// ─── Pick-list item matching ───

/** Below SUGGEST nothing is shown; SUGGEST..AUTO asks "หมายถึง X ใช่ไหม"; ≥ AUTO is offered as the obvious match. */
export const ITEM_MATCH_SUGGEST = 0.6;
export const ITEM_MATCH_AUTO = 0.9;

/** POST /workspaces/:workspaceId/ai/match-items */
export const matchItemsRequestSchema = z.object({
    /** Catalogue item texts (the dropdown options), at most 255 (the model's `choice` limit). */
    catalogue: z.array(z.string().min(1).max(200)).min(1).max(255),
    /** Free text the user typed, one question each. */
    inputs: z.array(z.string().min(1).max(300)).min(1).max(50),
});
export type MatchItemsRequest = z.infer<typeof matchItemsRequestSchema>;

export const itemMatchSchema = z.object({
    input: z.string(),
    /** The catalogue text that means the same thing; null = nothing in the catalogue matches. */
    item: z.string().nullable(),
    confidence: z.number().min(0).max(1),
});
export type ItemMatch = z.infer<typeof itemMatchSchema>;

export const matchItemsResponseSchema = z.object({
    model: z.string(),
    /** Same order as `inputs`. */
    matches: z.array(itemMatchSchema),
});
export type MatchItemsResponse = z.infer<typeof matchItemsResponseSchema>;

// ─── Unified review finding (web app) ───

/** One line of the "ตรวจ BOQ ก่อนส่ง" list: from a deterministic rule (`rule`) or from the model (`ai`). */
export const boqReviewFindingSchema = z.object({
    key: z.string(),
    source: z.enum(['rule', 'ai']),
    severity: z.enum(['warn', 'error']),
    /** Rule id (e.g. "price-zero", "waste-high") or an AiFindingKind. */
    kind: z.string(),
    /** Short professional Thai: "คอนกรีตโครงสร้าง — เผื่อเสีย 90% สูงผิดปกติ". */
    message: z.string(),
    /** Model probability when source = ai. */
    probability: z.number().min(0).max(1).optional(),
});
export type BoqReviewFinding = z.infer<typeof boqReviewFindingSchema>;
