// ─── Job cost: status of a cost code, a section or a project (docs/erp/02-domain-model.md §9) ───
// Pure. budget vs committed (open) vs actual vs EAC; level ok / warning (≤ 110 %) / critical.
import { round2, sumMoney } from '../money';
import { type ForecastInput, clampProgress, forecastOf } from './forecast';

export type CostLevel = 'ok' | 'warning' | 'critical';

/** EAC above budget × this factor is critical. */
export const CRITICAL_FACTOR = 1.1;

/** eac ≤ budget → ok; budget < eac ≤ budget × 1.1 → warning; above → critical (budget 0 and eac > 0 → critical). */
export function costLevel(budget: number, eac: number): CostLevel {
    const b = round2(budget);
    const e = round2(eac);
    if (e <= b) return 'ok';
    if (b <= 0) return 'critical';
    return e <= round2(b * CRITICAL_FACTOR) ? 'warning' : 'critical';
}

export interface CostCodeBudget {
    /** budget_total of the cost code (baseline + variations). */
    budget: number;
    /** Fraction 0–1 (reported progress when site-diary is active, else certified). */
    progress: number;
}

export interface LedgerFigures {
    committedOpen: number;
    actual: number;
}

export interface CostStatus {
    budget: number;
    committedOpen: number;
    actual: number;
    progress: number;
    earned: number;
    etc: number;
    eac: number;
    variance: number;
    level: CostLevel;
}

export function costStatus(costCode: CostCodeBudget, ledger: LedgerFigures, forecast?: ForecastInput | null): CostStatus {
    const budget = round2(costCode.budget);
    const progress = clampProgress(costCode.progress);
    const committedOpen = round2(ledger.committedOpen);
    const actual = round2(ledger.actual);
    const { etc, eac } = forecastOf(budget, progress, actual, committedOpen, forecast);
    return {
        budget, committedOpen, actual, progress, earned: round2(budget * progress), etc, eac,
        variance: round2(budget - eac), level: costLevel(budget, eac),
    };
}

/** Sum of several statuses (a section, the project): progress weighted by budget, level from the sums. */
export function sumCostStatus(items: readonly CostStatus[]): CostStatus {
    const budget = sumMoney(items.map(i => i.budget));
    const earned = sumMoney(items.map(i => i.earned));
    const eac = sumMoney(items.map(i => i.eac));
    return {
        budget,
        committedOpen: sumMoney(items.map(i => i.committedOpen)),
        actual: sumMoney(items.map(i => i.actual)),
        progress: budget > 0 ? Math.round((earned / budget) * 1e6) / 1e6 : 0,
        earned,
        etc: sumMoney(items.map(i => i.etc)),
        eac,
        variance: round2(budget - eac),
        level: costLevel(budget, eac),
    };
}
