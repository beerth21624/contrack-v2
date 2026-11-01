// ─── SubcontractPayables (shared/application/ports.ts, WP-49): the buyer's approved claims as payables bills them ───
import { Injectable } from '@nestjs/common';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { round2 } from '@contrack/domain/money';
import { ModuleFlags, type SubcontractPayableClaim, SubcontractPayables } from '../../../../../shared/application/ports';
import { type WorkspaceId, isUuid } from '../../../../../shared/domain/ids';
import { asClaimId } from '../../../shared/ids';
import type { Claim } from '../../domain/entities/claim.entity';
import type { Subcontract } from '../../domain/entities/subcontract.entity';
import { ClaimRepository } from '../../application/ports/claim.repository';
import { SubcontractRepository } from '../../application/ports/subcontract.repository';

const MODULE = 'subcontracting';

function payableClaim(s: Subcontract, c: Claim): SubcontractPayableClaim {
    const p = s.state;
    const a = c.amounts;
    const approvedAt = c.state.approvedAt;
    return {
        claimId: c.id, subcontractId: p.id, projectId: p.projectId, status: c.status, contractNo: p.contractNo, title: p.title,
        vendorName: p.vendorName, vendorListEntryId: p.vendorListEntryId, installmentNo: c.installmentNo,
        approvedOn: approvedAt === null ? null : bangkokToday(approvedAt),
        base: round2(a.gross + a.adjustments.reduce((sum, x) => sum + x.amount, 0)), gross: a.gross, retention: a.retention, wht: a.wht,
        whtPct: p.terms.whtPct, vat: a.vat, net: a.net,
    };
}

@Injectable()
export class RepositorySubcontractPayables extends SubcontractPayables {
    constructor(
        private readonly flags: ModuleFlags,
        private readonly subcontracts: SubcontractRepository,
        private readonly claims: ClaimRepository,
    ) {
        super();
    }

    async listApprovedUnpaid(workspaceId: WorkspaceId): Promise<SubcontractPayableClaim[]> {
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return [];
        const list = await this.subcontracts.listByBuyer(workspaceId);
        if (list.length === 0) return [];
        const byId = new Map(list.map(s => [s.id as string, s]));
        const out: SubcontractPayableClaim[] = [];
        for (const c of await this.claims.listBySubcontracts(list.map(s => s.id))) {
            const s = byId.get(c.subcontractId);
            if (c.status !== 'approved' || s === undefined) continue;
            out.push(payableClaim(s, c));
        }
        return out.sort((a, b) => ((a.approvedOn ?? '') < (b.approvedOn ?? '') ? -1 : (a.approvedOn ?? '') > (b.approvedOn ?? '') ? 1 : 0));
    }

    async find(workspaceId: WorkspaceId, claimId: string): Promise<SubcontractPayableClaim | undefined> {
        if (!isUuid(claimId) || !(await this.flags.isEnabled(workspaceId, MODULE))) return undefined;
        const c = await this.claims.findById(asClaimId(claimId.toLowerCase()));
        if (c?.state.buyerWorkspaceId !== workspaceId) return undefined;
        const s = await this.subcontracts.findById(c.subcontractId);
        return s?.state.buyerWorkspaceId === workspaceId ? payableClaim(s, c) : undefined;
    }
}
