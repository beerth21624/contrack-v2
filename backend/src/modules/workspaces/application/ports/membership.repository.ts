import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import type { Membership } from '../../domain/entities/membership.entity';

/** Memberships (workspace ↔ user ↔ role). Joins the UnitOfWork transaction when called inside `uow.run`. */
export abstract class MembershipRepository {
    abstract find(workspaceId: WorkspaceId, userId: UserId): Promise<Membership | undefined>;
    abstract listByWorkspace(workspaceId: WorkspaceId): Promise<Membership[]>;
    /** Every workspace a user belongs to (keyed by the user, not by one workspace). */
    abstract listByUser(userId: UserId): Promise<Membership[]>;
    abstract countByWorkspaces(workspaceIds: readonly WorkspaceId[]): Promise<Map<WorkspaceId, number>>;
    abstract insert(membership: Membership): Promise<void>;
    /** Persists the role. */
    abstract update(membership: Membership): Promise<void>;
    abstract delete(workspaceId: WorkspaceId, userId: UserId): Promise<void>;
    abstract deleteAllOfWorkspace(workspaceId: WorkspaceId): Promise<void>;

    /**
     * Runs `work` while holding a lock on the workspace's memberships, with the members read under that lock.
     * Every change that depends on the member list (last-owner rule, accept, invite) goes through here, so two
     * concurrent changes are serialised. Postgres: `select … for update` inside the (ambient) transaction;
     * in memory: a per-workspace mutex.
     */
    abstract withLockedMembers<T>(workspaceId: WorkspaceId, work: (members: Membership[]) => Promise<T>): Promise<T>;
}
