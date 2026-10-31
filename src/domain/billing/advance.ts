// ─── Advance payment ledger and recovery (docs/erp/02-domain-model.md §4.1, §4.4) ───
// The customer pays an advance (`received`); every claim pays part of it back (`recovered`, advance recovery A).
import { round2 } from '../money/money';

export type AdvanceEntryKind = 'received' | 'recovered';

export interface AdvanceMove {
    kind: AdvanceEntryKind;
    amount: number;
}

export interface AdvanceTotals {
    received: number;
    recovered: number;
    /** Advance still to be recovered (received − recovered, never below 0). */
    balance: number;
}

/** Totals of an `ar_advance_entries` ledger (the balance is always derived from the ledger). */
export function advanceTotals(entries: readonly AdvanceMove[]): AdvanceTotals {
    const sum = (k: AdvanceEntryKind) => round2(entries.filter(e => e.kind === k).reduce((s, e) => s + e.amount, 0));
    const received = sum('received');
    const recovered = sum('recovered');
    return { received, recovered, balance: round2(Math.max(0, received - recovered)) };
}

export interface AdvanceRecoveryInput {
    /** Work value W of the claim. */
    workValue: number;
    /** `terms.advancePct` (fraction). */
    advancePct: number;
    /** Σ received so far. */
    received: number;
    /** Σ recovered by earlier claims. */
    recovered: number;
    /** The claim that completes the contract: recovers everything that is left. */
    isFinal: boolean;
}

/**
 * Advance recovery A = min(round2(W × advancePct), received − recovered); the final claim recovers all that is left
 * (D-222). Never negative.
 */
export function advanceRecovery(input: AdvanceRecoveryInput): number {
    const left = round2(Math.max(0, input.received - input.recovered));
    if (left === 0) return 0;
    if (input.isFinal) return left;
    const share = round2(Math.max(0, input.workValue) * input.advancePct);
    return round2(Math.min(share, left));
}
