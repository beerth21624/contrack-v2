// ─── Negotiation messages between a buyer and one invitee ───
import type { UserId, WorkspaceId } from '../../../../../shared/domain';
import type { MessageId, PackageId, ScInvitationId } from '../../../shared/ids';

export type MessageSide = 'buyer' | 'vendor';

export interface NegotiationMessage {
    id: MessageId;
    buyerWorkspaceId: WorkspaceId;
    packageId: PackageId;
    invitationId: ScInvitationId;
    from: MessageSide;
    /** null when the author account was deleted. */
    authorUserId: UserId | null;
    text: string;
    targetTotal: number | null;
    at: Date;
    /** When the other side read it. */
    readAt: Date | null;
}

export abstract class MessageRepository {
    abstract insert(message: NegotiationMessage): Promise<void>;
    /** Oldest first. */
    abstract list(invitationId: ScInvitationId): Promise<NegotiationMessage[]>;
    /** Marks the messages sent by `from` as read by the other side. */
    abstract markRead(invitationId: ScInvitationId, from: MessageSide, at: Date): Promise<void>;
    /** Unread messages sent by `from`, per invitation (missing = 0). */
    abstract unreadCounts(invitationIds: readonly ScInvitationId[], from: MessageSide): Promise<Map<ScInvitationId, number>>;
}
