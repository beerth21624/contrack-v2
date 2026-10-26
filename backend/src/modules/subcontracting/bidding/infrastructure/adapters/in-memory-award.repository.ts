// ─── AwardRepository in memory (unit tests, PERSISTENCE=memory) ───
import type { WorkspaceId } from '../../../../../shared/domain';
import type { PackageId } from '../../../shared/ids';
import { AwardRepository, type AwardRecord } from '../../application/ports/award.repository';

export class InMemoryAwardRepository extends AwardRepository {
    readonly rows: AwardRecord[] = [];

    insert(award: AwardRecord): Promise<void> {
        this.rows.push(structuredClone(award));
        return Promise.resolve();
    }

    listForPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<AwardRecord[]> {
        return Promise.resolve(this.rows.filter(a => a.buyerWorkspaceId === buyerWorkspaceId && a.packageId === packageId)
            .map(a => structuredClone(a)));
    }
}
