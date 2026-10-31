// ─── Price escalation (ค่า K) of a claim (docs/erp/02-domain-model.md §4.1, D-13) ───
// K = fixed + Σ weight × (current index / base index). |K − 1| ≤ threshold → 0; above → paid on the base by the part
// beyond the threshold; below → deducted the same way. Coefficients and indices are entered by hand (D-13).
import { round2, roundQty } from '../money/money';

export interface EscalationFormula {
    fixed: number;
    terms: readonly { index: string; weight: number; baseValue: number }[];
    threshold: number;
}

/**
 * K of a claim from the indices of its period (by `terms[].index`), rounded to 4 decimals (D-223). An index that is
 * not given counts as unchanged (ratio 1).
 */
export function escalationK(formula: EscalationFormula, indices: Readonly<Record<string, number>>): number {
    let k = formula.fixed;
    for (const t of formula.terms) {
        const current = indices[t.index];
        const ratio = current === undefined || !Number.isFinite(current) || t.baseValue <= 0 ? 1 : current / t.baseValue;
        k += t.weight * ratio;
    }
    return roundQty(k);
}

/** Escalation amount on `base` (W − A): signed, 0 inside the threshold. */
export function escalationAmount(base: number, k: number, threshold: number): number {
    if (k > 1 + threshold) return round2(base * (k - 1 - threshold));
    if (k < 1 - threshold) return -round2(base * (1 - threshold - k));
    return 0;
}
