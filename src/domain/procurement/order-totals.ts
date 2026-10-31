// ─── Purchase order money (docs/erp/02-domain-model.md §7.2) ───
// Pure. Line amount = round2(qty × unit price) without VAT; the header discount is spread over the lines by amount
// (`allocate`, parts add up exactly) so each line's cost commitment is its share after the discount. A goods receipt
// moves `net × received / qty` of a line to actual cost; the receipt that completes the line takes what is left open.
import { allocate, round2, roundQty, sumMoney } from '../money/money';
import { vatOf } from '../money/tax';

export const orderLineAmount = (qty: number, unitPrice: number): number => round2(roundQty(qty) * roundQty(unitPrice));

export interface OrderTotals {
    subtotal: number;
    discount: number;
    vat: number;
    total: number;
}

/** subtotal = Σ amounts; vat on (subtotal − discount); total = subtotal − discount + vat. */
export function orderTotals(amounts: readonly number[], discount: number, vatRate: number): OrderTotals {
    const subtotal = sumMoney(amounts);
    const d = round2(discount);
    const net = round2(subtotal - d);
    const vat = vatOf(net, vatRate);
    return { subtotal, discount: d, vat, total: round2(net + vat) };
}

/** Each line's amount after its share of the header discount (Σ = subtotal − discount). */
export function lineNetAmounts(amounts: readonly number[], discount: number): number[] {
    if (amounts.length === 0) return [];
    const d = round2(discount);
    if (d === 0) return amounts.map(round2);
    return allocate(round2(sumMoney(amounts) - d), amounts.map(a => Math.max(0, a)));
}

/**
 * Value a receipt of `qty` moves from committed to actual on one line: `net × qty / orderedQty`, never more than
 * `open`; when the line becomes fully received, all of `open` (no satang left committed).
 */
export function receiptValue(input: { net: number; orderedQty: number; receivedBefore: number; qty: number; open: number }): number {
    const open = Math.max(0, round2(input.open));
    if (input.qty <= 0 || input.orderedQty <= 0) return 0;
    if (roundQty(input.receivedBefore + input.qty) >= roundQty(input.orderedQty)) return open;
    return Math.min(open, round2((input.net * input.qty) / input.orderedQty));
}
