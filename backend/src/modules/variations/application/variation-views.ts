// ─── Variation records → DTOs (costs left out for callers without `variations.manage`) ───
import { Injectable } from '@nestjs/common';
import type {
    VariationOrderDto, VariationOrderEvidenceDto, VariationOrderLineDto, VariationOrderSummaryDto,
} from '@contrack/contract';
import type { ProjectGrant } from '../../../shared/application/module-access';
import { CostCodeLookup, FileService } from '../../../shared/application/ports';
import { can } from '../../../shared/domain/permissions';
import type { VariationEvidenceRecord, VariationLineRecord, VariationRecord } from './ports/variation.repository';
import { VariationRepository } from './ports/variation.repository';

export interface ViewOptions {
    seesCost: boolean;
    canEdit: boolean;
}

export const seesCost = (grant: Pick<ProjectGrant, 'role'>): boolean => can(grant.role, 'variations.manage');

export const editOptions = (grant: ProjectGrant, v: VariationRecord): ViewOptions => ({
    seesCost: seesCost(grant),
    canEdit: v.status === 'draft' && can(grant.role, 'variations.manage') && !grant.archived,
});

function baseDto(v: VariationRecord, o: ViewOptions): Omit<VariationOrderSummaryDto, 'lineCount' | 'evidenceCount'> {
    return {
        id: v.id, projectId: v.projectId, contractId: v.contractId, seqNo: v.seqNo, number: v.number, title: v.title, reason: v.reason,
        requestedByName: v.requestedByName, requestedDate: v.requestedDate, status: v.status,
        ...(o.seesCost ? { costTotal: v.costTotal } : {}),
        sellTotal: v.sellTotal, vat: v.vat, scheduleImpactDays: v.scheduleImpactDays, billing: v.billing, language: v.language,
        submittedAt: v.submittedAt?.toISOString() ?? null, acceptedAt: v.acceptedAt?.toISOString() ?? null,
        acceptedByName: v.acceptedByName, responseNote: v.responseNote,
        createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
    };
}

export function summaryDto(v: VariationRecord, counts: { lines: number; evidence: number } | undefined, o: ViewOptions): VariationOrderSummaryDto {
    return { ...baseDto(v, o), lineCount: counts?.lines ?? 0, evidenceCount: counts?.evidence ?? 0 };
}

function lineDto(l: VariationLineRecord, code: string | null, o: ViewOptions): VariationOrderLineDto {
    return {
        id: l.id, costCodeId: l.costCodeId, costCode: code, sectionNo: l.sectionNo, lineKey: l.lineKey, descTh: l.descTh, descEn: l.descEn,
        unit: l.unit, qtyDelta: l.qtyDelta,
        ...(o.seesCost ? { costMatUnit: l.costMatUnit, costLabUnit: l.costLabUnit, costAmount: l.costAmount } : {}),
        sellUnit: l.sellUnit, sellAmount: l.sellAmount, source: l.source, sort: l.sort,
    };
}

@Injectable()
export class VariationViews {
    constructor(private readonly repo: VariationRepository, private readonly costCodes: CostCodeLookup, private readonly files: FileService) {}

    async detail(v: VariationRecord, o: ViewOptions): Promise<VariationOrderDto> {
        const lines = await this.repo.linesOf(v.workspaceId, v.id);
        const evidence = await this.repo.evidenceOf(v.workspaceId, v.id);
        const codeIds = [...new Set(lines.flatMap(l => (l.costCodeId === null ? [] : [l.costCodeId])))];
        const codes = new Map((codeIds.length === 0 ? [] : await this.costCodes.findMany(v.workspaceId, v.projectId, codeIds)).map(c => [c.id, c.code]));
        const fileIds = evidence.flatMap(e => (e.fileId === null ? [] : [e.fileId]));
        const files = new Map((fileIds.length === 0 ? [] : await this.files.describe(fileIds)).map(f => [f.id, f]));
        return {
            ...baseDto(v, o),
            sandbox: structuredClone(v.sandbox),
            customerSnapshot: v.customerSnapshot,
            lines: lines.map(l => lineDto(l, l.costCodeId === null ? null : codes.get(l.costCodeId) ?? null, o)),
            evidence: evidence.map((e: VariationEvidenceRecord): VariationOrderEvidenceDto => ({
                id: e.id, kind: e.kind, file: e.fileId === null ? null : files.get(e.fileId) ?? null, note: e.note,
                takenAt: e.takenAt?.toISOString() ?? null, authorUserId: e.authorUserId, createdAt: e.createdAt.toISOString(),
            })),
            canEdit: o.canEdit,
            createdBy: v.createdBy,
        };
    }
}
