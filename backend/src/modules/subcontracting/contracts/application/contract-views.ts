// ─── Subcontract entities → contract DTOs (dates → ISO strings, files → fresh signed links) ───
import { Injectable } from '@nestjs/common';
import type {
    ClaimDto, FileDto, RetentionEntryDto, SubcontractDto, SubcontractSummaryDto, VariationDto,
} from '@contrack/contract';
import { FileService } from '../../../../shared/application/ports';
import type { SubcontractId } from '../../shared/ids';
import { ScAccess } from '../../shared/sc-access';
import type { Claim, Side } from '../domain/entities/claim.entity';
import type { RetentionEntry } from '../domain/entities/contract-records.entity';
import type { Subcontract } from '../domain/entities/subcontract.entity';
import type { Variation } from '../domain/entities/variation.entity';
import {
    installmentStates, nextInstallmentOf, paidTotal, pendingActionOf, retentionOf,
} from './contract-state';
import { ClaimRepository } from './ports/claim.repository';
import { ContractDocumentRepository } from './ports/contract-document.repository';
import { RatingRepository } from './ports/rating.repository';
import { RetentionRepository } from './ports/retention.repository';
import { VariationRepository } from './ports/variation.repository';

/** Who reads a view: the side, and whether money may be shown (a buyer member without sc.readPrices sees 0 / null). */
export interface Viewer {
    side: Side;
    seesPrices: boolean;
}

/** Variations without money (buyer member without sc.readPrices). */
export function maskVariation(v: VariationDto): VariationDto {
    return { ...v, amount: 0, lines: v.lines.map(l => ({ ...l, unitPrice: 0, total: 0 })) };
}

export function maskRetentionEntry(e: RetentionEntryDto): RetentionEntryDto {
    return { ...e, amount: 0 };
}

export function maskClaim(c: ClaimDto): ClaimDto {
    return {
        ...c,
        amounts: { gross: 0, adjustments: c.amounts.adjustments.map(a => ({ ...a, amount: 0 })), retention: 0, wht: 0, vat: 0, net: 0 },
        paidAmount: c.paidAmount === null ? null : 0,
    };
}

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

function groupBy<T>(items: readonly T[], key: (t: T) => SubcontractId): Map<SubcontractId, T[]> {
    const map = new Map<SubcontractId, T[]>();
    for (const item of items) {
        const k = key(item);
        const list = map.get(k);
        if (list === undefined) map.set(k, [item]);
        else list.push(item);
    }
    return map;
}

export function variationToDto(v: Variation): VariationDto {
    const s = v.state;
    return {
        id: s.id,
        proposedBy: s.proposedBy,
        lines: s.lines.map(l => ({ ...l })),
        amount: s.amount,
        reason: s.reason,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        decidedAt: iso(s.decidedAt),
    };
}

export function retentionEntryToDto(e: RetentionEntry): RetentionEntryDto {
    return { id: e.id, kind: e.kind, amount: e.amount, claimId: e.claimId, note: e.note, at: e.createdAt.toISOString() };
}

export function claimToDto(c: Claim, photos: readonly FileDto[]): ClaimDto {
    const s = c.state;
    return {
        id: s.id,
        subcontractId: s.subcontractId,
        installmentNo: s.installmentNo,
        condition: s.condition,
        status: s.status,
        requestedBy: s.requestedBy,
        requestedAt: s.requestedAt.toISOString(),
        note: s.note,
        photos: [...photos],
        inspection: s.inspection === null ? null : {
            result: s.inspection.result,
            checklist: s.inspection.checklist.map(x => ({ ...x })),
            fixes: s.inspection.fixes.map(x => ({ ...x })),
            note: s.inspection.note,
            byName: s.inspection.byName,
            at: s.inspection.at.toISOString(),
        },
        amounts: { ...s.amounts, adjustments: s.amounts.adjustments.map(a => ({ ...a })) },
        approvedAt: iso(s.approvedAt),
        paidAt: s.paidAt,
        paidAmount: s.paidAmount,
        paidChannel: s.paidChannel,
        paidRef: s.paidRef,
        rejectedReason: s.rejectedReason,
    };
}

@Injectable()
export class ContractViews {
    constructor(
        private readonly claims: ClaimRepository,
        private readonly retention: RetentionRepository,
        private readonly variations: VariationRepository,
        private readonly documents: ContractDocumentRepository,
        private readonly ratings: RatingRepository,
        private readonly files: FileService,
        private readonly access: ScAccess,
    ) {}

