// ─── Quotation pricing (docs/erp/02-domain-model.md §2, rules 1–5) ───
// Pure: the server stores what this returns and the editor previews with the same code, so both agree to the satang.
import { round2, sumMoney } from '../money/money';
import { splitVatInclusive } from '../money/tax';
import { costSections, spreadSell, type CostedLine } from './costing';
import { governmentIssues, priceGovernment } from './government';
import type {
    PricedQuotation, QuotationLine, QuotationPricingInput, QuotationPricingIssue, QuotationRates, QuotationSection,
    QuotationTotals, QuotationVatMode,
} from './types';

/** Starting rates of a new section: factor 1.3, the old CashFlow quotation factor (D-31). */
export const DEFAULT_QUOTATION_RATES: Readonly<QuotationRates> = { markupRate: 0, overheadRate: 0.15, profitRate: 0.15 };

export class QuotationPricingError extends Error {
    constructor(readonly issues: readonly QuotationPricingIssue[]) {
        super(`Invalid quotation pricing: ${issues.map(i => i.reason).join(', ')}`);
        this.name = 'QuotationPricingError';
    }
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);
const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Rule 1: 1 + markup + overhead + profit. */
export function sellFactor(r: QuotationRates): number {
    return 1 + finite(r.markupRate) + finite(r.overheadRate) + finite(r.profitRate);
}

/** Problems that do not depend on amounts (usable in a zod superRefine before pricing). */
export function quotationPricingIssues(input: Pick<QuotationPricingInput, 'format' | 'pricing' | 'sections' | 'lines'>): QuotationPricingIssue[] {
    const { format, pricing, sections, lines } = input;
    const issues: QuotationPricingIssue[] = [];
    const nos = new Set<number>();
    sections.forEach((s, i) => {
        if (nos.has(s.sectionNo)) issues.push({ reason: 'duplicate_section', path: ['sections', i] });
        nos.add(s.sectionNo);
    });
    lines.forEach((l, i) => {
        if (!nos.has(l.sectionNo)) issues.push({ reason: 'line_without_section', path: ['lines', i] });
    });
    const d = pricing.discount;
    if (d !== null && (!Number.isFinite(d.value) || d.value < 0 || (d.kind === 'pct' && d.value > 1))) {
        issues.push({ reason: 'discount_invalid', path: ['pricing', 'discount'] });
    }
    if (format === 'government') {
        issues.push(...governmentIssues(pricing, sections));
    } else {
        if (pricing.vatMode === 'included_in_factor') issues.push({ reason: 'included_vat_requires_government', path: ['pricing', 'vatMode'] });
        if (pricing.vatMode === 'per_category') {
            if (d !== null && d.value !== 0) issues.push({ reason: 'per_category_vat_with_discount', path: ['pricing', 'discount'] });
            if (pricing.rounding !== 'none') issues.push({ reason: 'per_category_vat_with_rounding', path: ['pricing', 'rounding'] });
        }
    }
    return issues;
}

/** Rule 2 (detail level 'full'): unit sell prices, line = qty × unit, section = Σ lines. */
function priceFull(lines: readonly CostedLine[], f: number): QuotationLine[] {
    return lines.map(({ costMat: _costMat, ...l }) => {
        if (l.kind === 'note') return { ...l, sellMatUnit: 0, sellLabUnit: 0, sellUnit: 0, sellAmount: 0 };
        const sellMatUnit = round2(l.costMatUnit * f);
        const sellLabUnit = round2(l.costLabUnit * f);
        const sellUnit = round2(sellMatUnit + sellLabUnit);
        return { ...l, sellMatUnit, sellLabUnit, sellUnit, sellAmount: round2(l.qty * sellUnit) };
    });
}

function vatOfMode(mode: QuotationVatMode, vatBase: number, vatRate: number, included: readonly QuotationSection[]): number {
    if (mode === 'document') return round2(vatBase * vatRate);
    if (mode === 'per_category') return sumMoney(included.map(s => round2(s.sellTotal * (s.vatRate ?? vatRate))));
    return 0;
}

function marginOf(vatBase: number, cost: number): { marginAmount: number; marginPct: number } {
    const marginAmount = round2(vatBase - cost);
    return { marginAmount, marginPct: vatBase > 0 ? round6(marginAmount / vatBase) : 0 };
}

const ROUNDING_STEP = { none: 0, to_100: 100, to_1000: 1000 } as const;

/**
 * Prices a quotation version: section and line sell amounts and the document totals. Throws QuotationPricingError
 * when the pricing is not allowed (see quotationPricingIssues) or the discount is larger than the subtotal.
 * Invariant (every mode): Σ line.sellAmount of a section = section.sellTotal.
 */
export function priceQuotation(input: QuotationPricingInput): PricedQuotation {
    const issues = quotationPricingIssues(input);
    if (issues.length > 0) throw new QuotationPricingError(issues);
    const { pricing, detailLevel, vatRegistered } = input;
    const costed = costSections(input.sections, input.lines);
    const vatRate = finite(pricing.vatRate);

    if (input.format === 'government') {
        const { sections, lines, parts } = priceGovernment(costed, pricing.parts);
        const included = sections.filter(s => s.included);
        const cost = sumMoney(included.map(s => s.costTotal));
        const grandTotal = sumMoney(parts.map(p => p.sell));
        const { net: vatBase, vat } = vatRegistered ? splitVatInclusive(grandTotal, vatRate) : { net: grandTotal, vat: 0 };
        const totals: QuotationTotals = {
            cost, sell: grandTotal, discount: 0, roundingAdj: 0, vatBase, vat, grandTotal, ...marginOf(vatBase, cost),
        };
        return { sections, lines, totals, parts, vatMode: vatRegistered ? 'included_in_factor' : 'none' };
    }

    const sections: QuotationSection[] = [];
    const lines: QuotationLine[] = [];
    for (const c of costed) {
        const f = sellFactor(c.section);
        const priced = detailLevel === 'full' ? priceFull(c.lines, f) : spreadSell(c.lines, round2(c.costTotal * f), f);
        const sellTotal = sumMoney(priced.map(l => l.sellAmount));
        sections.push({ ...c.section, costMat: c.costMat, costLab: c.costLab, costTotal: c.costTotal, sellTotal });
        lines.push(...priced);
    }
    const included = sections.filter(s => s.included);
    const subtotal = sumMoney(included.map(s => s.sellTotal));
    const d = pricing.discount;
    const discount = d === null ? 0 : d.kind === 'pct' ? round2(subtotal * d.value) : round2(d.value);
    if (discount > subtotal) throw new QuotationPricingError([{ reason: 'discount_exceeds_subtotal', path: ['pricing', 'discount'] }]);
    const afterDiscount = round2(subtotal - discount);
    const step = ROUNDING_STEP[pricing.rounding];
    const roundingAdj = step === 0 ? 0 : round2(Math.floor(afterDiscount / step + 1e-9) * step - afterDiscount);
    const vatBase = round2(afterDiscount + roundingAdj);
    const vatMode: QuotationVatMode = vatRegistered ? pricing.vatMode : 'none';
    const vat = vatOfMode(vatMode, vatBase, vatRate, included);
    const cost = sumMoney(included.map(s => s.costTotal));
    const totals: QuotationTotals = {
        cost, sell: subtotal, discount, roundingAdj, vatBase, vat, grandTotal: round2(vatBase + vat), ...marginOf(vatBase, cost),
    };
    return { sections, lines, totals, parts: [], vatMode };
}
