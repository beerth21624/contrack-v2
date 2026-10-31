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
