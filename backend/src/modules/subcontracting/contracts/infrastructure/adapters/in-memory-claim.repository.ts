import type { ClaimId, SubcontractId } from '../../../shared/ids';
import { ClaimRepository } from '../../application/ports/claim.repository';
import { Claim, type ClaimProps } from '../../domain/entities/claim.entity';

export class InMemoryClaimRepository extends ClaimRepository {
    private readonly rows = new Map<ClaimId, ClaimProps>();

    /** Same rule as the partial unique index sc_claims_open_installment_key. */
    private assertOneOpen(p: ClaimProps): void {
        if (p.status === 'rejected') return;
        const clash = [...this.rows.values()].some(r => r.id !== p.id && r.subcontractId === p.subcontractId
            && r.installmentNo === p.installmentNo && r.status !== 'rejected');
        if (clash) throw new Error(`installment ${p.installmentNo} already has an open claim`);
    }

    insert(claim: Claim): Promise<void> {
        if (this.rows.has(claim.id)) throw new Error(`claim ${claim.id} already exists`);
        this.assertOneOpen(claim.toProps());
        this.rows.set(claim.id, claim.toProps());
        return Promise.resolve();
    }

    update(claim: Claim): Promise<void> {
        if (!this.rows.has(claim.id)) throw new Error(`claim ${claim.id} not found`);
        this.assertOneOpen(claim.toProps());
        this.rows.set(claim.id, claim.toProps());
        return Promise.resolve();
    }

    findById(id: ClaimId): Promise<Claim | undefined> {
        const p = this.rows.get(id);
        return Promise.resolve(p === undefined ? undefined : Claim.rehydrate(p));
    }

    listBySubcontracts(ids: readonly SubcontractId[]): Promise<Claim[]> {
        return Promise.resolve([...this.rows.values()].filter(p => ids.includes(p.subcontractId))
            .sort((a, b) => a.installmentNo - b.installmentNo || a.createdAt.getTime() - b.createdAt.getTime())
            .map(p => Claim.rehydrate(p)));
    }
}
