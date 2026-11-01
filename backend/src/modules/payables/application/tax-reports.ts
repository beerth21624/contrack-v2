// ─── Monthly tax reports from fin_events (docs/erp/04-implementation-plan.md WP-52) ───
// Pure: events in → report rows out. Output VAT = ar.tax_invoiced − ar.credit_noted (by event date); input VAT =
// ap.bill_posted with a full tax invoice (number + claimable), by `data.taxInvoiceDate`; ภ.ง.ด.3 / 53 = ap.wht_withheld
// split by `data.form` (event date = pay date); WHT received = ar.wht_withheld_by_customer. Reversal rows carry the
// original's data and negated amounts, so they pass the same filters; they are listed right after their original.
import {
    type FinEventType, type TaxReportDto, type TaxReportKind, type TaxReportRowDto, type TaxReportTotalsDto, WHT_INCOME_TYPES,
    type WhtIncomeType, taxMonthRange,
} from '@contrack/contract';
import { round2, sumMoney } from '@contrack/domain/money';
import type { FinEvent } from '../../../shared/application/ports';

export const REPORT_EVENT_TYPES: Record<TaxReportKind, readonly FinEventType[]> = {
    'output-vat': ['ar.tax_invoiced', 'ar.credit_noted'],
    'input-vat': ['ap.bill_posted'],
    pnd3: ['ap.wht_withheld'],
    pnd53: ['ap.wht_withheld'],
    'wht-received': ['ar.wht_withheld_by_customer'],
};

/** Input VAT is dated by the tax invoice, which may be months before the bill: every bill event is read. */
export const READS_ALL_DATES: Record<TaxReportKind, boolean> = {
    'output-vat': false, 'input-vat': true, pnd3: false, pnd53: false, 'wht-received': false,
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const incomeTypeOf = (v: unknown): WhtIncomeType | null => (WHT_INCOME_TYPES as readonly unknown[]).includes(v) ? v as WhtIncomeType : null;
const isDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

function belongs(kind: TaxReportKind, e: FinEvent): boolean {
    if (!REPORT_EVENT_TYPES[kind].includes(e.eventType)) return false;
    switch (kind) {
        case 'input-vat':
            // Only a full tax invoice (number recorded and marked claimable) gives input VAT.
            return e.data.inputVatClaimable === true && str(e.data.taxInvoiceNo).trim() !== '' && e.vat !== 0;
        case 'pnd3':
        case 'pnd53':
            return e.data.form === kind;
        default:
            return true;
    }
}

function reportDate(kind: TaxReportKind, e: FinEvent): string {
    if (kind === 'input-vat') {
        const d = str(e.data.taxInvoiceDate);
        if (isDate(d)) return d;
        return e.docDate ?? e.eventDate;
    }
    return e.eventDate;
}

function toRow(kind: TaxReportKind, e: FinEvent, reversed: boolean): TaxReportRowDto {
    const base = {
        eventId: e.id, eventType: e.eventType, date: reportDate(kind, e), counterpartyName: e.counterpartyName,
        counterpartyTaxId: e.counterpartyTaxId, counterpartyBranch: e.counterpartyBranch, projectId: e.projectId, sourceType: e.sourceType,
        sourceId: e.sourceId, reversesId: e.reversesId, reversed, whtRate: null, incomeType: null,
    };
    switch (kind) {
        case 'output-vat': {
            // A credit note is posted with positive amounts: it lowers output VAT.
            const sign = e.eventType === 'ar.credit_noted' ? -1 : 1;
            const reference = e.eventType === 'ar.credit_noted' ? str(e.data.taxInvoiceNumber) : str(e.data.invoiceNumber);
            return { ...base, docNumber: e.docNumber ?? '', reference, net: round2(sign * e.net), vat: round2(sign * e.vat), wht: 0 };
        }
        case 'input-vat':
            return { ...base, docNumber: str(e.data.taxInvoiceNo), reference: e.docNumber ?? '', net: e.net, vat: e.vat, wht: 0 };
        case 'pnd3':
        case 'pnd53':
            return {
                ...base, docNumber: e.docNumber ?? '', reference: str(e.data.paymentNumber), net: e.net, vat: 0, wht: e.wht,
                whtRate: num(e.data.whtRate), incomeType: incomeTypeOf(e.data.incomeType),
            };
        case 'wht-received': {
            const reference = [str(e.data.invoiceNumber), str(e.data.certificateNo)].filter(s => s.trim() !== '').join(' / ');
            return { ...base, docNumber: e.docNumber ?? '', reference, net: 0, vat: 0, wht: e.wht };
        }
    }
}

export function reportTotals(rows: readonly TaxReportRowDto[]): TaxReportTotalsDto {
    const originals = rows.filter(r => r.reversesId === null).length;
    const reversals = rows.length - originals;
    return {
        count: Math.max(0, originals - reversals),
        net: sumMoney(rows.map(r => r.net)),
        vat: sumMoney(rows.map(r => r.vat)),
        wht: sumMoney(rows.map(r => r.wht)),
    };
}

/**
 * The report of a month from `events` (oldest first, may reach past the month so a later reversal marks its original).
 * Rows ordered by report date; a reversal in the same month follows its original.
 */
export function buildTaxReport(kind: TaxReportKind, month: string, events: readonly FinEvent[]): TaxReportDto {
    const { from, to } = taxMonthRange(month);
    const candidates = events.filter(e => belongs(kind, e));
    const reversedIds = new Set(candidates.flatMap(e => (e.reversesId === null ? [] : [e.reversesId])));
    const inMonth = candidates
        .filter(e => { const d = reportDate(kind, e); return d >= from && d <= to; })
        .sort((a, b) => {
            const da = reportDate(kind, a);
            const db = reportDate(kind, b);
            if (da !== db) return da < db ? -1 : 1;
            return a.createdAt.getTime() - b.createdAt.getTime();
        });
    const inMonthIds = new Set(inMonth.map(e => e.id));
    const reversalsOf = new Map<string, FinEvent[]>();
    for (const e of inMonth) {
        if (e.reversesId === null || !inMonthIds.has(e.reversesId)) continue;
        reversalsOf.set(e.reversesId, [...(reversalsOf.get(e.reversesId) ?? []), e]);
    }
    const rows: TaxReportRowDto[] = [];
    for (const e of inMonth) {
        if (e.reversesId !== null && inMonthIds.has(e.reversesId)) continue; // listed after its original
        rows.push(toRow(kind, e, reversedIds.has(e.id)));
        for (const r of reversalsOf.get(e.id) ?? []) rows.push(toRow(kind, r, false));
    }
    return { kind, month, from, to, rows, totals: reportTotals(rows) };
}
