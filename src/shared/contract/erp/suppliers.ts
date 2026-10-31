// ─── Supplier register (module `procurement`, WP-37, docs/erp/02-domain-model.md §7.1) ───
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { tradeIdSchema } from '../subcontracting/common';
import { docLanguageSchema } from './common';
import { bankAccountSchema } from './company';

export const SUPPLIER_KINDS = ['material', 'subcontractor', 'service', 'equipment_rental', 'other'] as const;
export const supplierKindSchema = z.enum(SUPPLIER_KINDS);
export type SupplierKind = z.infer<typeof supplierKindSchema>;

/** Keys of `WHT_PRESETS` (src/domain/money/tax.ts); the rate is looked up there. */
export const SUPPLIER_WHT_PRESETS = ['none', 'government', 'transport', 'advertising', 'service', 'rent'] as const;
export const supplierWhtPresetSchema = z.enum(SUPPLIER_WHT_PRESETS);
export type SupplierWhtPreset = z.infer<typeof supplierWhtPresetSchema>;

/** Rate of each preset (same values as `WHT_PRESETS`; the contract does not import src/domain). */
export const SUPPLIER_WHT_PRESET_RATE: Record<SupplierWhtPreset, number> = {
    none: 0, government: 0.01, transport: 0.01, advertising: 0.02, service: 0.03, rent: 0.05,
};

const text = (max: number) => z.string().trim().max(max);

export const SUPPLIER_BANK_ACCOUNTS_MAX = 5;

const supplierFields = {
    kind: supplierKindSchema,
    nameTh: text(200),
    nameEn: text(200),
    taxId: text(20),
    branchCode: text(10),
    isJuristic: z.boolean(),
    vatRegistered: z.boolean(),
    addressTh: text(500),
    addressEn: text(500),
    contactName: text(120),
    phone: text(40),
    email: text(200),
    lineId: text(80),
    creditTermDays: z.number().int().min(0).max(365),
    defaultWhtPreset: supplierWhtPresetSchema,
    bankAccounts: z.array(bankAccountSchema).max(SUPPLIER_BANK_ACCOUNTS_MAX),
    trades: z.array(tradeIdSchema).max(20),
    note: text(2000),
};

const atLeastOneName = (v: { nameTh?: string; nameEn?: string }) => (v.nameTh ?? '') !== '' || (v.nameEn ?? '') !== '';
const NAME_REQUIRED = { message: 'A Thai or English name is required', path: ['nameTh'] };

export const supplierDtoSchema = z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    ...supplierFields,
    /** Rate of `defaultWhtPreset`. */
    whtRate: z.number(),
    /** Linked entry of the subcontracting vendor list (imported from it), else null. */
    scVendorListEntryId: uuidSchema.nullable(),
    vendorWorkspaceId: uuidSchema.nullable(),
    /** Average score 1–5 (2 decimals), null until rated. */
    rating: z.number().nullable(),
    ratingCount: z.number().int(),
    archivedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type SupplierDto = z.infer<typeof supplierDtoSchema>;
export const supplierListDtoSchema = z.array(supplierDtoSchema);

/** POST /workspaces/:workspaceId/suppliers (optional fields get their defaults). */
export const createSupplierRequestSchema = z.object({
    ...supplierFields,
    kind: supplierFields.kind.default('material'),
    nameTh: supplierFields.nameTh.default(''),
    nameEn: supplierFields.nameEn.default(''),
    taxId: supplierFields.taxId.default(''),
    branchCode: supplierFields.branchCode.default(''),
    isJuristic: supplierFields.isJuristic.default(true),
    vatRegistered: supplierFields.vatRegistered.default(true),
    addressTh: supplierFields.addressTh.default(''),
    addressEn: supplierFields.addressEn.default(''),
    contactName: supplierFields.contactName.default(''),
    phone: supplierFields.phone.default(''),
    email: supplierFields.email.default(''),
    lineId: supplierFields.lineId.default(''),
    creditTermDays: supplierFields.creditTermDays.default(30),
    defaultWhtPreset: supplierFields.defaultWhtPreset.default('none'),
    bankAccounts: supplierFields.bankAccounts.default([]),
    trades: supplierFields.trades.default([]),
    note: supplierFields.note.default(''),
}).refine(atLeastOneName, NAME_REQUIRED);
export type CreateSupplierRequest = z.infer<typeof createSupplierRequestSchema>;
export type CreateSupplierInput = z.input<typeof createSupplierRequestSchema>;

