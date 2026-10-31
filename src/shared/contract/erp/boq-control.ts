// ─── BOQ control: versions of the BOQ and their comparison (docs/erp/02-domain-model.md §1.10, WP-17) ───
// Shapes mirror src/domain/boq-control (version-lines.ts, diff.ts).
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';

export const BOQ_VERSION_KINDS = ['snapshot', 'baseline'] as const;
export const boqVersionKindSchema = z.enum(BOQ_VERSION_KINDS);
export type BoqVersionKind = z.infer<typeof boqVersionKindSchema>;

export const BOQ_LINE_CHANGES = ['added', 'removed', 'changed', 'same'] as const;
export const boqLineChangeSchema = z.enum(BOQ_LINE_CHANGES);
export type BoqLineChangeKind = z.infer<typeof boqLineChangeSchema>;

const basisSchema = z.enum(['gross', 'net']);

export const boqVersionLineDtoSchema = z.object({
    lineKey: z.string(),
    sectionNo: z.number().int(),
    sort: z.number().int(),
    itemNo: z.string(),
    descTh: z.string(),
    unit: z.string(),
    qty: z.number(),
    grossQty: z.number().nullable(),
    waste: z.number(),
    matUnit: z.number(),
    labUnit: z.number(),
    matTotal: z.number(),
    labTotal: z.number(),
    total: z.number(),
    materialBasis: basisSchema,
    labourBasis: basisSchema,
});
export type BoqVersionLineDto = z.infer<typeof boqVersionLineDtoSchema>;

export const boqVersionSectionDtoSchema = z.object({
    sectionNo: z.number().int(),
    titleTh: z.string(),
    inConstructionTotal: z.boolean(),
    matTotal: z.number(),
    labTotal: z.number(),
    total: z.number(),
});
export type BoqVersionSectionDto = z.infer<typeof boqVersionSectionDtoSchema>;

export const boqVersionDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    revisionId: uuidSchema,
    /** Label / note of the revision the version was made from. */
    label: z.string(),
    note: z.string().nullable(),
    versionNo: z.number().int(),
    kind: boqVersionKindSchema,
    engineVersion: z.string(),
    constructionTotal: z.number(),
    preConstructionTotal: z.number(),
    matTotal: z.number(),
    labTotal: z.number(),
    lineCount: z.number().int(),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
});
export type BoqVersionDto = z.infer<typeof boqVersionDtoSchema>;
/** Newest first. */
export const boqVersionListDtoSchema = z.array(boqVersionDtoSchema);

export const boqVersionDetailDtoSchema = z.object({
    version: boqVersionDtoSchema,
    sections: z.array(boqVersionSectionDtoSchema),
    lines: z.array(boqVersionLineDtoSchema),
});
export type BoqVersionDetailDto = z.infer<typeof boqVersionDetailDtoSchema>;

/** `to` = a version id or `live` (the project's current documents, computed and not stored). */
export const boqVersionCompareQuerySchema = z.object({
    from: uuidSchema,
    to: z.union([z.literal('live'), uuidSchema]),
});
export type BoqVersionCompareQuery = z.infer<typeof boqVersionCompareQuerySchema>;

const boqTotalsSchema = z.object({
    constructionTotal: z.number(),
    preConstructionTotal: z.number(),
    matTotal: z.number(),
    labTotal: z.number(),
});

export const boqVersionCompareDtoSchema = z.object({
    from: boqVersionDtoSchema,
    /** null when comparing with the live BOQ. */
    to: boqVersionDtoSchema.nullable(),
    sections: z.array(z.object({
        no: z.number().int(),
        titleTh: z.string(),
        inConstructionTotal: z.boolean(),
        before: z.number(),
        after: z.number(),
        delta: z.number(),
    })),
    lines: z.array(z.object({
        lineKey: z.string(),
        sectionNo: z.number().int(),
        sort: z.number().int(),
        change: boqLineChangeSchema,
        before: boqVersionLineDtoSchema.optional(),
        after: boqVersionLineDtoSchema.optional(),
        deltaQty: z.number(),
        deltaTotal: z.number(),
    })),
    totals: z.object({ before: boqTotalsSchema, after: boqTotalsSchema, delta: boqTotalsSchema }),
    counts: z.object({ added: z.number().int(), removed: z.number().int(), changed: z.number().int(), same: z.number().int() }),
});
export type BoqVersionCompareDto = z.infer<typeof boqVersionCompareDtoSchema>;