    private summaryOf(
        sc: Subcontract, claims: readonly Claim[], entries: readonly RetentionEntry[], variations: readonly Variation[], viewer: Viewer,
    ): SubcontractSummaryDto {
        const s = sc.state;
        const money = (v: number): number => (viewer.seesPrices ? v : 0);
        return {
            id: s.id,
            contractNo: s.contractNo,
            projectId: s.projectId,
            projectName: s.projectName,
            packageId: s.packageId,
            buyerWorkspaceId: s.buyerWorkspaceId,
            buyerName: s.buyerName,
            vendorWorkspaceId: s.vendorWorkspaceId,
            vendorName: s.vendorName,
            title: s.title,
            trade: s.trade,
            status: s.status,
            total: money(s.total),
            paidTotal: money(paidTotal(claims)),
            retentionBalance: money(retentionOf(sc, entries).balance),
            nextInstallment: nextInstallmentOf(sc, claims),
            pendingAction: pendingActionOf(sc, claims, variations, viewer.side),
            createdAt: s.createdAt.toISOString(),
        };
    }

    async summaries(list: readonly Subcontract[], viewer: Viewer): Promise<SubcontractSummaryDto[]> {
        const ids = list.map(s => s.id);
        const [claims, entries, variations] = await Promise.all([
            this.claims.listBySubcontracts(ids), this.retention.listBySubcontracts(ids), this.variations.listBySubcontracts(ids),
        ]);
        const c = groupBy(claims, x => x.subcontractId);
        const r = groupBy(entries, x => x.subcontractId);
        const v = groupBy(variations, x => x.subcontractId);
        return list.map(sc => this.summaryOf(sc, c.get(sc.id) ?? [], r.get(sc.id) ?? [], v.get(sc.id) ?? [], viewer));
    }

    async detail(sc: Subcontract, viewer: Viewer): Promise<SubcontractDto> {
        const ids = [sc.id];
        const side = viewer.side;
        const shown = viewer.seesPrices;
        const [claims, entries, variations, changeRequests, myRating, scan] = await Promise.all([
            this.claims.listBySubcontracts(ids),
            this.retention.listBySubcontracts(ids),
            this.variations.listBySubcontracts(ids),
            this.documents.listChangeRequests(sc.id),
            this.ratings.find(sc.id, side),
            sc.state.signedScanFileId === null ? Promise.resolve([]) : this.files.describe([sc.state.signedScanFileId]),
        ]);
        const s = sc.state;
        const retention = retentionOf(sc, entries);
        return {
            ...this.summaryOf(sc, claims, entries, variations, viewer),
            location: { ...s.location },
            lines: s.lines.map(l => ({
                idx: l.idx, desc: l.desc, unit: l.unit, qty: l.qty,
                unitPrice: shown ? l.unitPrice : null, matUnitPrice: shown ? l.matUnitPrice : null, total: shown ? l.total : 0,
            })),
            baseTotal: shown ? s.baseTotal : 0,
            variationsTotal: shown ? s.variationsTotal : 0,
            terms: structuredClone(s.terms),
            schedule: { ...s.schedule },
            installments: installmentStates(sc, claims).map(i => (shown ? i : { ...i, amount: 0 })),
            documentVersion: s.documentVersion,
            // Contracts are printed in the browser (Sarabun, print view): the server keeps no PDF.
            documentPdf: null,
            signedScan: scan[0] ?? null,
            acceptedAt: iso(s.acceptedAt),
            activatedAt: iso(s.activatedAt),
            completedAt: iso(s.completedAt),
            closedAt: iso(s.closedAt),
            cancelledAt: iso(s.cancelledAt),
            terminatedAt: iso(s.terminatedAt),
            endReason: s.endReason,
            changeRequests: changeRequests.map(c => ({ text: c.text, at: c.createdAt.toISOString(), resolved: c.resolvedAt !== null })),
            retention: shown ? retention : {
                withheld: 0, released: 0, forfeited: 0, balance: 0, schedule: retention.schedule.map(x => ({ ...x, amount: 0 })),
            },
            myRating: { submitted: myRating !== undefined },
            viewerSide: side,
            buyerModuleOn: (await this.access.buyerModuleOn(sc.buyerWorkspaceId)).ok,
        };
    }

    async claimDtos(claims: readonly Claim[], seesPrices = true): Promise<ClaimDto[]> {
        const ids = [...new Set(claims.flatMap(c => c.state.photoFileIds))];
        const files = new Map((await this.files.describe(ids)).map(f => [f.id, f]));
        return claims.map(c => {
            const dto = claimToDto(c, c.state.photoFileIds.map(id => files.get(id)).filter((f): f is FileDto => f !== undefined));
            return seesPrices ? dto : maskClaim(dto);
        });
    }

    async claimDto(claim: Claim, seesPrices = true): Promise<ClaimDto> {
        const [dto] = await this.claimDtos([claim], seesPrices);
        if (dto === undefined) throw new Error('claim dto missing');
        return dto;
    }
}
