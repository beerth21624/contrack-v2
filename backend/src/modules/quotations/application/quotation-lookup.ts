// ─── QuotationLookup (port in shared/application/ports.ts): accepted quotations as main-contracts reads them (WP-26) ───
import { Injectable } from '@nestjs/common';
import { type AcceptedQuotation, type CostCodeContractLine, QuotationLookup } from '../../../shared/application/ports';
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
