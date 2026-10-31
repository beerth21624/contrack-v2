// ─── 3-way match: PO ↔ goods received ↔ supplier bill, per bill line (docs/erp/02-domain-model.md §7.2) ───
// Pure. A bill line is
//   no_po                 it names no PO line (or one not given here)
//   qty_exceeds_received  billed before + this qty > received qty
//   price_differs         its unit price differs from the PO's by more than the tolerance: the larger of 1% of the
//                         PO unit price and 1 baht (D-284)
//   matched               otherwise
// Quantity is checked before price. Lines of the same PO line add up in order (two lines of 6 on a receipt of 10:
// the second one exceeds).
import { round2, roundQty } from '../money/money';

export type ThreeWayMatchStatus = 'matched' | 'qty_exceeds_received' | 'price_differs' | 'no_po';

/** Relative tolerance on the unit price. */
export const MATCH_PRICE_TOLERANCE = 0.01;
/** Absolute tolerance on the unit price (baht). */
export const MATCH_PRICE_TOLERANCE_BAHT = 1;

export interface MatchOrderLine {
    id: string;
    unitPrice: number;
    receivedQty: number;
    billedQty: number;
}

export interface MatchBillLine {
    orderLineId: string | null;
    qty: number;
    unitPrice: number;
}

export interface MatchResult {
    status: ThreeWayMatchStatus;
    /** Quantity still billable on the PO line before this bill line (received − billed), null without a PO line. */
    billableQty: number | null;
    /** Bill unit price − PO unit price, null without a PO line. */
    priceDiff: number | null;
}

/** Whether `billPrice` is within the tolerance of `poPrice`. */
export function priceWithinTolerance(poPrice: number, billPrice: number): boolean {
    const tolerance = Math.max(Math.abs(poPrice) * MATCH_PRICE_TOLERANCE, MATCH_PRICE_TOLERANCE_BAHT);
    return Math.abs(roundQty(billPrice) - roundQty(poPrice)) <= tolerance + 1e-9;
}

/** One result per bill line, in order. */
export function threeWayMatch(orderLines: readonly MatchOrderLine[], billLines: readonly MatchBillLine[]): MatchResult[] {
    const byId = new Map(orderLines.map(l => [l.id, l]));
    const billed = new Map(orderLines.map(l => [l.id, l.billedQty]));
    return billLines.map((b): MatchResult => {
        const po = b.orderLineId === null ? undefined : byId.get(b.orderLineId);
        if (po === undefined) return { status: 'no_po', billableQty: null, priceDiff: null };
        const before = billed.get(po.id) ?? 0;
        const billableQty = roundQty(po.receivedQty - before);
        billed.set(po.id, roundQty(before + b.qty));
        const priceDiff = round2(b.unitPrice - po.unitPrice);
        if (roundQty(before + b.qty) > roundQty(po.receivedQty)) return { status: 'qty_exceeds_received', billableQty, priceDiff };
        if (!priceWithinTolerance(po.unitPrice, b.unitPrice)) return { status: 'price_differs', billableQty, priceDiff };
        return { status: 'matched', billableQty, priceDiff };
    });
}
