// ─── Customer retention (docs/erp/02-domain-model.md §4.1, §4.4) ───
// Withheld from every claim (R), released after completion / warranty by the contract's `retentionRelease` rule.
import { addMonths } from '../dates/business-date';
import { round2 } from '../money/money';

export type ArRetentionKind = 'withheld' | 'released' | 'forfeited';

export interface ArRetentionMove {
    kind: ArRetentionKind;
    amount: number;
}

export interface ArRetentionTotals {
    withheld: number;
    released: number;
    forfeited: number;
    /** Still held (withheld − released − forfeited). */
    balance: number;
}

/** Totals of an `ar_retention_entries` ledger (same shape as `retentionTotals` of subcontracting). */
export function arRetentionTotals(entries: readonly ArRetentionMove[]): ArRetentionTotals {
    const sum = (k: ArRetentionKind) => round2(entries.filter(e => e.kind === k).reduce((s, e) => s + e.amount, 0));
    const withheld = sum('withheld');
    const released = sum('released');
    const forfeited = sum('forfeited');
    return { withheld, released, forfeited, balance: round2(withheld - released - forfeited) };
}

/** Cap of the retention held over the whole contract: round2(capPct × current value); null = no cap. */
export function retentionCap(capPct: number | null, currentValue: number): number | null {
    return capPct === null ? null : round2(Math.max(0, capPct * currentValue));
}

export interface ClaimRetentionInput {
    workValue: number;
    retentionPct: number;
    retentionCapPct: number | null;
    currentValue: number;
    /** Σ withheld by earlier claims (releases do not make room under the cap). */
    withheldSoFar: number;
}

/** R = round2(W × retentionPct), but not more than cap − withheld so far. Never negative. */
export function claimRetention(input: ClaimRetentionInput): number {
    const r = round2(Math.max(0, input.workValue) * input.retentionPct);
    const cap = retentionCap(input.retentionCapPct, input.currentValue);
    if (cap === null) return r;
    return round2(Math.min(r, Math.max(0, cap - input.withheldSoFar)));
}

export type RetentionRelease = 'half_at_completion_half_after_warranty' | 'all_after_warranty' | 'all_at_completion';
export type RetentionReleaseStage = 'completion' | 'warranty_end';

export interface RetentionReleaseStep {
    stage: RetentionReleaseStage;
    amount: number;
    /** YYYY-MM-DD; null until the contract is completed (the dates count from completion). */
    dueAt: string | null;
}

export interface RetentionReleasePlan extends ArRetentionTotals {
    schedule: RetentionReleaseStep[];
}

/**
 * Ledger totals and the release plan of what is still held (withheld − forfeited), by `release`:
 * half at completion + rest after the warranty, all after the warranty, or all at completion. Releases already
 * recorded are taken off the earliest stage first; fully released stages are left out. Labels come from i18n
 * (`stage`), not from here.
 */
export function retentionReleasePlan(
    entries: readonly ArRetentionMove[],
    opts: { release: RetentionRelease; completedAt: string | null; warrantyMonths: number },
): RetentionReleasePlan {
    const totals = arRetentionTotals(entries);
    const held = round2(totals.withheld - totals.forfeited);
    const warrantyEnd = opts.completedAt === null ? null : addMonths(opts.completedAt, opts.warrantyMonths);
    const stages: RetentionReleaseStep[] =
        opts.release === 'all_at_completion'
            ? [{ stage: 'completion', amount: held, dueAt: opts.completedAt }]
            : opts.release === 'all_after_warranty'
              ? [{ stage: 'warranty_end', amount: held, dueAt: warrantyEnd }]
              : (() => {
                    const first = round2(held / 2);
                    return [
                        { stage: 'completion' as const, amount: first, dueAt: opts.completedAt },
                        { stage: 'warranty_end' as const, amount: round2(held - first), dueAt: warrantyEnd },
                    ];
                })();
    let released = totals.released;
    const schedule: RetentionReleaseStep[] = [];
    for (const s of stages) {
        const left = round2(Math.max(0, s.amount - released));
        released = round2(Math.max(0, released - s.amount));
        if (left > 0) schedule.push({ ...s, amount: left });
    }
    return { ...totals, schedule };
}
