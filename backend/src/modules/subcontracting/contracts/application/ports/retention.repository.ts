import type { SubcontractId } from '../../../shared/ids';
import type { RetentionEntry } from '../../domain/entities/contract-records.entity';

export abstract class RetentionRepository {
    abstract insert(entry: RetentionEntry): Promise<void>;
    /** Oldest first. */
    abstract listBySubcontracts(ids: readonly SubcontractId[]): Promise<RetentionEntry[]>;
}
