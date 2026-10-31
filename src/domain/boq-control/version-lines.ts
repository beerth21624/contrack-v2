// ─── BOQ version lines: the stored, rounded copy of a BOQ (docs/erp/02-domain-model.md §1.10) ───
// Pure. Only item rows with a quantity or an amount are kept; every amount is rounded per line (D-05), so a version's
// totals are the sums of its rounded lines and may differ from the BOQ page (which never rounds) by a few satang.
import type { BoqResult } from '../boq/types';
import { round2, roundQty, sumMoney } from '../money/money';

export interface BoqVersionLine {
    lineKey: string;
    sectionNo: number;
    /** Position of the line in the whole BOQ (template order). */
    sort: number;
    itemNo: string;
    descTh: string;
    unit: string;
    qty: number;
    grossQty: number | null;
    waste: number;
    matUnit: number;
    labUnit: number;
    matTotal: number;
    labTotal: number;
    total: number;
    materialBasis: 'gross' | 'net';
    labourBasis: 'gross' | 'net';
}

export interface BoqVersionSection {
    sectionNo: number;
    titleTh: string;
    inConstructionTotal: boolean;
    matTotal: number;
    labTotal: number;
    total: number;
}

export interface BoqVersionTotals {
    constructionTotal: number;
    preConstructionTotal: number;
    matTotal: number;
    labTotal: number;
    lineCount: number;
}

export interface BoqVersionContent {
    sections: BoqVersionSection[];
    lines: BoqVersionLine[];
    totals: BoqVersionTotals;
}

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const finite = (v: number): number => (Number.isFinite(v) ? v : 0);

/** Lines, section sums and totals of one BOQ (from `computeProject(project).boq`). */
export function boqVersionLines(boq: BoqResult): BoqVersionContent {
    const lines: BoqVersionLine[] = [];
    const sections: BoqVersionSection[] = [];
    const seen = new Set<string>();
    let sort = 0;
    for (const section of boq.sections) {
        const own: BoqVersionLine[] = [];
        for (const row of section.rows) {
            if (row.type !== 'item') continue;
            sort += 1;
            const qty = roundQty(finite(row.qty));
            const matTotal = round2(finite(row.matTotal));
            const labTotal = round2(finite(row.labTotal));
            const total = round2(matTotal + labTotal);
            if (qty === 0 && total === 0) continue;
            // Keys are unique in the template; a duplicate would break the (version, line) key, so it gets a suffix.
            let lineKey: string = row.key;
            for (let n = 2; seen.has(lineKey); n += 1) lineKey = `${row.key}#${n}`;
            seen.add(lineKey);
            own.push({
                lineKey,
                sectionNo: section.no,
                sort,
                itemNo: row.itemNo ?? '',
                descTh: row.desc,
                unit: row.unit,
                qty,
                grossQty: row.grossQty === null ? null : roundQty(finite(row.grossQty)),
                waste: round6(finite(row.waste)),
                matUnit: roundQty(finite(row.matUnit)),
                labUnit: roundQty(finite(row.labUnit)),
                matTotal,
                labTotal,
                total,
                materialBasis: row.materialBasis,
                labourBasis: row.labourBasis,
            });
        }
        const matTotal = sumMoney(own.map(l => l.matTotal));
        const labTotal = sumMoney(own.map(l => l.labTotal));
        sections.push({
            sectionNo: section.no,
            titleTh: section.title,
            inConstructionTotal: section.inConstructionTotal,
            matTotal,
            labTotal,
            total: round2(matTotal + labTotal),
        });
        lines.push(...own);
    }
    return {
        sections,
        lines,
        totals: {
            constructionTotal: sumMoney(sections.filter(s => s.inConstructionTotal).map(s => s.total)),
            preConstructionTotal: sumMoney(sections.filter(s => !s.inConstructionTotal).map(s => s.total)),
            matTotal: sumMoney(sections.map(s => s.matTotal)),
            labTotal: sumMoney(sections.map(s => s.labTotal)),
            lineCount: lines.length,
        },
    };
}
