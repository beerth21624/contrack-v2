// ─── Basic schemas shared by every ERP contract (docs/erp/01-architecture.md §2, §12, §13) ───
// Names differ from subcontracting/common.ts (moneySchema, qtySchema, fractionSchema, dateSchema) on purpose.
import { z } from 'zod';

/** Baht amount, 2 decimals, never negative (stored as numeric(14,2) after round2). */
export const amountSchema = z.number().finite().min(0).max(1e11);
/** Baht amount that may be negative (e.g. a variation that removes work). */
export const signedAmountSchema = z.number().finite().min(-1e11).max(1e11);
/** Quantity, 4 decimals (numeric(16,4)). */
export const quantitySchema = z.number().finite().min(-1e9).max(1e9);
/** Unit price, 4 decimals (numeric(16,4)). */
export const unitPriceSchema = z.number().finite().min(0).max(1e9);
/** Fraction: 0.07 = 7% (numeric(7,6)). */
export const rateSchema = z.number().finite().min(0).max(1);

/** A real calendar day (`2026-02-30` is refused). */
function isCalendarDay(s: string): boolean {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Business date (document date, due date) written `YYYY-MM-DD`, Bangkok calendar, no time zone. */
export const businessDateSchema = z.string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    .refine(isCalendarDay, { message: 'Not a calendar day' });
export type BusinessDate = z.infer<typeof businessDateSchema>;

/** Language of one printed document (one language per document, D-32). */
export const DOC_LANGUAGES = ['th', 'en'] as const;
export const docLanguageSchema = z.enum(DOC_LANGUAGES);
export type DocLanguage = z.infer<typeof docLanguageSchema>;

/** Query of cursor-paged lists: `limit` (1–200, default 50) and the cursor of the last row seen. */
export const cursorQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    before: z.string().optional(),
});
export type CursorQuery = z.infer<typeof cursorQuerySchema>;
