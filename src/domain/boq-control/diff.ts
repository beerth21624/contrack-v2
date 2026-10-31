// ─── Compare two BOQ versions line by line and section by section (docs/erp/02-domain-model.md §1.10) ───
import { round2, roundQty } from '../money/money';
import type { BoqVersionLine, BoqVersionSection, BoqVersionTotals } from './version-lines';

export type BoqLineChange = 'added' | 'removed' | 'changed' | 'same';

export interface BoqLineDiff {
    lineKey: string;
    sectionNo: number;
    /** BOQ position (after's when the line is in both). */
    sort: number;
    change: BoqLineChange;
    before?: BoqVersionLine;
    after?: BoqVersionLine;
    /** after − before (a missing side counts as 0). */
    deltaQty: number;
    deltaTotal: number;
}

export interface BoqSectionDiff {
    no: number;
    titleTh: string;
    inConstructionTotal: boolean;
    before: number;
    after: number;
    delta: number;
}

export interface BoqTotalsDiff {
    before: Omit<BoqVersionTotals, 'lineCount'>;
    after: Omit<BoqVersionTotals, 'lineCount'>;
    delta: Omit<BoqVersionTotals, 'lineCount'>;
}

export interface BoqVersionDiff {
    sections: BoqSectionDiff[];
    lines: BoqLineDiff[];
    totals: BoqTotalsDiff;
    counts: Record<BoqLineChange, number>;
}

export interface BoqVersionSide {
    sections: readonly BoqVersionSection[];
    lines: readonly BoqVersionLine[];
}

/** Fields whose difference makes a line "changed" (descriptions follow the template and are compared too). */
function lineChanged(a: BoqVersionLine, b: BoqVersionLine): boolean {
    return a.qty !== b.qty || a.matUnit !== b.matUnit || a.labUnit !== b.labUnit || a.matTotal !== b.matTotal
        || a.labTotal !== b.labTotal || a.total !== b.total || a.unit !== b.unit || a.descTh !== b.descTh
        || a.grossQty !== b.grossQty || a.sectionNo !== b.sectionNo;
}

function totalsOf(side: BoqVersionSide): Omit<BoqVersionTotals, 'lineCount'> {
    let constructionTotal = 0, preConstructionTotal = 0, matTotal = 0, labTotal = 0;
    for (const s of side.sections) {
        if (s.inConstructionTotal) constructionTotal = round2(constructionTotal + s.total);
        else preConstructionTotal = round2(preConstructionTotal + s.total);
        matTotal = round2(matTotal + s.matTotal);
        labTotal = round2(labTotal + s.labTotal);
    }
    return { constructionTotal, preConstructionTotal, matTotal, labTotal };
}

/** `a` = before (the older / "from" version), `b` = after. Lines in BOQ order (after's position when it has one). */
export function diffBoqVersions(a: BoqVersionSide, b: BoqVersionSide): BoqVersionDiff {
    const before = new Map(a.lines.map(l => [l.lineKey, l]));
    const after = new Map(b.lines.map(l => [l.lineKey, l]));
    // Each key once, with the line that places it (after's when the line is in both).
    const refs = new Map<string, BoqVersionLine>();
    for (const l of [...b.lines, ...a.lines]) if (!refs.has(l.lineKey)) refs.set(l.lineKey, l);
    const counts: Record<BoqLineChange, number> = { added: 0, removed: 0, changed: 0, same: 0 };
    const lines: BoqLineDiff[] = [...refs].map(([lineKey, ref]) => {
        const x = before.get(lineKey);
        const y = after.get(lineKey);
        const change: BoqLineChange = x === undefined ? 'added' : y === undefined ? 'removed' : lineChanged(x, y) ? 'changed' : 'same';
        counts[change] += 1;
        return {
            lineKey,
            sectionNo: ref.sectionNo,
            sort: ref.sort,
            change,
            ...(x !== undefined ? { before: x } : {}),
            ...(y !== undefined ? { after: y } : {}),
            deltaQty: roundQty((y?.qty ?? 0) - (x?.qty ?? 0)),
            deltaTotal: round2((y?.total ?? 0) - (x?.total ?? 0)),
        };
    });
    lines.sort((p, q) => p.sectionNo - q.sectionNo || p.sort - q.sort);

    const sa = new Map(a.sections.map(s => [s.sectionNo, s]));
    const sb = new Map(b.sections.map(s => [s.sectionNo, s]));
    const sectionRefs = new Map<number, BoqVersionSection>();
    for (const s of [...b.sections, ...a.sections]) if (!sectionRefs.has(s.sectionNo)) sectionRefs.set(s.sectionNo, s);
    const sections: BoqSectionDiff[] = [...sectionRefs].sort(([p], [q]) => p - q).map(([no, ref]) => {
        const x = sa.get(no);
        const y = sb.get(no);
        const bTotal = x?.total ?? 0;
        const aTotal = y?.total ?? 0;
        return { no, titleTh: ref.titleTh, inConstructionTotal: ref.inConstructionTotal, before: bTotal, after: aTotal, delta: round2(aTotal - bTotal) };
    });

    const tb = totalsOf(a);
    const ta = totalsOf(b);
    return {
        sections,
        lines,
        totals: {
            before: tb,
            after: ta,
            delta: {
                constructionTotal: round2(ta.constructionTotal - tb.constructionTotal),
                preConstructionTotal: round2(ta.preConstructionTotal - tb.preConstructionTotal),
                matTotal: round2(ta.matTotal - tb.matTotal),
                labTotal: round2(ta.labTotal - tb.labTotal),
            },
        },
        counts,
    };
}
