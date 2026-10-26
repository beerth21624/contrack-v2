import type { InvitationId, WorkspaceId } from '../../../../shared/domain/ids';
import type { Invitation } from '../../domain/entities/invitation.entity';

/** Invitations. Joins the UnitOfWork transaction when called inside `uow.run`. */
export abstract class InvitationRepository {
    abstract findById(workspaceId: WorkspaceId, id: InvitationId): Promise<Invitation | undefined>;
    /** Tokens are global (the accepting user does not know the workspace yet); the hash is unique. */
    abstract findByTokenHash(tokenHash: string): Promise<Invitation | undefined>;
    /** Not accepted, not revoked, not expired at `now`; newest first. */
    abstract listPending(workspaceId: WorkspaceId, now: Date): Promise<Invitation[]>;
    abstract listPendingForEmail(workspaceId: WorkspaceId, email: string, now: Date): Promise<Invitation[]>;
    abstract insert(invitation: Invitation): Promise<void>;
    /** Persists acceptedAt / acceptedBy / revokedAt. */
    abstract update(invitation: Invitation): Promise<void>;
    abstract deleteAllOfWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
