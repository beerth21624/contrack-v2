import type { SubcontractId } from '../../../shared/ids';
import { RetentionRepository } from '../../application/ports/retention.repository';
import type { RetentionEntry } from '../../domain/entities/contract-records.entity';

export class InMemoryRetentionRepository extends RetentionRepository {
    readonly rows: RetentionEntry[] = [];

    insert(entry: RetentionEntry): Promise<void> {
        // Same rule as the unique index sc_retention_entries_claim_withheld_key.
        if (entry.kind === 'withheld' && entry.claimId !== null && this.rows.some(r => r.kind === 'withheld' && r.claimId === entry.claimId)) {
            throw new Error('retention of claim ' + entry.claimId + ' already withheld');
        }
        this.rows.push(structuredClone(entry));
        return Promise.resolve();
    }

    listBySubcontracts(ids: readonly SubcontractId[]): Promise<RetentionEntry[]> {
        return Promise.resolve(this.rows.filter(r => ids.includes(r.subcontractId)).map(r => structuredClone(r)));
    }
}
