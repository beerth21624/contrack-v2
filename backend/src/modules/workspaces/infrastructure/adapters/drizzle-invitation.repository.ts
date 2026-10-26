import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import {
    type InvitationId, type WorkspaceId, asInvitationId, asUserId, asWorkspaceId,
} from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { invitations } from '../../../../shared/infrastructure/database/schema';
import { InvitationRepository } from '../../application/ports/invitation.repository';
import { Invitation } from '../../domain/entities/invitation.entity';
import { Email } from '../../domain/value-objects/email.value-object';

type Row = typeof invitations.$inferSelect;

const toEntity = (row: Row): Invitation => Invitation.rehydrate({
    id: asInvitationId(row.id),
    workspaceId: asWorkspaceId(row.workspaceId),
    email: Email.rehydrate(row.email),
    role: row.role,
    tokenHash: row.tokenHash,
    invitedBy: asUserId(row.invitedBy),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    acceptedBy: row.acceptedBy === null ? null : asUserId(row.acceptedBy),
    revokedAt: row.revokedAt,
});

const pendingIn = (workspaceId: WorkspaceId, now: Date) => and(
    eq(invitations.workspaceId, workspaceId),
    isNull(invitations.acceptedAt),
    isNull(invitations.revokedAt),
    gt(invitations.expiresAt, now),
);

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. Every query filters by `workspace_id`, except the token lookup. */
export class DrizzleInvitationRepository extends InvitationRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findById(workspaceId: WorkspaceId, id: InvitationId): Promise<Invitation | undefined> {
        const [row] = await this.ctx.executor.select().from(invitations)
            .where(and(eq(invitations.workspaceId, workspaceId), eq(invitations.id, id)))
            .limit(1);
        return row === undefined ? undefined : toEntity(row);
    }

    /** The token is the only key the accepting user has; `token_hash` is unique. */
    async findByTokenHash(tokenHash: string): Promise<Invitation | undefined> {
        const [row] = await this.ctx.executor.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1);
        return row === undefined ? undefined : toEntity(row);
    }

    async listPending(workspaceId: WorkspaceId, now: Date): Promise<Invitation[]> {
        const rows = await this.ctx.executor.select().from(invitations)
            .where(pendingIn(workspaceId, now))
            .orderBy(desc(invitations.createdAt), desc(invitations.id));
        return rows.map(toEntity);
    }

    async listPendingForEmail(workspaceId: WorkspaceId, email: string, now: Date): Promise<Invitation[]> {
        const rows = await this.ctx.executor.select().from(invitations)
            .where(and(pendingIn(workspaceId, now), eq(invitations.email, email.trim().toLowerCase())))
            .orderBy(desc(invitations.createdAt));
        return rows.map(toEntity);
    }

    async insert(invitation: Invitation): Promise<void> {
        await this.ctx.executor.insert(invitations).values({
            id: invitation.id,
            workspaceId: invitation.workspaceId,
            email: invitation.email.value,
            role: invitation.role,
            tokenHash: invitation.tokenHash,
            invitedBy: invitation.invitedBy,
            createdAt: invitation.createdAt,
            expiresAt: invitation.expiresAt,
            acceptedAt: invitation.acceptedAt,
            acceptedBy: invitation.acceptedBy,
            revokedAt: invitation.revokedAt,
        });
    }

    async update(invitation: Invitation): Promise<void> {
        await this.ctx.executor.update(invitations)
            .set({ acceptedAt: invitation.acceptedAt, acceptedBy: invitation.acceptedBy, revokedAt: invitation.revokedAt })
            .where(and(eq(invitations.workspaceId, invitation.workspaceId), eq(invitations.id, invitation.id)));
    }

    async deleteAllOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
        await this.ctx.executor.delete(invitations).where(eq(invitations.workspaceId, workspaceId));
    }
}