/** PATCH /suppliers/:supplierId: any subset. */
export const patchSupplierRequestSchema = z.object(supplierFields).partial().strict();
export type PatchSupplierRequest = z.infer<typeof patchSupplierRequestSchema>;
export type PatchSupplierInput = z.input<typeof patchSupplierRequestSchema>;

/** GET /workspaces/:workspaceId/suppliers?q=&kind=&trade=&archived=&limit= */
export const supplierListQuerySchema = z.object({
    q: z.string().trim().max(100).optional(),
    kind: supplierKindSchema.optional(),
    trade: tradeIdSchema.optional(),
    archived: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
    limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>;

// ── ratings ──

export const SUPPLIER_RATING_SOURCES = ['manual', 'purchase_order', 'goods_receipt', 'subcontract'] as const;
export const supplierRatingSourceSchema = z.enum(SUPPLIER_RATING_SOURCES);
export type SupplierRatingSource = z.infer<typeof supplierRatingSourceSchema>;

/** POST /suppliers/:supplierId/ratings */
export const createSupplierRatingRequestSchema = z.object({
    score: z.number().int().min(1).max(5),
    note: text(1000).default(''),
    projectId: uuidSchema.nullable().default(null),
    sourceType: supplierRatingSourceSchema.default('manual'),
    sourceId: uuidSchema.nullable().default(null),
});
export type CreateSupplierRatingRequest = z.infer<typeof createSupplierRatingRequestSchema>;
export type CreateSupplierRatingInput = z.input<typeof createSupplierRatingRequestSchema>;

export const supplierRatingDtoSchema = z.object({
    id: uuidSchema,
    supplierId: uuidSchema,
    projectId: uuidSchema.nullable(),
    sourceType: supplierRatingSourceSchema,
    sourceId: uuidSchema.nullable(),
    score: z.number().int(),
    note: z.string(),
    createdBy: uuidSchema.nullable(),
    createdByName: z.string().nullable(),
    createdAt: isoDateTimeSchema,
});
export type SupplierRatingDto = z.infer<typeof supplierRatingDtoSchema>;
export const supplierRatingListDtoSchema = z.array(supplierRatingDtoSchema);

/** POST /suppliers/:supplierId/ratings → the supplier with its new average and the rating. */
export const supplierRatedDtoSchema = z.object({ supplier: supplierDtoSchema, rating: supplierRatingDtoSchema });
export type SupplierRatedDto = z.infer<typeof supplierRatedDtoSchema>;

// ── import from the subcontracting vendor list ──

/** POST /workspaces/:workspaceId/suppliers/import-sc (no body): idempotent by `scVendorListEntryId`. */
export const importScSuppliersDtoSchema = z.object({
    /** Suppliers made by this run (0 when subcontracting is not active or everything was imported before). */
    created: z.number().int(),
    /** Vendor-list entries already linked to a supplier. */
    skipped: z.number().int(),
    suppliers: supplierListDtoSchema,
});
export type ImportScSuppliersDto = z.infer<typeof importScSuppliersDtoSchema>;

/** Supplier block of a purchasing document in one language (stored in e.g. `pc_orders.supplier_snapshot`). */
export const supplierSnapshotSchema = z.object({
    id: uuidSchema,
    kind: supplierKindSchema,
    name: z.string(),
    taxId: z.string(),
    branchCode: z.string(),
    isJuristic: z.boolean(),
    vatRegistered: z.boolean(),
    address: z.string(),
    contactName: z.string(),
    phone: z.string(),
    email: z.string(),
    creditTermDays: z.number().int(),
    whtPreset: supplierWhtPresetSchema,
    whtRate: z.number(),
    language: docLanguageSchema,
});
export type SupplierSnapshot = z.infer<typeof supplierSnapshotSchema>;
