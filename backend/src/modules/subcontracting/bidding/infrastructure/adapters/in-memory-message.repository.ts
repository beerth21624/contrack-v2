// ─── MessageRepository in memory (unit tests, PERSISTENCE=memory) ───
import type { ScInvitationId } from '../../../shared/ids';
import { MessageRepository, type MessageSide, type NegotiationMessage } from '../../application/ports/message.repository';

export class InMemoryMessageRepository extends MessageRepository {
    readonly rows: NegotiationMessage[] = [];

    insert(message: NegotiationMessage): Promise<void> {
        this.rows.push({ ...message });
        return Promise.resolve();
    }

    list(invitationId: ScInvitationId): Promise<NegotiationMessage[]> {
        return Promise.resolve(this.rows.filter(m => m.invitationId === invitationId).map(m => ({ ...m }))
            .sort((a, b) => a.at.getTime() - b.at.getTime()));
    }

    markRead(invitationId: ScInvitationId, from: MessageSide, at: Date): Promise<void> {
        for (const m of this.rows) if (m.invitationId === invitationId && m.from === from && m.readAt === null) m.readAt = at;
        return Promise.resolve();
    }

    unreadCounts(invitationIds: readonly ScInvitationId[], from: MessageSide): Promise<Map<ScInvitationId, number>> {
        const wanted = new Set(invitationIds);
        const out = new Map<ScInvitationId, number>();
        for (const m of this.rows) {
            if (!wanted.has(m.invitationId) || m.from !== from || m.readAt !== null) continue;
            out.set(m.invitationId, (out.get(m.invitationId) ?? 0) + 1);
        }
        return Promise.resolve(out);
    }
}
