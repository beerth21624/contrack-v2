import type { ClaimId, SubcontractId } from '../../../shared/ids';
import type { Claim } from '../../domain/entities/claim.entity';

export abstract class ClaimRepository {
    abstract insert(claim: Claim): Promise<void>;
    abstract update(claim: Claim): Promise<void>;
    abstract findById(id: ClaimId): Promise<Claim | undefined>;
    /** Ordered by installment, then request time. */
    abstract listBySubcontracts(ids: readonly SubcontractId[]): Promise<Claim[]>;
}
