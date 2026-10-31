// ─── Comparing the quotes of an RFQ (docs/erp/04-implementation-plan.md WP-38) ───
// Pure. Everything is compared without VAT: prices typed with VAT are split at the quote's VAT rate first.
// Per line: the lowest unit price among the suppliers who offer it (ties: all of them).
// Per supplier: quoted total (its subtotal) and a normalized total where every line it does not offer counts at the
// budget (qty × budgetUnitPrice), so a supplier cannot look cheaper by leaving lines out.
import { round2, roundQty, sumMoney } from '../money/money';
import { splitVatInclusive, vatOf } from '../money/tax';

export interface CompareRfqLine {
    id: string;
    qty: number;
    budgetUnitPrice: number;
}

export interface CompareQuoteLine {
    rfqLineId: string;
    unitPrice: number;
    amount: number;
    available: boolean;
}

export interface CompareQuote {
    supplierId: string;
    pricesIncludeVat: boolean;
    /** VAT rate of the quote (0 for a supplier not registered for VAT). */
    vatRate: number;
    subtotal: number;
    lines: readonly CompareQuoteLine[];
}

export interface CompareCell {
    supplierId: string;
    unitPrice: number | null;
    amount: number | null;
    lowest: boolean;
}

export interface CompareLineResult {
    rfqLineId: string;
    lowestUnitPrice: number | null;
    lowestSupplierIds: string[];
    cells: CompareCell[];
}

export interface CompareSupplierResult {
    supplierId: string;
    quotedTotal: number;
    normalizedTotal: number;
    missingLines: number;
    lowestLines: number;
}

export interface CompareResult {
    lines: CompareLineResult[];
    /** Lowest normalized total first (ties: more lowest lines, then the order given). */
    suppliers: CompareSupplierResult[];
    bestSupplierId: string | null;
    /** Σ qty × budgetUnitPrice. */
    budgetTotal: number;
}

/** Subtotal (no VAT), VAT and total of a quote from its line amounts as typed. */
export function quoteTotals(amounts: readonly number[], pricesIncludeVat: boolean, vatRate: number): { subtotal: number; vat: number; total: number } {
    const sum = sumMoney(amounts);
    if (pricesIncludeVat) {
        const split = splitVatInclusive(sum, vatRate);
        return { subtotal: split.net, vat: split.vat, total: sum };
    }
    const vat = vatOf(sum, vatRate);
    return { subtotal: sum, vat, total: round2(sum + vat) };
}

/** Amount of a quoted line as typed: qty × unit price. */
export const quoteLineAmount = (qty: number, unitPrice: number): number => round2(qty * unitPrice);

export function compareQuotes(lines: readonly CompareRfqLine[], quotes: readonly CompareQuote[]): CompareResult {
    const offered = (q: CompareQuote, lineId: string): { unit: number; amount: number } | undefined => {
        const l = q.lines.find(x => x.rfqLineId === lineId);
        if (!l?.available) return undefined;
        if (!q.pricesIncludeVat) return { unit: roundQty(l.unitPrice), amount: round2(l.amount) };
        return { unit: roundQty(l.unitPrice / (1 + q.vatRate)), amount: splitVatInclusive(l.amount, q.vatRate).net };
    };

    const lowestCount = new Map<string, number>(quotes.map(q => [q.supplierId, 0]));
    const lineResults = lines.map((line): CompareLineResult => {
        const prices = quotes.map(q => ({ supplierId: q.supplierId, p: offered(q, line.id) }));
        const units = prices.flatMap(x => (x.p === undefined ? [] : [x.p.unit]));
        const lowest = units.length === 0 ? null : Math.min(...units);
        const lowestSupplierIds = lowest === null ? [] : prices.filter(x => x.p?.unit === lowest).map(x => x.supplierId);
        for (const id of lowestSupplierIds) lowestCount.set(id, (lowestCount.get(id) ?? 0) + 1);
        return {
            rfqLineId: line.id,
            lowestUnitPrice: lowest,
            lowestSupplierIds,
            cells: prices.map(x => ({
                supplierId: x.supplierId, unitPrice: x.p?.unit ?? null, amount: x.p?.amount ?? null, lowest: lowestSupplierIds.includes(x.supplierId),
            })),
        };
    });

    const suppliers = quotes.map((q, order) => {
        const missing = lines.filter(l => offered(q, l.id) === undefined);
        return {
            order,
            supplierId: q.supplierId,
            quotedTotal: round2(q.subtotal),
            normalizedTotal: sumMoney([q.subtotal, ...missing.map(l => l.qty * l.budgetUnitPrice)]),
            missingLines: missing.length,
            lowestLines: lowestCount.get(q.supplierId) ?? 0,
        };
    }).sort((a, b) => a.normalizedTotal - b.normalizedTotal || b.lowestLines - a.lowestLines || a.order - b.order)
        .map(({ order: _order, ...s }) => s);

    return {
        lines: lineResults,
        suppliers,
        bestSupplierId: suppliers[0]?.supplierId ?? null,
        budgetTotal: sumMoney(lines.map(l => l.qty * l.budgetUnitPrice)),
    };
}
