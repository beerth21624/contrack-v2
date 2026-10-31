// ─── Late penalty (liquidated damages) of a claim (docs/erp/02-domain-model.md §4.1) ───
// P = round2(days × ratePerDay × base) where base = contract value or the work remaining before this claim; capped
// over the whole contract at round2(capPct × current value) − Σ penalties of earlier claims. The penalty is taken off
// the payable amount, not off the VAT base (D-06).
import { round2 } from '../money/money';

export type PenaltyBase = 'contract_value' | 'remaining_work';

export interface ClaimPenaltyInput {
    /** Days late entered on the claim (0 = no penalty). */
    days: number;
    ratePerDay: number;
    base: PenaltyBase;
    capPct: number;
    /** `mc_contracts.current_value`. */
    currentValue: number;
    /** Cumulative work value before this claim (for `remaining_work`). */
    previousValue: number;
    /** Σ penalty of earlier claims of the contract. */
    previousPenalty: number;
    /** Amount the user typed instead of the computed one (kept within the cap). */
    override?: number | null;
}

export interface ClaimPenalty {
    /** Base value the rate applies to. */
    baseValue: number;
    /** round2(days × ratePerDay × baseValue), before the cap. */
    computed: number;
    /** Most this claim may deduct (cap left over the contract). */
    max: number;
    /** Amount deducted: (override ?? computed) clamped to [0, max]. */
    amount: number;
}

export function penaltyBaseValue(base: PenaltyBase, currentValue: number, previousValue: number): number {
    return base === 'contract_value' ? round2(currentValue) : round2(Math.max(0, currentValue - previousValue));
}

/** Penalty cap left for a claim: max(0, round2(capPct × current value) − previous penalties). */
export function penaltyCapLeft(capPct: number, currentValue: number, previousPenalty: number): number {
    return round2(Math.max(0, round2(capPct * currentValue) - previousPenalty));
}

export function claimPenalty(input: ClaimPenaltyInput): ClaimPenalty {
    const baseValue = penaltyBaseValue(input.base, input.currentValue, input.previousValue);
    const days = Math.max(0, input.days);
    const computed = round2(days * input.ratePerDay * baseValue);
    const max = penaltyCapLeft(input.capPct, input.currentValue, input.previousPenalty);
    const wanted = input.override ?? computed;
    return { baseValue, computed, max, amount: round2(Math.min(max, Math.max(0, wanted))) };
}
