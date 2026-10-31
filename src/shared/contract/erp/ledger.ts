// ─── Cost ledger + financial events (ERP foundation, docs/erp/02-domain-model.md §1.11, WP-20) ───
// Both tables are append-only: a correction is a new row with negated amounts whose `reversesId` names the original.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { businessDateSchema } from './common';

/** `commit` = PO / subcontract still open; `commit_release` (≤ 0) frees part of one; `actual` = cost incurred. */
export const COST_ENTRY_KINDS = ['commit', 'commit_release', 'actual'] as const;
export const costEntryKindSchema = z.enum(COST_ENTRY_KINDS);
export type CostEntryKind = z.infer<typeof costEntryKindSchema>;

export const COST_CATEGORIES = ['material', 'labour', 'subcontract', 'equipment', 'other'] as const;
export const costCategorySchema = z.enum(COST_CATEGORIES);
export type CostCategory = z.infer<typeof costCategorySchema>;

/** What posted a ledger row (stored as plain text: a later module may add its own type here). */
export const COST_SOURCE_TYPES = [
    'purchase_order', 'goods_receipt', 'supplier_bill', 'subcontract', 'sc_claim', 'timesheet', 'site_diary', 'warranty_claim', 'manual',
] as const;
export const costSourceTypeSchema = z.enum(COST_SOURCE_TYPES);
export type CostSourceType = z.infer<typeof costSourceTypeSchema>;

export const FIN_EVENT_TYPES = [
    'ar.advance_invoiced', 'ar.invoiced', 'ar.tax_invoiced', 'ar.credit_noted', 'ar.receipt', 'ar.wht_withheld_by_customer',
    'ar.retention_withheld', 'ar.retention_released', 'ar.advance_recovered', 'ar.penalty',
    'ap.bill_posted', 'ap.payment', 'ap.wht_withheld', 'ap.retention_withheld', 'ap.retention_released',
    'lb.wages_paid', 'lb.advance_paid', 'lb.advance_recovered', 'sc.claim_paid',
] as const;
export const finEventTypeSchema = z.enum(FIN_EVENT_TYPES);
export type FinEventType = z.infer<typeof finEventTypeSchema>;

/** Direction of the cash (none = no money moved, e.g. an invoice). */
export const FIN_DIRECTIONS = ['in', 'out', 'none'] as const;
export const finDirectionSchema = z.enum(FIN_DIRECTIONS);
export type FinDirection = z.infer<typeof finDirectionSchema>;

export const FIN_COUNTERPARTY_TYPES = ['customer', 'supplier', 'subcontractor', 'worker', 'government', 'other'] as const;
export const finCounterpartyTypeSchema = z.enum(FIN_COUNTERPARTY_TYPES);
export type FinCounterpartyType = z.infer<typeof finCounterpartyTypeSchema>;

export const costLedgerEntryDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    /** null = project overhead not tied to a BOQ line. */
    costCodeId: uuidSchema.nullable(),
    entryDate: businessDateSchema,
    kind: costEntryKindSchema,
    category: costCategorySchema,
    /** Signed baht without VAT. */
    amount: z.number(),
    qty: z.number().nullable(),
    sourceType: z.string(),
    sourceId: uuidSchema,
    sourceLineId: uuidSchema.nullable(),
    commitmentRef: uuidSchema.nullable(),
    reversesId: uuidSchema.nullable(),
    note: z.string(),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
});
export type CostLedgerEntryDto = z.infer<typeof costLedgerEntryDtoSchema>;

/** Sums of one cost code (or of the project when `costCodeId` is absent). committedOpen = committed + released. */
export const costLedgerTotalsDtoSchema = z.object({
    committed: z.number(),
    /** Σ commit_release (≤ 0). */
    released: z.number(),
    committedOpen: z.number(),
    actual: z.number(),
});
export type CostLedgerTotalsDto = z.infer<typeof costLedgerTotalsDtoSchema>;

export const costLedgerCodeTotalsDtoSchema = costLedgerTotalsDtoSchema.extend({ costCodeId: uuidSchema.nullable() });
export type CostLedgerCodeTotalsDto = z.infer<typeof costLedgerCodeTotalsDtoSchema>;

export const costLedgerQuerySchema = z.object({ costCodeId: uuidSchema.optional() });
export type CostLedgerQuery = z.infer<typeof costLedgerQuerySchema>;

/** GET /projects/:projectId/cost-ledger — entries oldest first; totals per cost code and for the whole selection. */
export const costLedgerDtoSchema = z.object({
    entries: z.array(costLedgerEntryDtoSchema),
    byCostCode: z.array(costLedgerCodeTotalsDtoSchema),
    totals: costLedgerTotalsDtoSchema,
});
export type CostLedgerDto = z.infer<typeof costLedgerDtoSchema>;

export const finEventDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema.nullable(),
    eventDate: businessDateSchema,
    eventType: finEventTypeSchema,
    direction: finDirectionSchema,
    counterpartyType: finCounterpartyTypeSchema,
    counterpartyId: uuidSchema.nullable(),
    counterpartyName: z.string(),
    counterpartyTaxId: z.string(),
    counterpartyBranch: z.string(),
    docType: z.string().nullable(),
    docNumber: z.string().nullable(),
    docDate: businessDateSchema.nullable(),
    sourceType: z.string(),
    sourceId: uuidSchema,
    /** Signed baht: net without VAT; cash = money that actually moved (0 when none). */
    net: z.number(),
    vat: z.number(),
    wht: z.number(),
    retention: z.number(),
    cash: z.number(),
    reversesId: uuidSchema.nullable(),
    data: z.record(z.string(), z.unknown()),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
});
export type FinEventDto = z.infer<typeof finEventDtoSchema>;

/** `type` = one type or several separated by commas; dates inclusive. */
export const finEventListQuerySchema = z.object({
    from: businessDateSchema.optional(),
    to: businessDateSchema.optional(),
    type: z.string().optional()
        .transform(v => (v === undefined || v.trim() === '' ? undefined : v.split(',').map(s => s.trim()).filter(s => s !== '')))
        .pipe(z.array(finEventTypeSchema).optional()),
    projectId: uuidSchema.optional(),
});
export type FinEventListQuery = z.infer<typeof finEventListQuerySchema>;

/** Oldest first (event date, then creation). */
export const finEventListDtoSchema = z.array(finEventDtoSchema);
