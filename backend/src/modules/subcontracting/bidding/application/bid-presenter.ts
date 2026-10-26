// ─── Bid → BidDto (photos get fresh signed links; `outdated` against the package's current version) ───
import { Injectable } from '@nestjs/common';
import type { BidDto, FileDto, NegotiationMessageDto } from '@contrack/contract';
import { FileService } from '../../../../shared/application/ports';
import type { Bid } from '../domain/entities/bid.entity';
import type { NegotiationMessage } from './ports/message.repository';

@Injectable()
export class BidPresenter {
    constructor(private readonly files: FileService) {}

    async one(bid: Bid, currentPackageVersion: number): Promise<BidDto> {
        const [dto] = await this.many([bid], currentPackageVersion);
        if (dto === undefined) throw new Error('presenter lost a bid');
        return dto;
    }

    async many(bids: readonly Bid[], currentPackageVersion: number): Promise<BidDto[]> {
        const ids = [...new Set(bids.flatMap(b => b.content.photoFileIds))];
        const files = new Map((ids.length === 0 ? [] : await this.files.describe(ids)).map(f => [f.id, f]));
        return bids.map(b => toDto(b, currentPackageVersion, files));
    }
}

function toDto(bid: Bid, currentPackageVersion: number, files: Map<string, FileDto>): BidDto {
    const p = bid.toProps();
    return {
        id: p.id,
        invitationId: p.invitationId,
        packageId: p.packageId,
        packageVersion: p.packageVersion,
        version: p.version,
        status: p.status,
        mode: p.mode,
        lines: p.lines.map(l => ({ idx: l.idx, unitPrice: l.unitPrice, matUnitPrice: l.matUnitPrice, excluded: l.excluded, reason: l.reason, total: l.total })),
        lumpTotal: p.lumpTotal,
        adjustment: p.adjustment,
        adjustmentNote: p.adjustmentNote,
        inclusions: p.inclusions,
        total: p.total,
        days: p.days,
        earliestStart: p.earliestStart,
        crewSkilled: p.crewSkilled,
        crewLabourers: p.crewLabourers,
        validUntil: p.validUntil,
        installmentsProposal: p.installmentsProposal,
        answers: p.answers,
        note: p.note,
        photos: p.photoFileIds.map(id => files.get(id)).filter((f): f is FileDto => f !== undefined),
        enteredByBuyer: p.enteredByBuyer,
        outdated: p.packageVersion < currentPackageVersion,
        submittedAt: p.submittedAt === null ? null : p.submittedAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    };
}

export function messageToDto(m: NegotiationMessage): NegotiationMessageDto {
    return { id: m.id, from: m.from, text: m.text, targetTotal: m.targetTotal, at: m.at.toISOString() };
}
