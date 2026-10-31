// ─── Procurement records → DTOs ───
import { Injectable } from '@nestjs/common';
import type {
    PurchaseRequestDto, PurchaseRequestSummaryDto, RfqDto, RfqQuoteDto, RfqSummaryDto,
} from '@contrack/contract';
import type { ProjectGrant } from '../../../shared/application/module-access';
import { CostCodeLookup, FileService, SupplierLookup } from '../../../shared/application/ports';
import type { ProjectId, WorkspaceId } from '../../../shared/domain/ids';
import { can } from '../../../shared/domain/permissions';
import {
    PurchaseRequestRepository, type PurchaseRequestRecord, type RfqCounts, type RfqRecord, RfqRepository,
} from './ports/procurement.repository';

const requestBase = (r: PurchaseRequestRecord): Omit<PurchaseRequestSummaryDto, 'lineCount'> => ({
    id: r.id, projectId: r.projectId, number: r.number, status: r.status, source: r.source, requiredDate: r.requiredDate,
    requestedBy: r.requestedBy, note: r.note, estTotal: r.estTotal, budgetWarnings: structuredClone(r.budgetWarnings),
    overrideReason: r.overrideReason, submittedAt: r.submittedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
});

export const requestSummaryDto = (r: PurchaseRequestRecord, lineCount: number): PurchaseRequestSummaryDto => ({ ...requestBase(r), lineCount });

const rfqBase = (r: RfqRecord): Omit<RfqSummaryDto, 'lineCount' | 'supplierCount' | 'quoteCount'> => ({
    id: r.id, projectId: r.projectId, number: r.number, status: r.status, title: r.title, dueDate: r.dueDate,
    deliveryAddress: r.deliveryAddress, language: r.language, requestIds: [...r.requestIds], awardedSupplierId: r.awardedSupplierId,
    awardedAt: r.awardedAt?.toISOString() ?? null, sentAt: r.sentAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
});

export const rfqSummaryDto = (r: RfqRecord, c: RfqCounts | undefined): RfqSummaryDto => ({
    ...rfqBase(r), lineCount: c?.lines ?? 0, supplierCount: c?.suppliers ?? 0, quoteCount: c?.quotes ?? 0,
});

export const canEditRequest = (grant: ProjectGrant, r: PurchaseRequestRecord): boolean =>
    r.status === 'draft' && can(grant.role, 'procurement.request') && !grant.archived;

export const canEditRfq = (grant: ProjectGrant, r: RfqRecord): boolean =>
    r.status === 'draft' && can(grant.role, 'procurement.manage') && !grant.archived;

@Injectable()
export class ProcurementViews {
    constructor(
        private readonly requests: PurchaseRequestRepository,
        private readonly rfqs: RfqRepository,
        private readonly costCodes: CostCodeLookup,
        private readonly suppliers: SupplierLookup,
        private readonly files: FileService,
    ) {}

    private async codeNames(workspaceId: WorkspaceId, projectId: ProjectId, ids: readonly (string | null)[]): Promise<Map<string, string>> {
        const wanted = [...new Set(ids.flatMap(id => (id === null ? [] : [id])))];
        if (wanted.length === 0) return new Map();
        return new Map((await this.costCodes.findMany(workspaceId, projectId, wanted)).map(c => [c.id, c.code]));
    }

    async request(r: PurchaseRequestRecord, grant: ProjectGrant): Promise<PurchaseRequestDto> {
        const lines = await this.requests.linesOf(r.workspaceId, r.id);
        const codes = await this.codeNames(r.workspaceId, r.projectId, lines.map(l => l.costCodeId));
        return {
            ...requestBase(r),
            lines: lines.map(l => ({
                id: l.id, costCodeId: l.costCodeId, costCode: l.costCodeId === null ? null : codes.get(l.costCodeId) ?? null,
                descTh: l.descTh, descEn: l.descEn, unit: l.unit, qty: l.qty, estUnitPrice: l.estUnitPrice, estAmount: l.estAmount,
                orderedQty: l.orderedQty, note: l.note, sort: l.sort,
            })),
            canEdit: canEditRequest(grant, r),
        };
    }

    async rfq(r: RfqRecord, grant: ProjectGrant): Promise<RfqDto> {
        const ws = r.workspaceId;
        const lines = await this.rfqs.linesOf(ws, r.id);
        const invited = await this.rfqs.suppliersOf(ws, r.id);
        const quotes = await this.rfqs.quotesOf(ws, r.id);
        const codes = await this.codeNames(ws, r.projectId, lines.map(l => l.costCodeId));
        const suppliers = new Map((invited.length === 0 ? [] : await this.suppliers.findMany(ws, invited.map(s => s.supplierId))).map(s => [s.id, s]));
        const fileIds = [...new Set(quotes.flatMap(q => q.fileIds))];
        const files = new Map((fileIds.length === 0 ? [] : await this.files.describe(fileIds)).map(f => [f.id, f]));
        return {
            ...rfqBase(r),
            lines: lines.map(l => ({
                id: l.id, requestLineId: l.requestLineId, costCodeId: l.costCodeId,
                costCode: l.costCodeId === null ? null : codes.get(l.costCodeId) ?? null, descTh: l.descTh, descEn: l.descEn, unit: l.unit,
                qty: l.qty, budgetUnitPrice: l.budgetUnitPrice, sort: l.sort,
            })),
            suppliers: invited.map(s => {
                const sup = suppliers.get(s.supplierId);
                return {
                    supplierId: s.supplierId, nameTh: sup?.nameTh ?? '', nameEn: sup?.nameEn ?? '', phone: sup?.phone ?? '', email: sup?.email ?? '',
                    status: s.status, invitedAt: s.invitedAt.toISOString(), quotedAt: s.quotedAt?.toISOString() ?? null,
                };
            }),
            quotes: quotes.map((q): RfqQuoteDto => ({
                id: q.id, supplierId: q.supplierId, quoteRef: q.quoteRef, quoteDate: q.quoteDate, validUntil: q.validUntil,
                pricesIncludeVat: q.pricesIncludeVat, deliveryDays: q.deliveryDays, paymentTermDays: q.paymentTermDays,
                lines: structuredClone(q.lines), subtotal: q.subtotal, vat: q.vat, total: q.total,
                files: q.fileIds.flatMap(id => { const f = files.get(id); return f === undefined ? [] : [f]; }),
                note: q.note, updatedAt: q.updatedAt.toISOString(),
            })),
            canEdit: canEditRfq(grant, r),
            createdBy: r.createdBy,
        };
    }
}