// ─── Baseline + cost codes (WP-18, docs/erp/02-domain-model.md §1.10) ───

export const BASELINE_STATUSES = ['active', 'unlocked'] as const;
export const baselineStatusSchema = z.enum(BASELINE_STATUSES);
export type BaselineStatus = z.infer<typeof baselineStatusSchema>;

export const BASELINE_REASONS = ['contract_signed', 'manual'] as const;
export const baselineReasonSchema = z.enum(BASELINE_REASONS);
export type BaselineReason = z.infer<typeof baselineReasonSchema>;

export const COST_CODE_SOURCES = ['baseline', 'variation', 'manual'] as const;
export const costCodeSourceSchema = z.enum(COST_CODE_SOURCES);
export type CostCodeSource = z.infer<typeof costCodeSourceSchema>;

export const COST_CODE_STATUSES = ['active', 'omitted'] as const;
export const costCodeStatusSchema = z.enum(COST_CODE_STATUSES);
export type CostCodeStatus = z.infer<typeof costCodeStatusSchema>;

export const baselineDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    versionId: uuidSchema,
    versionNo: z.number().int(),
    /** Label of the revision the locked version was made from (e.g. `BASELINE-1`). */
    label: z.string(),
    status: baselineStatusSchema,
    reason: baselineReasonSchema,
    contractId: uuidSchema.nullable(),
    lockedBy: uuidSchema,
    lockedAt: isoDateTimeSchema,
    unlockedBy: uuidSchema.nullable(),
    unlockedAt: isoDateTimeSchema.nullable(),
    unlockReason: z.string(),
});
export type BaselineDto = z.infer<typeof baselineDtoSchema>;

/** Why unlocking is refused (signed contract, claims, accepted VOs, ledger entries), e.g. `{reason:'contract_signed', count:1}`. */
export const baselineUnlockBlockerSchema = z.object({ reason: z.string(), count: z.number().int() });
export type BaselineUnlockBlocker = z.infer<typeof baselineUnlockBlockerSchema>;

/** GET /projects/:projectId/baseline (also the answer of lock / unlock). */
export const baselineStatusDtoSchema = z.object({
    locked: z.boolean(),
    /** The active baseline; null when the BOQ is not locked. */
    baseline: baselineDtoSchema.nullable(),
    /** Every baseline of the project, newest first (the active one included). */
    history: z.array(baselineDtoSchema),
    /** Active cost codes of the project. */
    costCodeCount: z.number().int(),
    /** Empty = unlocking is allowed (when locked). */
    unlockBlockers: z.array(baselineUnlockBlockerSchema),
});
export type BaselineStatusDto = z.infer<typeof baselineStatusDtoSchema>;

/** POST /projects/:projectId/baseline — no versionId = a new revision `BASELINE-<n>` of the current BOQ is made. */
export const lockBaselineRequestSchema = z.object({
    versionId: uuidSchema.optional(),
    /** `contract_signed` locks are made by the contract module (WP-26), never over HTTP. */
    reason: z.literal('manual').default('manual'),
});
export type LockBaselineRequest = z.infer<typeof lockBaselineRequestSchema>;

export const unlockBaselineRequestSchema = z.object({
    reason: z.string().trim().min(1).max(500),
});
export type UnlockBaselineRequest = z.infer<typeof unlockBaselineRequestSchema>;

/** One cost code; cost fields are null for a caller without `cost.read`. */
export const costCodeDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    code: z.string(),
    source: costCodeSourceSchema,
    sourceRef: uuidSchema.nullable(),
    sectionNo: z.number().int(),
    lineKey: z.string().nullable(),
    descTh: z.string(),
    descEn: z.string(),
    unit: z.string(),
    sort: z.number().int(),
    baselineQty: z.number(),
    voQty: z.number(),
    baselineMatUnit: z.number().nullable(),
    baselineLabUnit: z.number().nullable(),
    baselineMat: z.number().nullable(),
    baselineLab: z.number().nullable(),
    baselineTotal: z.number().nullable(),
    voCost: z.number().nullable(),
    budgetTotal: z.number().nullable(),
    contractAmount: z.number(),
    voContractAmount: z.number(),
    reportedProgress: z.number(),
    certifiedProgress: z.number(),
    status: costCodeStatusSchema,
    updatedAt: isoDateTimeSchema,
});
export type CostCodeDto = z.infer<typeof costCodeDtoSchema>;
/** Baseline codes first, then VO, then manual; each in BOQ order. */
export const costCodeListDtoSchema = z.array(costCodeDtoSchema);
