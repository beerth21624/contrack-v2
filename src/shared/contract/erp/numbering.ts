// ─── Running document numbers (docs/erp/01-architecture.md §8, 02-domain-model.md §1.6) ───
// A document gets its number only when it is issued (backend port DocumentNumbering, inside the issuing transaction);
// a number is never reused, voided numbers stay. Settings: GET /workspaces/:workspaceId/numbering,
// PUT /workspaces/:workspaceId/numbering/:docType (`company.manage`). Pattern rules: src/domain/erp/numbering.ts.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';

export const DOC_TYPES = [
    'project', 'quotation', 'contract', 'invoice', 'tax_invoice', 'receipt', 'credit_note', 'variation',
    'purchase_request', 'rfq', 'purchase_order', 'goods_receipt', 'supplier_bill', 'payment_voucher', 'wht_certificate',
    'handover', 'warranty_claim',
] as const;
export const docTypeSchema = z.enum(DOC_TYPES);
export type DocType = z.infer<typeof docTypeSchema>;

export const NUMBER_RESETS = ['yearly', 'monthly', 'never'] as const;
export const numberResetSchema = z.enum(NUMBER_RESETS);
export type NumberReset = z.infer<typeof numberResetSchema>;

export const YEAR_STYLES = ['ce', 'be'] as const;
export const yearStyleSchema = z.enum(YEAR_STYLES);
export type YearStyle = z.infer<typeof yearStyleSchema>;

/** Pattern tokens (§8.2). */
export const NUMBER_PATTERN_TOKENS = ['{prefix}', '{yyyy}', '{yy}', '{mm}', '{seq:4}'] as const;
export const DEFAULT_NUMBER_PATTERN = '{prefix}{yyyy}-{seq:4}';
export const DEFAULT_MONTHLY_NUMBER_PATTERN = '{prefix}{yyyy}{mm}-{seq:4}';

export interface DocTypeDefault {
    prefix: string;
    reset: NumberReset;
}

/** Series used while a workspace saved none (pattern DEFAULT_NUMBER_PATTERN, year style `ce`). */
export const DOC_TYPE_DEFAULTS: Readonly<Record<DocType, DocTypeDefault>> = {
    project: { prefix: 'PJ', reset: 'yearly' },
    quotation: { prefix: 'QT', reset: 'yearly' },
    contract: { prefix: 'CT', reset: 'yearly' },
    invoice: { prefix: 'INV', reset: 'yearly' },
    tax_invoice: { prefix: 'TI', reset: 'yearly' },
    receipt: { prefix: 'RC', reset: 'yearly' },
    credit_note: { prefix: 'CN', reset: 'yearly' },
    variation: { prefix: 'VO', reset: 'yearly' },
    purchase_request: { prefix: 'PR', reset: 'yearly' },
    rfq: { prefix: 'RFQ', reset: 'yearly' },
    purchase_order: { prefix: 'PO', reset: 'yearly' },
    goods_receipt: { prefix: 'GR', reset: 'yearly' },
    supplier_bill: { prefix: 'AP', reset: 'yearly' },
    payment_voucher: { prefix: 'PV', reset: 'yearly' },
    wht_certificate: { prefix: 'WHT', reset: 'yearly' },
    handover: { prefix: 'HO', reset: 'yearly' },
    warranty_claim: { prefix: 'WC', reset: 'yearly' },
};

/** Tax documents: numbers must follow the document dates (an issue date before the series' latest → 422). */
export const DATE_ORDERED_DOC_TYPES: readonly DocType[] = ['tax_invoice', 'receipt', 'credit_note'];

/** Not a tax document: deleting a project or workspace that has only these numbers is allowed. */
export const DELETION_EXEMPT_DOC_TYPES: readonly DocType[] = ['project'];

export const ISSUED_DOCUMENT_STATUSES = ['issued', 'voided'] as const;
export type IssuedDocumentStatus = (typeof ISSUED_DOCUMENT_STATUSES)[number];

export const numberingSeriesDtoSchema = z.object({
    docType: docTypeSchema,
    prefix: z.string(),
    pattern: z.string(),
    reset: numberResetSchema,
    yearStyle: yearStyleSchema,
    /** No saved row: DOC_TYPE_DEFAULTS. */
    isDefault: z.boolean(),
    /** Number the next document issued today would get (nothing is reserved). */
    nextNumber: z.string(),
    /** Counter period of today, e.g. `2026`, `2026-10`, `all`. */
    periodKey: z.string(),
    /** Documents already numbered in today's period: prefix / pattern / reset / year style are locked. */
    issuedInPeriod: z.number().int().min(0),
    updatedBy: uuidSchema.nullable(),
    updatedAt: isoDateTimeSchema.nullable(),
});
export type NumberingSeriesDto = z.infer<typeof numberingSeriesDtoSchema>;
export const numberingSeriesListDtoSchema = z.array(numberingSeriesDtoSchema);

/** PUT /workspaces/:workspaceId/numbering/:docType. Pattern problems → 422 `invalid_pattern` with `problems`. */
export const putNumberingSeriesRequestSchema = z.object({
    prefix: z.string().trim().max(12).regex(/^[A-Za-z0-9._/-]*$/),
    pattern: z.string().trim().min(1).max(64),
    reset: numberResetSchema,
    yearStyle: yearStyleSchema,
});
export type PutNumberingSeriesRequest = z.infer<typeof putNumberingSeriesRequestSchema>;
