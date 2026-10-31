// ─── Quotation line costing shared by the pricing rules (docs/erp/02-domain-model.md §2) ───
import { allocate, round2, roundQty, sumMoney } from '../money/money';
import type { QuotationLine, QuotationLineInput, QuotationSectionInput } from './types';

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);
const weight = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/** A line with its cost settled and its material share (for the section's cost_mat / cost_lab). */
export type CostedLine = QuotationLineInput & { costMat: number };

/** Cost of a typed line: qty × (material + labour unit cost). */
export function lineCostAmount(qty: number, costMatUnit: number, costLabUnit: number): number {
    return round2(finite(qty) * (finite(costMatUnit) + finite(costLabUnit)));
}

/** Lines costed by kind: BOQ lines keep their BOQ total, typed lines are recomputed, notes carry nothing. */
export function costedLine(l: QuotationLineInput): CostedLine {
    if (l.kind === 'note') return { ...l, qty: roundQty(finite(l.qty)), costMatUnit: 0, costLabUnit: 0, costAmount: 0, costMat: 0 };
    const qty = roundQty(finite(l.qty));
    const costMatUnit = roundQty(finite(l.costMatUnit));
    const costLabUnit = roundQty(finite(l.costLabUnit));
    const costAmount = l.kind === 'custom' ? lineCostAmount(qty, costMatUnit, costLabUnit) : round2(finite(l.costAmount));
    const mat = round2(qty * costMatUnit);
    return { ...l, qty, costMatUnit, costLabUnit, costAmount, costMat: mat };
}

/**
 * Spreads a section's sell total over its priced lines by cost (notes get 0). Unit prices: `factor` × cost units
 * (per_category / lump_sum, informative only) or the cost units themselves (government ปร.4).
 */
export function spreadSell(lines: readonly CostedLine[], sellTotal: number, factor: number): QuotationLine[] {
    const priced = lines.filter(l => l.kind !== 'note');
    const amounts = allocate(sellTotal, priced.map(l => weight(l.costAmount)));
    let i = 0;
    return lines.map(({ costMat: _costMat, ...l }) => {
        if (l.kind === 'note') return { ...l, sellMatUnit: 0, sellLabUnit: 0, sellUnit: 0, sellAmount: 0 };
        const sellMatUnit = round2(l.costMatUnit * factor);
        const sellLabUnit = round2(l.costLabUnit * factor);
        const sellAmount = amounts[i] ?? 0;
        i += 1;
        return { ...l, sellMatUnit, sellLabUnit, sellUnit: round2(sellMatUnit + sellLabUnit), sellAmount };
    });
}

export interface CostedSection {
    section: QuotationSectionInput;
    lines: CostedLine[];
    costMat: number;
    costLab: number;
    costTotal: number;
}

/** Lines of each section (sorted), with the section's costs. */
export function costSections(sections: readonly QuotationSectionInput[], lines: readonly QuotationLineInput[]): CostedSection[] {
    const bySection = new Map<number, CostedLine[]>();
    for (const l of lines) {
        const list = bySection.get(l.sectionNo) ?? [];
        list.push(costedLine(l));
        bySection.set(l.sectionNo, list);
    }
    return [...sections].sort((a, b) => a.sort - b.sort || a.sectionNo - b.sectionNo).map(section => {
        const own = (bySection.get(section.sectionNo) ?? []).sort((a, b) => a.sort - b.sort);
        const costTotal = sumMoney(own.map(l => l.costAmount));
        const costMat = sumMoney(own.map(l => l.costMat));
        return { section, lines: own, costMat, costLab: round2(costTotal - costMat), costTotal };
    });
}
