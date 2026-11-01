// ─── Monthly tax reports for the accountant (module `payables`, permission `tax.reports`, WP-52) ───
// Read from fin_events only. Output VAT / ภ.ง.ด. / WHT received by `event_date`; input VAT by the supplier's tax
// invoice date (`data.taxInvoiceDate`). A reversed row is listed with its reversal row right after it.
import { z } from 'zod';
import { uuidSchema } from '../common';
import { businessDateSchema } from './common';
import { finEventTypeSchema } from './ledger';
import { whtIncomeTypeSchema } from './payables';

export const TAX_REPORT_KINDS = ['output-vat', 'input-vat', 'pnd3', 'pnd53', 'wht-received'] as const;
export const taxReportKindSchema = z.enum(TAX_REPORT_KINDS);
export type TaxReportKind = z.infer<typeof taxReportKindSchema>;

/** `YYYY-MM`, Bangkok calendar. */
export const taxMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export type TaxMonth = z.infer<typeof taxMonthSchema>;

export const taxReportQuerySchema = z.object({ month: taxMonthSchema });
export type TaxReportQuery = z.infer<typeof taxReportQuerySchema>;

/**
 * One line of a report. Amounts are signed as they count in the report: a credit note (output VAT) and every reversal
 * row are negative. `docNumber` = the document the line is reported under (our TI / CN, the supplier's tax invoice,
 * the 50 ทวิ number, our receipt); `reference` = the related document (credit note → —, input VAT → our AP number,
 * WHT received → the invoice + the customer's certificate number).
 */
export const taxReportRowDtoSchema = z.object({
    eventId: uuidSchema,
    eventType: finEventTypeSchema,
    /** The date the row is reported in (tax invoice date for input VAT, event date otherwise). */
    date: businessDateSchema,
    docNumber: z.string(),
    reference: z.string(),
    counterpartyName: z.string(),
    counterpartyTaxId: z.string(),
    counterpartyBranch: z.string(),
    /** Base without VAT (output / input VAT, ภ.ง.ด.); 0 for WHT received (the base is not recorded). */
    net: z.number(),
    vat: z.number(),
    wht: z.number(),
    /** ภ.ง.ด.: fraction (0.03 = 3%). */
    whtRate: z.number().nullable(),
    incomeType: whtIncomeTypeSchema.nullable(),
    projectId: uuidSchema.nullable(),
    sourceType: z.string(),
    sourceId: uuidSchema,
    /** This row cancels the row `reversesId`. */
    reversesId: uuidSchema.nullable(),
    /** A later row cancels this one. */
    reversed: z.boolean(),
});
export type TaxReportRowDto = z.infer<typeof taxReportRowDtoSchema>;

export const taxReportTotalsDtoSchema = z.object({
    count: z.number().int(),
    net: z.number(),
    vat: z.number(),
    wht: z.number(),
});
export type TaxReportTotalsDto = z.infer<typeof taxReportTotalsDtoSchema>;

/** GET /workspaces/:ws/tax-reports/<kind>?month=YYYY-MM */
export const taxReportDtoSchema = z.object({
    kind: taxReportKindSchema,
    month: taxMonthSchema,
    from: businessDateSchema,
    to: businessDateSchema,
    rows: z.array(taxReportRowDtoSchema),
    totals: taxReportTotalsDtoSchema,
});
export type TaxReportDto = z.infer<typeof taxReportDtoSchema>;

/** GET /workspaces/:ws/tax-reports/summary?month=YYYY-MM — every report of the month, plus VAT payable (output − input). */
export const taxReportSummaryDtoSchema = z.object({
    month: taxMonthSchema,
    from: businessDateSchema,
    to: businessDateSchema,
    outputVat: taxReportTotalsDtoSchema,
    inputVat: taxReportTotalsDtoSchema,
    /** output VAT − input VAT (negative = carried forward / refundable). */
    vatPayable: z.number(),
    pnd3: taxReportTotalsDtoSchema,
    pnd53: taxReportTotalsDtoSchema,
    whtReceived: taxReportTotalsDtoSchema,
});
export type TaxReportSummaryDto = z.infer<typeof taxReportSummaryDtoSchema>;

/** First and last day of a `YYYY-MM` month. */
export function taxMonthRange(month: TaxMonth): { from: string; to: string } {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}
