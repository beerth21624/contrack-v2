// ─── Job cost: projected profit of a project (docs/erp/02-domain-model.md §9) ───
// Pure. revenue = current contract value (without VAT); cost = Σ EAC of the cost codes + overhead.
import { round2 } from '../money';

export interface ProjectProfit {
    revenue: number;
    cost: number;
    profit: number;
    /** profit / revenue (6 decimals), null when revenue ≤ 0. */
    marginPct: number | null;
}

export function projectProfit(contractCurrentValue: number, sumEac: number, overhead: number): ProjectProfit {
    const revenue = round2(contractCurrentValue);
    const cost = round2(sumEac + overhead);
    const profit = round2(revenue - cost);
    return { revenue, cost, profit, marginPct: revenue > 0 ? Math.round((profit / revenue) * 1e6) / 1e6 : null };
}
