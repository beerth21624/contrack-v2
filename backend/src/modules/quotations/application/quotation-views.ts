// ─── Quotation records → DTOs. Without `quotations.seeMargins` (and on customer links) every cost / margin field and the
// section rates are left out of the object (not set to undefined), docs/erp/01-architecture.md §14.7. ───
import type {
    QuotationCompareDto, QuotationDto, QuotationLineDto, QuotationPartTotalDto, QuotationSectionDto, QuotationTotalsDto,
    QuotationVersionDto, QuotationVersionSummaryDto,
} from '@contrack/contract';
import type { QuotationSection, QuotationTotals, QuotationVersionComparison } from '@contrack/domain/quotation';
import { round2 } from '@contrack/domain/money/money';
import type { QuotationRecord, QuotationVersionRecord, QuotationVersionRows, StoredQuotationLine } from './ports/quotation.repository';

export function totalsDto(t: QuotationTotals, seesMargins: boolean): QuotationTotalsDto {
    const base = { sell: t.sell, discount: t.discount, roundingAdj: t.roundingAdj, vatBase: t.vatBase, vat: t.vat, grandTotal: t.grandTotal };
    return seesMargins ? { ...base, cost: t.cost, marginAmount: t.marginAmount, marginPct: t.marginPct } : base;
}

export function sectionDto(s: QuotationSection, seesMargins: boolean): QuotationSectionDto {
    const base = {
        sectionNo: s.sectionNo, titleTh: s.titleTh, titleEn: s.titleEn, included: s.included, sort: s.sort, vatRate: s.vatRate,
        sellTotal: s.sellTotal,
    };
    return seesMargins
        ? {
            ...base, markupRate: s.markupRate, overheadRate: s.overheadRate, profitRate: s.profitRate,
            costMat: s.costMat, costLab: s.costLab, costTotal: s.costTotal,
        }
        : base;
}

export function lineDto(l: StoredQuotationLine, seesMargins: boolean): QuotationLineDto {
    const base = {
        id: l.id, sectionNo: l.sectionNo, sort: l.sort, kind: l.kind, lineKey: l.lineKey, descTh: l.descTh, descEn: l.descEn,
        unit: l.unit, qty: l.qty, sellMatUnit: l.sellMatUnit, sellLabUnit: l.sellLabUnit, sellUnit: l.sellUnit, sellAmount: l.sellAmount,
    };
    return seesMargins ? { ...base, costMatUnit: l.costMatUnit, costLabUnit: l.costLabUnit, costAmount: l.costAmount } : base;
}

/** Government parts with their totals, from the stored sections (a part's sell = Σ sell of its included sections). */
export function partTotals(v: QuotationVersionRecord, sections: readonly QuotationSection[], seesMargins: boolean): QuotationPartTotalDto[] {
    if (v.format !== 'government') return [];
    return v.pricing.parts.map(p => {
        const own = sections.filter(s => s.included && p.sectionNos.includes(s.sectionNo));
        const sell = round2(own.reduce((sum, s) => sum + s.sellTotal, 0));
        const base = { key: p.key, titleTh: p.titleTh, titleEn: p.titleEn, sectionNos: [...p.sectionNos], factorF: p.factorF, sell };
        return seesMargins ? { ...base, cost: round2(own.reduce((sum, s) => sum + s.costTotal, 0)) } : base;
    });
}

export function versionSummaryDto(v: QuotationVersionRecord): QuotationVersionSummaryDto {
    return {
        id: v.id,
        quotationId: v.quotationId,
        projectId: v.projectId,
        versionNo: v.versionNo,
        status: v.status,
        number: v.number,
        boqVersionId: v.boqVersionId,
        format: v.format,
        detailLevel: v.detailLevel,
        language: v.language,
        issueDate: v.issueDate,
        validUntil: v.validUntil,
        vatBase: v.totals.vatBase,
        grandTotal: v.totals.grandTotal,
        issuedAt: v.issuedAt?.toISOString() ?? null,
        acceptedAt: v.acceptedAt?.toISOString() ?? null,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
    };
}

export function versionDto(
    q: QuotationRecord, v: QuotationVersionRecord, rows: QuotationVersionRows, opts: { seesMargins: boolean; canEdit: boolean },
): QuotationVersionDto {
    const { seesMargins } = opts;
    const { defaults, ...pricing } = v.pricing;
    return {
        ...versionSummaryDto(v),
        title: q.title,
        customerId: q.customerId,
        pricing: seesMargins ? { ...pricing, defaults } : pricing,
        totals: totalsDto(v.totals, seesMargins),
        sections: rows.sections.map(s => sectionDto(s, seesMargins)),
        lines: rows.lines.map(l => lineDto(l, seesMargins)),
        parts: partTotals(v, rows.sections, seesMargins),
        paymentTerms: v.paymentTerms,
        termsTh: v.termsTh,
        termsEn: v.termsEn,
        note: v.note,
        customerSnapshot: v.customerSnapshot,
        companySnapshot: v.companySnapshot,
        acceptedByName: v.acceptedByName,
        responseNote: v.responseNote,
        issuedBy: v.issuedBy,
        seesMargins,
        canEdit: opts.canEdit,
    };
}

export function quotationDto(q: QuotationRecord, versions: readonly QuotationVersionRecord[]): QuotationDto {
    return {
        id: q.id,
        workspaceId: q.workspaceId,
        projectId: q.projectId,
        customerId: q.customerId,
        title: q.title,
        number: q.number,
        currentVersionId: q.currentVersionId,
        acceptedVersionId: q.acceptedVersionId,
        versions: versions.filter(v => v.quotationId === q.id).sort((a, b) => a.versionNo - b.versionNo).map(versionSummaryDto),
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
    };
}

export function compareDto(
    from: QuotationVersionRecord, to: QuotationVersionRecord, c: QuotationVersionComparison, seesMargins: boolean,
): QuotationCompareDto {
    const line = (l: StoredQuotationLine | undefined): QuotationLineDto | undefined => (l === undefined ? undefined : lineDto(l, seesMargins));
    return {
        from: versionSummaryDto(from),
        to: versionSummaryDto(to),
        sections: c.sections.map(s => ({
            sectionNo: s.sectionNo, titleTh: s.titleTh, titleEn: s.titleEn, change: s.change,
            sellBefore: s.sellBefore, sellAfter: s.sellAfter, deltaSell: s.deltaSell,
            ...(seesMargins ? { deltaCost: s.deltaCost } : {}),
        })),
        lines: c.lines.map(l => {
            const before = line(l.before as StoredQuotationLine | undefined);
            const after = line(l.after as StoredQuotationLine | undefined);
            return {
                key: l.key, sectionNo: l.sectionNo, change: l.change,
                ...(before !== undefined ? { before } : {}),
                ...(after !== undefined ? { after } : {}),
                deltaQty: l.deltaQty, deltaSell: l.deltaSell,
                ...(seesMargins ? { deltaCost: l.deltaCost } : {}),
            };
        }),
        totals: {
            before: totalsDto(c.totals.before, seesMargins),
            after: totalsDto(c.totals.after, seesMargins),
            delta: totalsDto(c.totals.delta, seesMargins),
        },
        counts: c.counts,
    };
}
