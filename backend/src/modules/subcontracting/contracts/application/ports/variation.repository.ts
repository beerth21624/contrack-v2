import type { SubcontractId, VariationId } from '../../../shared/ids';
import type { Variation } from '../../domain/entities/variation.entity';

export abstract class VariationRepository {
    abstract insert(variation: Variation): Promise<void>;
    abstract update(variation: Variation): Promise<void>;
    abstract findById(id: VariationId): Promise<Variation | undefined>;
    /** Oldest first. */
    abstract listBySubcontracts(ids: readonly SubcontractId[]): Promise<Variation[]>;
}
