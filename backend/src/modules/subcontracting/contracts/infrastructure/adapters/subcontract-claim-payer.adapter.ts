// ─── SubcontractClaimPayer (shared/application/ports.ts, WP-50): a claim paid through a payables payment run ───
// The same effects as PayClaimUseCase (claim → paid, retention withheld once, activity, vendor notice after commit),
// inside the payment run's transaction. No permission check here: payables authorized the payment.
import { Injectable } from '@nestjs/common';
import { Clock, IdGenerator, type SubcontractClaimPayment, SubcontractClaimPayer } from '../../../../../shared/application/ports';
import { DomainError, type Result, type WorkspaceId, err, isUuid, ok } from '../../../../../shared/domain';
import { asClaimId, asRetentionEntryId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { ContractAccess } from '../../application/contract-access';
import { logContract } from '../../application/contract-activity';
import { ContractNotices } from '../../application/contract-notices';
import { ClaimRepository } from '../../application/ports/claim.repository';
import { RetentionRepository } from '../../application/ports/retention.repository';
import { formatBaht } from '../../application/thai-format';

@Injectable()
export class RepositorySubcontractClaimPayer extends SubcontractClaimPayer {
    constructor(
        private readonly access: ContractAccess,
        private readonly claims: ClaimRepository,
        private readonly retention: RetentionRepository,
        private readonly activity: ScActivityLog,
        private readonly notices: ContractNotices,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {
        super();
    }

    async markPaid(workspaceId: WorkspaceId, claimId: string, input: SubcontractClaimPayment): Promise<Result<{ afterCommit: () => Promise<void> }, DomainError>> {
        if (!isUuid(claimId)) return err(DomainError.notFound('Claim'));
        const id = asClaimId(claimId.toLowerCase());
        const found = await this.claims.findById(id);
        if (found?.state.buyerWorkspaceId !== workspaceId) return err(DomainError.notFound('Claim'));
        const locked = await this.access.lockClaim(id, found.subcontractId);
        if (!locked.ok) return locked;
        const { subcontract: sc, claim } = locked.value;
        const open = sc.requireStatus('record a payment of', 'active', 'terminated');
        if (!open.ok) return open;
        const now = this.clock.now();
        const paid = claim.pay({ paidAt: input.paidAt, amount: input.amount, channel: input.channel, ref: input.ref, by: input.by, now });
        if (!paid.ok) return paid;
        await this.claims.update(claim);
        if (claim.amounts.retention > 0) {
            await this.retention.insert({
                id: asRetentionEntryId(this.ids.newId()), subcontractId: sc.id, buyerWorkspaceId: sc.buyerWorkspaceId, kind: 'withheld',
                amount: claim.amounts.retention, claimId: claim.id, note: `งวดที่ ${claim.installmentNo}`, createdBy: input.by, createdAt: now,
            });
        }
        await logContract(this.activity, sc, 'claim', claim.id, 'paid', input.by, now, {
            from: 'approved', to: 'paid', amount: input.amount, retention: claim.amounts.retention, via: 'payables',
        });
        return ok({
            afterCommit: () => this.notices.toVendor(sc, 'sc.claim_paid', {
                title: sc.title, installmentNo: claim.installmentNo, amount: formatBaht(input.amount),
            }),
        });
    }
}
