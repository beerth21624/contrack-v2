import type { SubcontractStatus } from '@contrack/contract';
import type { ProjectId, WorkspaceId } from '../../../../../shared/domain';
import type { PackageId, ScInvitationId, SubcontractId } from '../../../shared/ids';
import type { Subcontract } from '../../domain/entities/subcontract.entity';

export abstract class SubcontractRepository {
    abstract insert(subcontract: Subcontract): Promise<void>;
    abstract update(subcontract: Subcontract): Promise<void>;
    /** Unscoped: callers check access to the buyer or the vendor workspace of the result. */
    abstract findById(id: SubcontractId): Promise<Subcontract | undefined>;
    /**
     * Locks the subcontract row until the current UnitOfWork ends (`SELECT … FOR UPDATE`) and returns its latest state.
     * Every write on a subcontract (and on its claims, variations, retention, ratings) takes this lock FIRST and checks
     * the state on what it returns, so two concurrent requests are serialized and the second sees the first's result.
     */
    abstract lockForUpdate(id: SubcontractId): Promise<Subcontract | undefined>;
    /**
     * Locks every subcontract of a package (ordered by id, so concurrent callers never deadlock) and returns them.
     * Used by status changes that look at the siblings (cancel / terminate / close → package follow-up).
     */
    abstract lockByPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<Subcontract[]>;
    abstract listByProject(buyerWorkspaceId: WorkspaceId, projectId: ProjectId): Promise<Subcontract[]>;
    abstract listByBuyer(buyerWorkspaceId: WorkspaceId): Promise<Subcontract[]>;
    abstract listByVendor(vendorWorkspaceId: WorkspaceId): Promise<Subcontract[]>;
    abstract listByPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<Subcontract[]>;
    /** Subcontracts awarded to an invitation (to link the vendor account later). */
    abstract listByInvitation(invitationId: ScInvitationId): Promise<Subcontract[]>;
    /** Every workspace (background sweep). */
    abstract listByStatuses(statuses: readonly SubcontractStatus[]): Promise<Subcontract[]>;
    /**
     * Next contract sequence number of the buyer in a year (1 for the first). Atomic: the per-workspace-year counter row
     * stays locked until the current UnitOfWork ends, so two awards at once never get the same number.
     */
    abstract nextSeq(buyerWorkspaceId: WorkspaceId, year: number): Promise<number>;
}
