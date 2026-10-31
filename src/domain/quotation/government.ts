// ─── Government quotation (ปร.4 / ปร.5 / ปร.6) (docs/erp/02-domain-model.md §2 rule 4, D-12, D-40) ───
// Sections carry no markup (ปร.4 shows unit costs); each part is priced as round2(Σ cost × Factor F), VAT included.
// Factor F is typed per part by the user (the official table is not built in, D-12).
import { allocate, round2, sumMoney } from '../money/money';
import { spreadSell, type CostedSection } from './costing';
import type {
    QuotationLine, QuotationPart, QuotationPartTotal, QuotationPricing, QuotationPricingIssue, QuotationSection,
    QuotationSectionInput,
} from './types';

const weight = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/** Rules of a government quotation: VAT inside Factor F, no discount or rounding, each included section in exactly one part. */
export function governmentIssues(pricing: QuotationPricing, sections: readonly QuotationSectionInput[]): QuotationPricingIssue[] {
    const issues: QuotationPricingIssue[] = [];
    if (pricing.vatMode !== 'included_in_factor') issues.push({ reason: 'government_requires_included_vat', path: ['pricing', 'vatMode'] });
    if (pricing.discount !== null && pricing.discount.value !== 0) issues.push({ reason: 'government_with_discount', path: ['pricing', 'discount'] });
    if (pricing.rounding !== 'none') issues.push({ reason: 'government_with_rounding', path: ['pricing', 'rounding'] });
    if (pricing.parts.length === 0) {
        issues.push({ reason: 'government_without_parts', path: ['pricing', 'parts'] });
        return issues;
    }
    const known = new Set(sections.map(s => s.sectionNo));
    const keys = new Set<string>();
    const owners = new Map<number, number>();
    pricing.parts.forEach((p, i) => {
        if (keys.has(p.key)) issues.push({ reason: 'government_duplicate_part', path: ['pricing', 'parts', i, 'key'] });
        keys.add(p.key);
        if (!Number.isFinite(p.factorF) || p.factorF <= 0) issues.push({ reason: 'government_bad_factor', path: ['pricing', 'parts', i, 'factorF'] });
        for (const no of new Set(p.sectionNos)) {
            if (!known.has(no)) issues.push({ reason: 'government_unknown_section', path: ['pricing', 'parts', i, 'sectionNos'] });
            owners.set(no, (owners.get(no) ?? 0) + 1);
        }
    });
    sections.forEach((s, i) => {
        if (!s.included) return;
        const n = owners.get(s.sectionNo) ?? 0;
        if (n === 0) issues.push({ reason: 'government_section_without_part', path: ['sections', i] });
        if (n > 1) issues.push({ reason: 'government_section_in_many_parts', path: ['sections', i] });
    });
    return issues;
}

/**
 * partSell = round2(Σ cost of the part's included sections × F); section sell = allocate(partSell, section costs);
 * line sell = allocate(section sell, line costs). Sections left out of the quotation sell 0. Expects the parts to
 * have passed governmentIssues.
 */
export function priceGovernment(costed: readonly CostedSection[], parts: readonly QuotationPart[]): {
    sections: QuotationSection[]; lines: QuotationLine[]; parts: QuotationPartTotal[];
} {
    const sellOf = new Map<number, number>();
    const partTotals: QuotationPartTotal[] = parts.map(p => {
        const members = new Set(p.sectionNos);
        const own = costed.filter(c => c.section.included && members.has(c.section.sectionNo));
        const cost = sumMoney(own.map(c => c.costTotal));
        const sell = round2(cost * p.factorF);
        const shares = allocate(sell, own.map(c => weight(c.costTotal)));
        own.forEach((c, i) => sellOf.set(c.section.sectionNo, shares[i] ?? 0));
        return { key: p.key, titleTh: p.titleTh, titleEn: p.titleEn, sectionNos: [...p.sectionNos], factorF: p.factorF, cost, sell };
    });
    const sections: QuotationSection[] = [];
    const lines: QuotationLine[] = [];
    for (const c of costed) {
        const sellTotal = c.section.included ? (sellOf.get(c.section.sectionNo) ?? 0) : 0;
        // ปร.4 prints unit costs: sell units = cost units (factor 1); amounts follow the part's Factor F.
        lines.push(...spreadSell(c.lines, sellTotal, 1));
        sections.push({
            ...c.section, markupRate: 0, overheadRate: 0, profitRate: 0,
            costMat: c.costMat, costLab: c.costLab, costTotal: c.costTotal, sellTotal,
        });
    }
    return { sections, lines, parts: partTotals };
}

/** One part holding every included section (Factor F 1 until the user types the official one). */
export function defaultGovernmentParts(sections: readonly QuotationSectionInput[]): QuotationPart[] {
    return [{
        key: 'main',
        titleTh: 'ค่าก่อสร้าง',
        titleEn: 'Construction works',
        sectionNos: sections.filter(s => s.included).map(s => s.sectionNo),
        factorF: 1,
    }];
}
