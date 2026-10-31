// ─── VO pricing (docs/erp/02-domain-model.md §5) ───
// Pure. Cost of a line = its quantity change × (material + labour unit cost), or the BOQ total change for a line
// computed from the calculators; selling price = cost × the sell factor of the line's BOQ section (from the accepted
// quotation, D-31: 1 + markup + overhead + profit). Amounts are signed (a VO may remove work) and exclude VAT.
import { round2, roundQty, sumMoney } from '../money/money';

/** Sell factor per BOQ section, and the one for sections the quotation does not list. */
export interface VariationSellFactors {
    bySection: Readonly<Record<number, number>>;
    fallback: number;
}

export const sellFactorOf = (factors: VariationSellFactors, sectionNo: number): number => {
    const f = factors.bySection[sectionNo];
    return f !== undefined && Number.isFinite(f) && f > 0 ? f : factors.fallback;
};

/** What a line carries before pricing. */
export interface VariationLineCost {
    sectionNo: number;
    qtyDelta: number;
    costMatUnit: number;
    costLabUnit: number;
    /** Given for calculator lines (the BOQ total change); manual lines compute it from qty × units. */
    costAmount?: number;
}

export interface VariationLinePrice {
    qtyDelta: number;
    costMatUnit: number;
    costLabUnit: number;
    costAmount: number;
    /** round2((mat + lab) × factor). */
    sellUnit: number;
    /** round2(costAmount × factor): follows the cost even when only a unit price changed (qtyDelta 0). */
    sellAmount: number;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);

/** Prices one VO line with the sell factor of its section. */
export function priceVariationLine(line: VariationLineCost, factors: VariationSellFactors): VariationLinePrice {
    const qtyDelta = roundQty(finite(line.qtyDelta));
    const costMatUnit = roundQty(finite(line.costMatUnit));
    const costLabUnit = roundQty(finite(line.costLabUnit));
    const costAmount = round2(line.costAmount !== undefined ? finite(line.costAmount) : qtyDelta * (costMatUnit + costLabUnit));
    const factor = sellFactorOf(factors, line.sectionNo);
    return {
        qtyDelta,
        costMatUnit,
        costLabUnit,
        costAmount,
        sellUnit: round2((costMatUnit + costLabUnit) * factor),
        sellAmount: round2(costAmount * factor),
    };
}

export interface VariationTotals {
    costTotal: number;
    sellTotal: number;
    /** round2(sellTotal × vatRate), signed. */
    vat: number;
}

/** Totals of the priced lines at the contract's VAT rate (0 when the company is not VAT registered). */
export function variationTotals(lines: readonly { costAmount: number; sellAmount: number }[], vatRate: number): VariationTotals {
    const costTotal = sumMoney(lines.map(l => l.costAmount));
    const sellTotal = sumMoney(lines.map(l => l.sellAmount));
    return { costTotal, sellTotal, vat: round2(sellTotal * finite(vatRate)) };
}
