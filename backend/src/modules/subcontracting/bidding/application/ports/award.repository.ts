// ─── Award decisions (which line went to which bid) ───
import type { UserId, WorkspaceId } from '../../../../../shared/domain';
import type { AwardId, BidId, PackageId, SubcontractId } from '../../../shared/ids';

export interface AwardRecord {
    id: AwardId;
    buyerWorkspaceId: WorkspaceId;
    packageId: PackageId;
    decidedBy: UserId | null;
    decidedAt: Date;
    allocations: { idx: number; bidId: BidId }[];
    installmentsFrom: Record<string, 'package' | 'bid'>;
    subcontractIds: SubcontractId[];
    note: string;
}

export abstract class AwardRepository {
    abstract insert(award: AwardRecord): Promise<void>;
    abstract listForPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<AwardRecord[]>;
}
