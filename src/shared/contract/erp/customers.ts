// ─── Customer register (docs/erp/02-domain-model.md §1.7) ───
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { docLanguageSchema, rateSchema } from './common';

export const CUSTOMER_KINDS = ['individual', 'juristic', 'government'] as const;
export const customerKindSchema = z.enum(CUSTOMER_KINDS);
export type CustomerKind = z.infer<typeof customerKindSchema>;

/** Withholding rate the customer applies when no rate is set on the customer (individual 0, juristic 3%, government 1%). */
export const CUSTOMER_KIND_WHT_RATE: Record<CustomerKind, number> = { individual: 0, juristic: 0.03, government: 0.01 };

const text = (max: number) => z.string().trim().max(max);

const customerFields = {
    kind: customerKindSchema,
    nameTh: text(200),
    nameEn: text(200),
    taxId: text(20),
    branchCode: text(10),
    addressTh: text(500),
    addressEn: text(500),
    contactName: text(120),
    phone: text(40),
    email: text(200),
    lineId: text(80),
    /** null = by kind. */
    defaultWhtRate: rateSchema.nullable(),
    defaultDocLanguage: docLanguageSchema,
    paymentTermDays: z.number().int().min(0).max(365),
    note: text(2000),
};

const atLeastOneName = (v: { nameTh?: string; nameEn?: string }) => (v.nameTh ?? '') !== '' || (v.nameEn ?? '') !== '';
const NAME_REQUIRED = { message: 'A Thai or English name is required', path: ['nameTh'] };

export const customerDtoSchema = z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    ...customerFields,
    /** The rate in force: `defaultWhtRate` or the rate of the kind. */
    effectiveWhtRate: rateSchema,
    archivedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type CustomerDto = z.infer<typeof customerDtoSchema>;

export const customerListDtoSchema = z.array(customerDtoSchema);

/** POST /workspaces/:workspaceId/customers (optional fields get their defaults). */
export const createCustomerRequestSchema = z.object({
    ...customerFields,
    nameTh: customerFields.nameTh.default(''),
    nameEn: customerFields.nameEn.default(''),
    taxId: customerFields.taxId.default(''),
    branchCode: customerFields.branchCode.default(''),
    addressTh: customerFields.addressTh.default(''),
    addressEn: customerFields.addressEn.default(''),
    contactName: customerFields.contactName.default(''),
    phone: customerFields.phone.default(''),
    email: customerFields.email.default(''),
    lineId: customerFields.lineId.default(''),
    defaultWhtRate: customerFields.defaultWhtRate.default(null),
    defaultDocLanguage: customerFields.defaultDocLanguage.default('th'),
    paymentTermDays: customerFields.paymentTermDays.default(30),
    note: customerFields.note.default(''),
}).refine(atLeastOneName, NAME_REQUIRED);
export type CreateCustomerRequest = z.infer<typeof createCustomerRequestSchema>;
export type CreateCustomerInput = z.input<typeof createCustomerRequestSchema>;

/** PATCH /customers/:customerId: any subset. */
export const patchCustomerRequestSchema = z.object(customerFields).partial().strict();
export type PatchCustomerRequest = z.infer<typeof patchCustomerRequestSchema>;

/** GET /workspaces/:workspaceId/customers?q=&kind=&archived=&limit= */
export const customerListQuerySchema = z.object({
    q: z.string().trim().max(100).optional(),
    kind: customerKindSchema.optional(),
    archived: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
    limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
