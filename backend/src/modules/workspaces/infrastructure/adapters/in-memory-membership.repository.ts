import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { MembershipRepository } from '../../application/ports/membership.repository';
import { Membership, type MembershipProps } from '../../domain/entities/membership.entity';
import { KeyedMutex } from './keyed-mutex';

const key = (workspaceId: WorkspaceId, userId: UserId): string => `${workspaceId}:${userId}`;

/** Map-based; stores snapshots. `withLockedMembers` serialises per workspace like `select … for update`. */
export class InMemoryMembershipRepository extends MembershipRepository {
    private readonly rows = new Map<string, MembershipProps>();
    private readonly locks = new KeyedMutex();

    find(workspaceId: WorkspaceId, userId: UserId): Promise<Membership | undefined> {
        const row = this.rows.get(key(workspaceId, userId));
        return Promise.resolve(row === undefined ? undefined : Membership.rehydrate(row));
    }

    listByWorkspace(workspaceId: WorkspaceId): Promise<Membership[]> {
        return Promise.resolve(this.select(r => r.workspaceId === workspaceId));
    }

    listByUser(userId: UserId): Promise<Membership[]> {
        return Promise.resolve(this.select(r => r.userId === userId));
    }

    countByWorkspaces(workspaceIds: readonly WorkspaceId[]): Promise<Map<WorkspaceId, number>> {
        const wanted = new Set(workspaceIds);
        const counts = new Map<WorkspaceId, number>();
        for (const row of this.rows.values()) {
            if (wanted.has(row.workspaceId)) counts.set(row.workspaceId, (counts.get(row.workspaceId) ?? 0) + 1);
        }
        return Promise.resolve(counts);
    }

    insert(membership: Membership): Promise<void> {
        const k = key(membership.workspaceId, membership.userId);
        if (this.rows.has(k)) return Promise.reject(new Error(`membership ${k} already exists`));
        this.rows.set(k, membership.toProps());
        return Promise.resolve();
    }

    update(membership: Membership): Promise<void> {
        const k = key(membership.workspaceId, membership.userId);
        if (this.rows.has(k)) this.rows.set(k, membership.toProps());
        return Promise.resolve();
    }

    delete(workspaceId: WorkspaceId, userId: UserId): Promise<void> {
        this.rows.delete(key(workspaceId, userId));
        return Promise.resolve();
    }

    deleteAllOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
        for (const [k, row] of this.rows) if (row.workspaceId === workspaceId) this.rows.delete(k);
        return Promise.resolve();
    }

    withLockedMembers<T>(workspaceId: WorkspaceId, work: (members: Membership[]) => Promise<T>): Promise<T> {
        return this.locks.run(workspaceId, () => work(this.select(r => r.workspaceId === workspaceId)));
    }

    private select(predicate: (row: MembershipProps) => boolean): Membership[] {
        return [...this.rows.values()].filter(predicate).map(r => Membership.rehydrate(r));
    }
}
