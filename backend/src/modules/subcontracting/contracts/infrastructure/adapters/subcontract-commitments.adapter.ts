// ─── SubcontractCommitments (shared/application/ports.ts, WP-46): what job-cost posts to the cost ledger ───
import { Injectable } from '@nestjs/common';
import type { SubcontractStatus } from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import {
    ModuleFlags, SubcontractCommitments, type SubcontractCommitment,
} from '../../../../../shared/application/ports';
import type { ProjectId, WorkspaceId } from '../../../../../shared/domain/ids';
import { ClaimRepository } from '../../application/ports/claim.repository';
import { SubcontractRepository } from '../../application/ports/subcontract.repository';

/** Subcontracts that hold a commitment: accepted by the vendor and not cancelled. */
const COMMITTED: readonly SubcontractStatus[] = ['active', 'completed', 'closed', 'terminated'];

@Injectable()
export class RepositorySubcontractCommitments extends SubcontractCommitments {
    constructor(
        private readonly flags: ModuleFlags,
        private readonly subcontracts: SubcontractRepository,
        private readonly claims: ClaimRepository,
    ) {
        super();
    }

    async forProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<SubcontractCommitment[]> {
        if (!(await this.flags.isEnabled(workspaceId, 'subcontracting'))) return [];
        const list = (await this.subcontracts.listByProject(workspaceId, projectId)).filter(s => COMMITTED.includes(s.status));
        if (list.length === 0) return [];
        const claims = await this.claims.listBySubcontracts(list.map(s => s.id));
        return list.map(s => {
            const p = s.state;
            return {
                subcontractId: p.id,
                projectId: p.projectId,
                status: p.status,
                title: p.title,
                vendorName: p.vendorName,
                total: p.total,
                activatedOn: p.activatedAt === null ? null : bangkokToday(p.activatedAt),
                createdBy: p.createdBy,
                lines: p.lines.map(l => ({ lineKey: l.lineKey, total: l.total })),
                claims: claims
                    .filter(c => c.subcontractId === p.id && (c.status === 'approved' || c.status === 'paid'))
                    .flatMap(c => {
                        const cp = c.state;
                        if (cp.approvedAt === null || cp.approvedBy === null) return [];
                        return [{
                            claimId: cp.id, installmentNo: cp.installmentNo, gross: cp.amounts.gross,
                            approvedOn: bangkokToday(cp.approvedAt), approvedBy: cp.approvedBy,
                        }];
                    }),
            };
        });
    }
}
