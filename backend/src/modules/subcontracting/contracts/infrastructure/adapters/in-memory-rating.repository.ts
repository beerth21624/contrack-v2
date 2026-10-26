import type { WorkspaceId } from '../../../../../shared/domain';
import type { SubcontractId } from '../../../shared/ids';
import { RatingRepository } from '../../application/ports/rating.repository';
import type { Side } from '../../domain/entities/claim.entity';
import type { Rating } from '../../domain/entities/contract-records.entity';

export class InMemoryRatingRepository extends RatingRepository {
    readonly rows: Rating[] = [];

    insert(rating: Rating): Promise<boolean> {
        if (this.rows.some(r => r.subcontractId === rating.subcontractId && r.fromSide === rating.fromSide)) return Promise.resolve(false);
        this.rows.push(structuredClone(rating));
        return Promise.resolve(true);
    }

    find(subcontractId: SubcontractId, fromSide: Side): Promise<Rating | undefined> {
        const r = this.rows.find(x => x.subcontractId === subcontractId && x.fromSide === fromSide);
        return Promise.resolve(r === undefined ? undefined : structuredClone(r));
    }

    listGivenByBuyer(buyerWorkspaceId: WorkspaceId, vendorWorkspaceIds: readonly WorkspaceId[]): Promise<Rating[]> {
        return Promise.resolve(this.rows.filter(r => r.buyerWorkspaceId === buyerWorkspaceId && r.fromSide === 'buyer'
            && r.toWorkspaceId !== null && vendorWorkspaceIds.includes(r.toWorkspaceId)).map(r => structuredClone(r)));
    }
}
