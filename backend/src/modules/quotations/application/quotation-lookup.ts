// ─── QuotationLookup (port in shared/application/ports.ts): accepted quotations as main-contracts reads them (WP-26) ───
// QuotationPricingLookup: sell factors per section for variation orders (WP-33).
import { Injectable } from '@nestjs/common';
import { DEFAULT_QUOTATION_RATES, sellFactor } from '@contrack/domain/quotation';
import {
    type AcceptedQuotation, type CostCodeContractLine, QuotationLookup, QuotationPricingLookup, type QuotationSellFactors,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import { type WorkspaceId, isUuid } from '../../../shared/domain/ids';
import { type Result, err, ok } from '../../../shared/domain/result';
import { QuotationRepository } from './ports/quotation.repository';

@Injectable()
export class RepositoryQuotationLookup extends QuotationLookup {
    constructor(private readonly repo: QuotationRepository) {
        super();
    }

    async accepted(workspaceId: WorkspaceId, quotationId: string): Promise<Result<AcceptedQuotation, DomainError>> {
        if (!isUuid(quotationId)) return err(DomainError.notFound('Quotation'));
        const q = await this.repo.findQuotation(quotationId.toLowerCase());
        if (q?.workspaceId !== workspaceId) return err(DomainError.notFound('Quotation'));
        const v = q.acceptedVersionId === null ? undefined : await this.repo.findVersion(q.acceptedVersionId);
        if (v?.workspaceId !== workspaceId || v.status !== 'accepted') {
            return err(DomainError.conflict('The quotation has no accepted version', { reason: 'quotation_not_accepted' }));
        }
        return ok({
            quotationId: q.id, versionId: v.id, projectId: q.projectId, customerId: q.customerId, title: q.title,
            number: v.number, language: v.language, boqVersionId: v.boqVersionId, vatBase: v.totals.vatBase, vat: v.totals.vat,
            grandTotal: v.totals.grandTotal, marginPct: v.totals.marginPct, paymentTerms: v.paymentTerms.map(t => ({ ...t })),
        });
    }

    async contractLines(workspaceId: WorkspaceId, versionId: string): Promise<CostCodeContractLine[]> {
        const v = await this.repo.findVersion(versionId);
        if (v?.workspaceId !== workspaceId) return [];
        const rows = await this.repo.rows(workspaceId, v.id);
        const included = new Set(rows.sections.filter(s => s.included).map(s => s.sectionNo));
        return rows.lines
            .filter(l => (l.kind === 'boq' || l.kind === 'custom') && included.has(l.sectionNo))
            .map(l => ({ lineKey: l.lineKey, sectionNo: l.sectionNo, descTh: l.descTh, descEn: l.descEn, unit: l.unit, sellAmount: l.sellAmount }));
    }
}

/** QuotationPricingLookup (port): sell factors of a version's sections for VO pricing (WP-33). */
@Injectable()
export class RepositoryQuotationPricingLookup extends QuotationPricingLookup {
    constructor(private readonly repo: QuotationRepository) {
        super();
    }

    async sellFactors(workspaceId: WorkspaceId, quotationVersionId: string | null): Promise<QuotationSellFactors> {
        const defaults: QuotationSellFactors = { bySection: {}, fallback: sellFactor(DEFAULT_QUOTATION_RATES) };
        if (quotationVersionId === null || !isUuid(quotationVersionId)) return defaults;
        const v = await this.repo.findVersion(quotationVersionId.toLowerCase());
        if (v?.workspaceId !== workspaceId) return defaults;
        const rows = await this.repo.rows(workspaceId, v.id);
        const bySection: Record<number, number> = {};
        if (v.format === 'government') {
            // Factor F includes VAT (D-40): the VO price is without VAT, like the contract value (vatBase).
            const vat = 1 + (Number.isFinite(v.pricing.vatRate) ? v.pricing.vatRate : 0);
            let fallback = 1 / vat;
            for (const part of v.pricing.parts) {
                for (const no of part.sectionNos) bySection[no] = part.factorF / vat;
                fallback = part.factorF / vat;
            }
            return { bySection, fallback };
        }
        for (const s of rows.sections) bySection[s.sectionNo] = sellFactor(s);
        return { bySection, fallback: sellFactor(v.pricing.defaults) };
    }
}
