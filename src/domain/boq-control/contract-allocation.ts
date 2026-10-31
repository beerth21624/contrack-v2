// ─── Selling value per cost code (docs/erp/02-domain-model.md §1.10, D-39) ───
// Pure. `contract_amount[] = allocate(original_value, weights)`, so Σ contract_amount = the value passed in exactly.
// With quotation lines: weights = sell amount of each line (kind 'boq' | 'custom' of included sections), matched to a
// baseline cost code by line_key; a line with no line_key or no baseline cost code becomes a new manual cost code.
// Without quotation lines: weights = baseline_total of the active baseline cost codes (equal split when Σ = 0).
import { allocate } from '../money/money';

export interface AllocationCostCode {
    id: string;
    lineKey: string | null;
    baselineTotal: number;
    source: 'baseline' | 'variation' | 'manual';
    status: 'active' | 'omitted';
}

export interface AllocationLine {
    lineKey: string | null;
    /** Sell amount of the line (negative weights count as 0). */
    weight: number;
}

export interface ContractAllocation {
    /** contract_amount of every cost code passed in (0 when nothing maps to it). */
    amounts: Map<string, number>;
    /** Lines (index into the given lines) that match no baseline cost code: one new manual cost code each. */
    unmatched: { index: number; amount: number }[];
    /** Active baseline cost codes without a quotation line (they get 0; the sign dialog warns about them). */
    uncoveredCount: number;
    /** false when there was nothing to allocate to (no lines and no active cost code). */
    allocated: boolean;
}

const weightOf = (w: number): number => (Number.isFinite(w) && w > 0 ? w : 0);

export function allocateContractAmounts(
    total: number, costCodes: readonly AllocationCostCode[], lines?: readonly AllocationLine[],
): ContractAllocation {
    const amounts = new Map<string, number>(costCodes.map(c => [c.id, 0]));
    const baseline = costCodes.filter(c => c.source === 'baseline' && c.status === 'active');

    if (lines !== undefined && lines.length > 0) {
        const parts = allocate(total, lines.map(l => weightOf(l.weight)));
        const byKey = new Map<string, AllocationCostCode>();
        for (const c of baseline) if (c.lineKey !== null && !byKey.has(c.lineKey)) byKey.set(c.lineKey, c);
        const covered = new Set<string>();
        const unmatched: ContractAllocation['unmatched'] = [];
        lines.forEach((line, index) => {
            const amount = parts[index] ?? 0;
            const code = line.lineKey === null ? undefined : byKey.get(line.lineKey);
            if (code === undefined) {
                unmatched.push({ index, amount });
                return;
            }
            covered.add(code.id);
            // Sum in satang so two lines of one cost code add up exactly.
            amounts.set(code.id, Math.round(((amounts.get(code.id) ?? 0) + amount) * 100) / 100);
        });
        return { amounts, unmatched, uncoveredCount: baseline.filter(c => !covered.has(c.id)).length, allocated: true };
    }

    const targets = baseline.length > 0 ? baseline : costCodes.filter(c => c.status === 'active');
    if (targets.length === 0) return { amounts, unmatched: [], uncoveredCount: 0, allocated: false };
    const parts = allocate(total, targets.map(c => weightOf(c.baselineTotal)));
    targets.forEach((c, i) => amounts.set(c.id, parts[i] ?? 0));
    return { amounts, unmatched: [], uncoveredCount: 0, allocated: true };
}
