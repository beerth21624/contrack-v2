// ─── Government reference prices (ERP foundation, docs/erp/02-domain-model.md §1.12, WP-21) ───
import { z } from 'zod';
import { uuidSchema } from '../common';

export const priceReferenceItemDtoSchema = z.object({
    id: uuidSchema,
    bookId: uuidSchema,
    /** The catalogue's own item number (a string even though the source file has a number). */
    mid: z.string(),
    category: z.string(),
    material: z.string(),
    spec: z.string(),
    brand: z.string(),
    model: z.string(),
    unit: z.string(),
    greenLabel: z.boolean(),
    price: z.number(),
    year: z.string(),
});
export type PriceReferenceItemDto = z.infer<typeof priceReferenceItemDtoSchema>;
export const priceReferenceItemListDtoSchema = z.array(priceReferenceItemDtoSchema);

export const PRICE_REFERENCE_MAX_LIMIT = 100;
export const PRICE_REFERENCE_DEFAULT_LIMIT = 30;

/** GET /workspaces/:workspaceId/price-reference/items?q=&category=&limit= */
export const priceReferenceQuerySchema = z.object({
    q: z.string().trim().max(200).optional(),
    category: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(PRICE_REFERENCE_MAX_LIMIT).default(PRICE_REFERENCE_DEFAULT_LIMIT),
});
export type PriceReferenceQuery = z.infer<typeof priceReferenceQuerySchema>;
