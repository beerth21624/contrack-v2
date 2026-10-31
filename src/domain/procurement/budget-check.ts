// ─── Budget check of a purchase document per cost code (docs/erp/02-domain-model.md §7.2) ───
// Pure. Lines are grouped per cost code (lines without one are not checked):
//   over_quantity: qty of this document + qty requested / ordered before > (baseline_qty + vo_qty) × 1.05
//   over_price:    highest unit price > baseline material unit cost × 1.05 (only when that cost is known, > 0)
//   over_budget:   committed open + actual + amount of this document > material budget (no tolerance)
// Warnings never block; the caller asks for an override reason (and an approval for a PO).
import { round2, roundQty, sumMoney } from '../money/money';

/** Default tolerance over the budgeted quantity / unit price. */
export const DEFAULT_BUDGET_TOLERANCE = 0.05;

export type BudgetWarningKind = 'over_quantity' | 'over_price' | 'over_budget';

export interface BudgetWarningResult {
    kind: BudgetWarningKind;
    costCodeId: string;
    code: string;
    limit: number;
    value: number;
}

/** What the check knows of one cost code. */
export interface BudgetCheckCode {
    costCodeId: string;
    code: string;
    baselineQty: number;
    voQty: number;
    baselineMatUnit: number;
    /** Material budget in baht (baseline material + the material share of accepted VOs). */
    materialBudget: number;
    /** Ledger of the cost code: open commitments and actual cost so far. */
    committedOpen: number;
    actual: number;
    /** Quantity of the code already requested / ordered by other documents. */
    priorQty: number;
}

export interface BudgetCheckLine {
    costCodeId: string | null;
    qty: number;
    unitPrice: number;
    amount: number;
}

/**
 * Material budget of a cost code: its baseline material plus the material share of the VO cost (the baseline's
 * material / total ratio; a code made by a VO has no baseline, so all its VO cost counts).
 */
export function materialBudgetOf(code: { baselineMat: number; baselineTotal: number; voCost: number }): number {
    const voShare = code.baselineTotal > 0 ? code.voCost * (code.baselineMat / code.baselineTotal) : code.voCost;
    return round2(code.baselineMat + voShare);
}

/** Warnings of a document's lines, in cost code order of first appearance, then kind order. */
export function budgetWarnings(
    lines: readonly BudgetCheckLine[], codes: ReadonlyMap<string, BudgetCheckCode>, tolerance: number = DEFAULT_BUDGET_TOLERANCE,
): BudgetWarningResult[] {
    const groups = new Map<string, { qty: number; maxUnit: number; amounts: number[] }>();
    for (const l of lines) {
        if (l.costCodeId === null) continue;
        const g = groups.get(l.costCodeId) ?? { qty: 0, maxUnit: 0, amounts: [] };
        g.qty += l.qty;
        g.maxUnit = Math.max(g.maxUnit, l.unitPrice);
        g.amounts.push(l.amount);
        groups.set(l.costCodeId, g);
    }
    const out: BudgetWarningResult[] = [];
    for (const [costCodeId, g] of groups) {
        const c = codes.get(costCodeId);
        if (c === undefined) continue;
        const qtyLimit = roundQty((c.baselineQty + c.voQty) * (1 + tolerance));
        const qtyValue = roundQty(g.qty + c.priorQty);
        if (qtyValue > qtyLimit) out.push({ kind: 'over_quantity', costCodeId, code: c.code, limit: qtyLimit, value: qtyValue });
        if (c.baselineMatUnit > 0) {
            const priceLimit = roundQty(c.baselineMatUnit * (1 + tolerance));
            const price = roundQty(g.maxUnit);
            if (price > priceLimit) out.push({ kind: 'over_price', costCodeId, code: c.code, limit: priceLimit, value: price });
        }
        const spend = sumMoney([c.committedOpen, c.actual, ...g.amounts]);
        if (spend > round2(c.materialBudget)) {
            out.push({ kind: 'over_budget', costCodeId, code: c.code, limit: round2(c.materialBudget), value: spend });
        }
    }
    return out;
}

/** Quantity of a cost code that remains to request: budgeted − requested before, never below 0. */
export function remainingQty(c: Pick<BudgetCheckCode, 'baselineQty' | 'voQty' | 'priorQty'>): number {
    return Math.max(0, roundQty(c.baselineQty + c.voQty - c.priorQty));
}
