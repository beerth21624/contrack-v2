// ─── Customer links: a public, no-sign-in page for one document (docs/erp/02-domain-model.md §1.8) ───
// The owning module (quotations WP-23, billing WP-29/30, variations WP-33) registers a CustomerLinkHandlers entry and
// defines the schema of its own `payload`; until then a payload is `unknown` here.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { docLanguageSchema } from './common';

export const CUSTOMER_LINK_SUBJECTS = ['quotation', 'variation', 'invoice'] as const;
export const customerLinkSubjectSchema = z.enum(CUSTOMER_LINK_SUBJECTS);
export type CustomerLinkSubject = z.infer<typeof customerLinkSubjectSchema>;

export const CUSTOMER_LINK_ACTIONS = ['accept', 'request_change', 'reject'] as const;
export const customerLinkActionSchema = z.enum(CUSTOMER_LINK_ACTIONS);
export type CustomerLinkAction = z.infer<typeof customerLinkActionSchema>;

/** What the customer may answer per subject (an invoice is view only). */
export const CUSTOMER_LINK_SUBJECT_ACTIONS: Record<CustomerLinkSubject, readonly CustomerLinkAction[]> = {
    quotation: ['accept', 'request_change', 'reject'],
    variation: ['accept', 'reject'],
    invoice: [],
};

/** Days a new link stays valid when the creator does not say. */
export const CUSTOMER_LINK_DEFAULT_DAYS = 30;

export const CUSTOMER_LINK_STATUSES = ['active', 'responded', 'expired', 'revoked'] as const;
export const customerLinkStatusSchema = z.enum(CUSTOMER_LINK_STATUSES);
export type CustomerLinkStatus = z.infer<typeof customerLinkStatusSchema>;

/** The customer's answer as shown to the team (the IP / user agent stay in the database). */
export const customerLinkResponseSchema = z.object({
    action: customerLinkActionSchema,
    name: z.string(),
    note: z.string(),
    at: isoDateTimeSchema,
});
export type CustomerLinkResponse = z.infer<typeof customerLinkResponseSchema>;

/** A link as the team sees it (never the token: that is returned once, at creation). */
export const customerLinkDtoSchema = z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    projectId: uuidSchema,
    subjectType: customerLinkSubjectSchema,
    subjectId: uuidSchema,
    status: customerLinkStatusSchema,
    createdBy: uuidSchema.nullable(),
    createdAt: isoDateTimeSchema,
    expiresAt: isoDateTimeSchema,
    revokedAt: isoDateTimeSchema.nullable(),
    lastViewedAt: isoDateTimeSchema.nullable(),
    viewCount: z.number().int(),
    respondedAt: isoDateTimeSchema.nullable(),
    response: customerLinkResponseSchema.nullable(),
});
export type CustomerLinkDto = z.infer<typeof customerLinkDtoSchema>;
export const customerLinkListDtoSchema = z.array(customerLinkDtoSchema);

export const createCustomerLinkRequestSchema = z.object({
    subjectType: customerLinkSubjectSchema,
    subjectId: uuidSchema,
    expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateCustomerLinkRequest = z.infer<typeof createCustomerLinkRequestSchema>;

/** POST /workspaces/:workspaceId/customer-links — the raw token (and its URL) is shown once. */
export const createCustomerLinkResponseSchema = z.object({
    url: z.string(),
    token: z.string(),
    link: customerLinkDtoSchema,
});
export type CreateCustomerLinkResponse = z.infer<typeof createCustomerLinkResponseSchema>;

export const customerLinkListQuerySchema = z.object({
    subjectType: customerLinkSubjectSchema,
    subjectId: uuidSchema,
});
export type CustomerLinkListQuery = z.infer<typeof customerLinkListQuerySchema>;

/** POST /public/links/:token/respond — the customer types their name; no signature (stored with time and IP). */
export const respondRequestSchema = z.object({
    action: customerLinkActionSchema,
    name: z.string().trim().min(1).max(120),
    note: z.string().trim().max(2000).default(''),
});
export type RespondRequest = z.infer<typeof respondRequestSchema>;
export type RespondRequestInput = z.input<typeof respondRequestSchema>;

const viewBase = {
    /** Language of the document: the page follows it, not the browser. */
    language: docLanguageSchema,
    /** Document title as the owner module words it (e.g. "QT-2026-0001"). */
    title: z.string(),
    /** Seller name (company profile) in the document language. */
    companyName: z.string(),
    expiresAt: isoDateTimeSchema,
    /** True while the document is in an answerable state and nobody has answered yet. */
    canRespond: z.boolean(),
    /** Actions the customer may pick (empty for a view-only subject). */
    actions: z.array(customerLinkActionSchema),
    /** The answer already given (also shown after a reload). */
    response: customerLinkResponseSchema.omit({ note: true }).nullable(),
    /** Subject-specific content; its schema belongs to the owner module (renderers.ts on the web). */
    payload: z.unknown(),
};

/** GET /public/links/:token — discriminated by `subjectType`. */
export const customerLinkViewDtoSchema = z.discriminatedUnion('subjectType', [
    z.object({ subjectType: z.literal('quotation'), ...viewBase }),
    z.object({ subjectType: z.literal('variation'), ...viewBase }),
    z.object({ subjectType: z.literal('invoice'), ...viewBase }),
]);
export type CustomerLinkViewDto = z.infer<typeof customerLinkViewDtoSchema>;
