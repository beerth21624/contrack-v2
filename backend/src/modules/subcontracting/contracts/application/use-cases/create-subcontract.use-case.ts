// ─── SubcontractCreator: the award (bidding) turns each winner into a subcontract waiting for the crew's acceptance ───
// Runs inside the award transaction (no own UnitOfWork, no notifications: bidding sends sc.contract_to_accept after
// commit). Terms = package terms + workspace WHT default + the crew's VAT registration; document v1 is rendered from the
// workspace template (or the built-in Thai one).
import { Injectable } from '@nestjs/common';
import type { SubcontractTerms } from '@contrack/contract';
import { installmentAmounts } from '@contrack/domain/subcontracting/claims';
import { renderContract } from '@contrack/domain/subcontracting/contract-template';
import { round2 } from '@contrack/domain/subcontracting/snapshot';
import { tradeLabel } from '@contrack/domain/subcontracting/trades';
import { IdGenerator } from '../../../../../shared/application/ports';
import { asSubcontractId, type SubcontractId } from '../../../shared/ids';
import {
    type AwardedPart, ScActivityLog, SubcontractCreator, SubcontractingSettingsReader, VendorDirectory,
} from '../../../shared/ports';
import { Subcontract, type SubcontractLine, contractNumber } from '../../domain/entities/subcontract.entity';
import { logContract } from '../contract-activity';
import { ContractDocumentRepository } from '../ports/contract-document.repository';
import { SubcontractRepository } from '../ports/subcontract.repository';
import { bangkokDate, bangkokYear } from '../thai-format';

@Injectable()
export class CreateSubcontractUseCase extends SubcontractCreator {
    constructor(
        private readonly subcontracts: SubcontractRepository,
        private readonly documents: ContractDocumentRepository,
        private readonly settings: SubcontractingSettingsReader,
        private readonly vendors: VendorDirectory,
        private readonly activity: ScActivityLog,
        private readonly ids: IdGenerator,
    ) {
        super();
    }

    async create(part: AwardedPart): Promise<SubcontractId> {
        const pkg = part.package;
        const now = part.at;
        const settings = await this.settings.get(pkg.buyerWorkspaceId);
        const vendorWs = part.invitation.vendorWorkspaceId;
        const card = vendorWs === null ? undefined : (await this.vendors.cards([vendorWs])).get(vendorWs);
        const terms: SubcontractTerms = { ...structuredClone(pkg.terms), whtPct: settings.defaultWhtPct, vat: card?.vatRegistered ?? false };

        // Awarded lines are priced against the package's CURRENT version (bidding re-prices older bids onto it), so the
        // BOQ key and who supplies material come from that version's line with the same idx.
        const byIdx = new Map(pkg.lines.map(l => [l.idx, l]));
        const lines: SubcontractLine[] = part.lines.map(l => ({
            ...l, lineKey: byIdx.get(l.idx)?.lineKey ?? null, materialBy: byIdx.get(l.idx)?.materialBy ?? 'buyer',
        }));
        const baseTotal = round2(part.total);
        const year = bangkokYear(now);
        const seq = await this.subcontracts.nextSeq(pkg.buyerWorkspaceId, year);
        const id = asSubcontractId(this.ids.newId());
        const sc = Subcontract.create({
            id,
            buyerWorkspaceId: pkg.buyerWorkspaceId,
            projectId: pkg.projectId,
            packageId: pkg.id,
            bidId: part.bid.id,
            invitationId: part.invitation.id,
            vendorListEntryId: part.invitation.vendorListEntryId,
            vendorWorkspaceId: vendorWs,
            vendorName: part.vendorName,
            buyerName: pkg.buyerName,
            projectName: pkg.projectName,
            contractNo: contractNumber(year, seq),
            year,
            seq,
            title: pkg.title,
            trade: pkg.trade,
            location: { ...pkg.location },
            lines,
            baseTotal,
            terms,
            schedule: {
                start: pkg.schedule.start ?? part.bid.earliestStart,
                finish: pkg.schedule.finish,
                days: part.bid.days ?? pkg.schedule.days,
            },
            installments: part.installments.map(i => ({ ...i })),
            createdBy: part.decidedBy,
            createdAt: now,
        });
        const html = renderContract(settings.contractTemplateHtml, {
            contractNo: sc.state.contractNo,
            date: bangkokDate(now),
            buyerName: pkg.buyerName,
            vendorName: part.vendorName,
            projectName: pkg.projectName,
            title: pkg.title,
            tradeLabel: tradeLabel(pkg.trade),
            location: pkg.location,
            lines,
            total: baseTotal,
            installments: installmentAmounts(part.installments, baseTotal),
            retentionPct: terms.retentionPct,
            warrantyMonths: terms.warrantyMonths,
            penalty: terms.penalty,
            provisions: terms.provisions,
            safetyNote: terms.safetyNote,
            schedule: sc.state.schedule,
            whtPct: terms.whtPct,
            vat: terms.vat,
        });
        await this.subcontracts.insert(sc);
        await this.documents.insertDocument({
            id: this.ids.newId(), subcontractId: id, buyerWorkspaceId: pkg.buyerWorkspaceId, version: 1, html,
            createdBy: part.decidedBy, createdAt: now,
        });
        await logContract(this.activity, sc, 'subcontract', id, 'created', part.decidedBy, now, {
            to: 'pending_acceptance', contractNo: sc.state.contractNo, total: baseTotal, bidId: part.bid.id,
        });
        return id;
    }
}
