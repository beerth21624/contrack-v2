import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { type UserId, type WorkspaceId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { memberships } from '../../../../shared/infrastructure/database/schema';
import { MembershipRepository } from '../../application/ports/membership.repository';
import { Membership } from '../../domain/entities/membership.entity';

type Row = typeof memberships.$inferSelect;

const toEntity = (row: Row): Membership => Membership.rehydrate({
    workspaceId: asWorkspaceId(row.workspaceId),
    userId: asUserId(row.userId),
    role: row.role,
    joinedAt: row.joinedAt,
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. Every query filters by `workspace_id`, except `listByUser`. */
export class DrizzleMembershipRepository extends MembershipRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(workspaceId: WorkspaceId, userId: UserId): Promise<Membership | undefined> {
        const [row] = await this.ctx.executor.select().from(memberships)
            .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
            .limit(1);
        return row === undefined ? undefined : toEntity(row);
    }

    async listByWorkspace(workspaceId: WorkspaceId): Promise<Membership[]> {
        const rows = await this.ctx.executor.select().from(memberships)
            .where(eq(memberships.workspaceId, workspaceId))
            .orderBy(asc(memberships.joinedAt), asc(memberships.userId));
        return rows.map(toEntity);
    }

    /** Keyed by the user: the list of tenants the user belongs to. */
    async listByUser(userId: UserId): Promise<Membership[]> {
        const rows = await this.ctx.executor.select().from(memberships)
            .where(eq(memberships.userId, userId))
            .orderBy(asc(memberships.joinedAt));
        return rows.map(toEntity);
    }

    async countByWorkspaces(workspaceIds: readonly WorkspaceId[]): Promise<Map<WorkspaceId, number>> {
        const counts = new Map<WorkspaceId, number>();
        if (workspaceIds.length === 0) return counts;
        const rows = await this.ctx.executor
            .select({ workspaceId: memberships.workspaceId, members: count() })
            .from(memberships)
            .where(inArray(memberships.workspaceId, [...new Set(workspaceIds)]))
            .groupBy(memberships.workspaceId);
        for (const row of rows) counts.set(asWorkspaceId(row.workspaceId), row.members);
        return counts;
    }

    async insert(membership: Membership): Promise<void> {
        await this.ctx.executor.insert(memberships).values({
            workspaceId: membership.workspaceId,
            userId: membership.userId,
            role: membership.role,
            joinedAt: membership.joinedAt,
        });
    }

    async update(membership: Membership): Promise<void> {
        await this.ctx.executor.update(memberships)
            .set({ role: membership.role })
            .where(and(eq(memberships.workspaceId, membership.workspaceId), eq(memberships.userId, membership.userId)));
    }

    async delete(workspaceId: WorkspaceId, userId: UserId): Promise<void> {
        await this.ctx.executor.delete(memberships)
            .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)));
    }

    async deleteAllOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
        await this.ctx.executor.delete(memberships).where(eq(memberships.workspaceId, workspaceId));
    }

    /**
     * `select … for update` on every membership row of the workspace (in user-id order, so concurrent lockers never
     * deadlock), inside the ambient transaction (or a new one). Concurrent role changes / removals / accepts of the
     * same workspace wait here, and each re-reads the members after the previous one committed.
     */
    withLockedMembers<T>(workspaceId: WorkspaceId, work: (members: Membership[]) => Promise<T>): Promise<T> {
        return this.ctx.transaction(async () => {
            const rows = await this.ctx.executor.select().from(memberships)
                .where(eq(memberships.workspaceId, workspaceId))
                .orderBy(asc(memberships.userId))
                .for('update');
            return work(rows.map(toEntity));
        });
    }
}
