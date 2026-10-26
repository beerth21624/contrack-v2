import type { WorkspaceId } from '../../../../../shared/domain';
import type { SubcontractId } from '../../../shared/ids';
import type { Side } from '../../domain/entities/claim.entity';
import type { Rating } from '../../domain/entities/contract-records.entity';

export abstract class RatingRepository {
    /** Returns false when that side already rated the subcontract. */
    abstract insert(rating: Rating): Promise<boolean>;
    abstract find(subcontractId: SubcontractId, fromSide: Side): Promise<Rating | undefined>;
    /** Ratings the buyer gave to these vendors. */
    abstract listGivenByBuyer(buyerWorkspaceId: WorkspaceId, vendorWorkspaceIds: readonly WorkspaceId[]): Promise<Rating[]>;
}
