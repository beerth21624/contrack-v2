// ─── Shared API contract: uploaded files (drawings, photos, contract scans) ───
// Upload: POST /files (multipart/form-data, field `file`, plus `purpose`) → FileDto.
// The returned `url` is a signed, time-limited link (GET /files/:id/content?exp=…&sig=…) usable in <img src> / <a href>
// without the bearer token. Every DTO that refers to a file carries a fresh FileDto (never a raw storage key).
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';

export const FILE_PURPOSES = ['package_attachment', 'bid_photo', 'claim_photo', 'portfolio_photo', 'contract_scan', 'contract_pdf',
    'company_logo', 'company_stamp', 'company_signature', 'customer_document', 'quotation_attachment',
    'main_contract_scan', 'guarantee_scan', 'payment_slip', 'customer_wht_certificate', 'variation_evidence', 'supplier_quote',
    'delivery_note_photo', 'goods_photo', 'site_photo', 'supplier_bill_scan'] as const;
export const filePurposeSchema = z.enum(FILE_PURPOSES);
export type FilePurpose = z.infer<typeof filePurposeSchema>;

/** Largest upload (bytes). Photos are resized on the phone before upload. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_CONTENT_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
] as const;

export const fileDtoSchema = z.object({
    id: uuidSchema,
    name: z.string(),
    contentType: z.string(),
    size: z.number().int().nonnegative(),
    /** Signed link, valid for about an hour. */
    url: z.string(),
    createdAt: isoDateTimeSchema,
});
export type FileDto = z.infer<typeof fileDtoSchema>;
