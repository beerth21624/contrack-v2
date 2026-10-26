import type { InvitationId, WorkspaceId } from '../../../../shared/domain/ids';
import { InvitationRepository } from '../../application/ports/invitation.repository';
import { Invitation, type InvitationProps } from '../../domain/entities/invitation.entity';

/** Map-based; stores snapshots. */
export class InMemoryInvitationRepository extends InvitationRepository {
    private readonly rows = new Map<InvitationId, InvitationProps>();

    findById(workspaceId: WorkspaceId, id: InvitationId): Promise<Invitation | undefined> {
        const row = this.rows.get(id);
        return Promise.resolve(row?.workspaceId === workspaceId ? Invitation.rehydrate(row) : undefined);
    }

    findByTokenHash(tokenHash: string): Promise<Invitation | undefined> {
        const row = [...this.rows.values()].find(r => r.tokenHash === tokenHash);
        return Promise.resolve(row === undefined ? undefined : Invitation.rehydrate(row));
    }

    listPending(workspaceId: WorkspaceId, now: Date): Promise<Invitation[]> {
        return Promise.resolve(this.pending(workspaceId, now));
    }

    listPendingForEmail(workspaceId: WorkspaceId, email: string, now: Date): Promise<Invitation[]> {
        const wanted = email.trim().toLowerCase();
        return Promise.resolve(this.pending(workspaceId, now).filter(i => i.email.value === wanted));
    }

    insert(invitation: Invitation): Promise<void> {
        const props = invitation.toProps();
        if (this.rows.has(props.id)) return Promise.reject(new Error(`invitation ${props.id} already exists`));
        if ([...this.rows.values()].some(r => r.tokenHash === props.tokenHash)) {
            return Promise.reject(new Error('invitation token hash already exists'));
        }
        this.rows.set(props.id, props);
        return Promise.resolve();
    }

    update(invitation: Invitation): Promise<void> {
        const current = this.rows.get(invitation.id);
        if (current?.workspaceId === invitation.workspaceId) this.rows.set(invitation.id, invitation.toProps());
        return Promise.resolve();
    }

    deleteAllOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
        for (const [id, row] of this.rows) if (row.workspaceId === workspaceId) this.rows.delete(id);
        return Promise.resolve();
    }

    private pending(workspaceId: WorkspaceId, now: Date): Invitation[] {
        return [...this.rows.values()]
            .filter(r => r.workspaceId === workspaceId)
            .map(r => Invitation.rehydrate(r))
            .filter(i => i.isPending(now))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    }
}
