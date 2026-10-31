// ─── Compare two quotation versions (docs/erp/02-domain-model.md §2 rule 7) ───
// Pure. Every delta is after − before, so before + delta = after for each section, line and total.
import { round2, roundQty } from '../money/money';
import type { QuotationLine, QuotationSection, QuotationTotals } from './types';

export type QuotationChange = 'added' | 'removed' | 'changed' | 'same';

export interface QuotationVersionSide {
    sections: readonly QuotationSection[];
    lines: readonly QuotationLine[];
    totals: QuotationTotals;
}

export interface QuotationSectionDelta {
    sectionNo: number;
    titleTh: string;
    titleEn: string;
    change: QuotationChange;
    before?: QuotationSection;
    after?: QuotationSection;
    /** Sell of the section when it is included in the quotation (0 when left out or missing). */
    sellBefore: number;
    sellAfter: number;
    deltaSell: number;
    deltaCost: number;
}

export interface QuotationLineDelta {
    /** lineKey, else the stored id, else `${sectionNo}:${sort}`. */
    key: string;
    sectionNo: number;
    change: QuotationChange;
    before?: QuotationLine;
    after?: QuotationLine;
    deltaQty: number;
    deltaSell: number;
    deltaCost: number;
}

export interface QuotationVersionComparison {
    sections: QuotationSectionDelta[];
    lines: QuotationLineDelta[];
    totals: { before: QuotationTotals; after: QuotationTotals; delta: QuotationTotals };
    counts: Record<QuotationChange, number>;
}

const lineKeyOf = (l: QuotationLine): string => l.lineKey ?? l.id ?? `${l.sectionNo}:${l.sort}`;
const includedSell = (s: QuotationSection | undefined): number => (s?.included ? s.sellTotal : 0);

function lineChanged(a: QuotationLine, b: QuotationLine): boolean {
    return a.qty !== b.qty || a.sellAmount !== b.sellAmount || a.costAmount !== b.costAmount || a.sellUnit !== b.sellUnit
        || a.descTh !== b.descTh || a.descEn !== b.descEn || a.unit !== b.unit || a.sectionNo !== b.sectionNo || a.kind !== b.kind;
}

function sectionChanged(a: QuotationSection, b: QuotationSection): boolean {
    return a.included !== b.included || a.sellTotal !== b.sellTotal || a.costTotal !== b.costTotal || a.titleTh !== b.titleTh
        || a.titleEn !== b.titleEn || a.markupRate !== b.markupRate || a.overheadRate !== b.overheadRate
        || a.profitRate !== b.profitRate || a.vatRate !== b.vatRate;
}

const TOTAL_KEYS = ['cost', 'sell', 'discount', 'roundingAdj', 'vatBase', 'vat', 'grandTotal', 'marginAmount', 'marginPct'] as const;

/** `a` = before (the older version), `b` = after. Sections and lines in after's order, removed ones after them. */
export function compareQuotationVersions(a: QuotationVersionSide, b: QuotationVersionSide): QuotationVersionComparison {
    const counts: Record<QuotationChange, number> = { added: 0, removed: 0, changed: 0, same: 0 };
    function change<T>(x: T | undefined, y: T | undefined, changed: (x: T, y: T) => boolean): QuotationChange {
        if (x === undefined) return 'added';
        if (y === undefined) return 'removed';
        return changed(x, y) ? 'changed' : 'same';
    }

    const sBefore = new Map(a.sections.map(s => [s.sectionNo, s]));
    const sAfter = new Map(b.sections.map(s => [s.sectionNo, s]));
    const sectionNos = [...new Set([...b.sections.map(s => s.sectionNo), ...a.sections.map(s => s.sectionNo)])];
    const sections = sectionNos.map((no): QuotationSectionDelta => {
        const x = sBefore.get(no);
        const y = sAfter.get(no);
        const ref = y ?? x;
        if (ref === undefined) throw new Error('unreachable');
        const sellBefore = includedSell(x);
        const sellAfter = includedSell(y);
        return {
            sectionNo: no,
            titleTh: ref.titleTh,
            titleEn: ref.titleEn,
            change: change(x, y, sectionChanged),
            ...(x !== undefined ? { before: x } : {}),
            ...(y !== undefined ? { after: y } : {}),
            sellBefore,
            sellAfter,
            deltaSell: round2(sellAfter - sellBefore),
            deltaCost: round2((y?.costTotal ?? 0) - (x?.costTotal ?? 0)),
        };
    });

    const lBefore = new Map(a.lines.map(l => [lineKeyOf(l), l]));
    const lAfter = new Map(b.lines.map(l => [lineKeyOf(l), l]));
    const lineKeys = [...new Set([...b.lines.map(lineKeyOf), ...a.lines.map(lineKeyOf)])];
    const lines = lineKeys.map((key): QuotationLineDelta => {
        const x = lBefore.get(key);
        const y = lAfter.get(key);
        const ref = y ?? x;
        if (ref === undefined) throw new Error('unreachable');
        const c = change(x, y, lineChanged);
        counts[c] += 1;
        return {
            key,
            sectionNo: ref.sectionNo,
            change: c,
            ...(x !== undefined ? { before: x } : {}),
            ...(y !== undefined ? { after: y } : {}),
            deltaQty: roundQty((y?.qty ?? 0) - (x?.qty ?? 0)),
            deltaSell: round2((y?.sellAmount ?? 0) - (x?.sellAmount ?? 0)),
            deltaCost: round2((y?.costAmount ?? 0) - (x?.costAmount ?? 0)),
        };
    });

    const delta = Object.fromEntries(TOTAL_KEYS.map(k => [
        k, k === 'marginPct' ? Math.round((b.totals[k] - a.totals[k]) * 1e6) / 1e6 : round2(b.totals[k] - a.totals[k]),
    ])) as unknown as QuotationTotals;
    return { sections, lines, totals: { before: a.totals, after: b.totals, delta }, counts };
}
