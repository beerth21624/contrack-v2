// ─── MessageRepository on PostgreSQL (sc_messages) ───
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { asUserId, asWorkspaceId } from '../../../../../shared/domain';
import type { DatabaseContext } from '../../../../../shared/infrastructure/database/database';
import { scMessages } from '../../../../../shared/infrastructure/database/schema-sc-bidding';
import { asMessageId, asPackageId, asScInvitationId, type ScInvitationId } from '../../../shared/ids';
import { MessageRepository, type MessageSide, type NegotiationMessage } from '../../application/ports/message.repository';

export class DrizzleMessageRepository extends MessageRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(m: NegotiationMessage): Promise<void> {
        await this.ctx.executor.insert(scMessages).values({
            id: m.id, buyerWorkspaceId: m.buyerWorkspaceId, packageId: m.packageId, invitationId: m.invitationId, sender: m.from,
            authorUserId: m.authorUserId, text: m.text, targetTotal: m.targetTotal, readAt: m.readAt, createdAt: m.at,
        });
    }

    async list(invitationId: ScInvitationId): Promise<NegotiationMessage[]> {
        const rows = await this.ctx.executor.select().from(scMessages)
            .where(eq(scMessages.invitationId, invitationId)).orderBy(asc(scMessages.createdAt), asc(scMessages.id));
        return rows.map(r => ({
            id: asMessageId(r.id),
            buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
            packageId: asPackageId(r.packageId),
            invitationId: asScInvitationId(r.invitationId),
            from: r.sender,
            authorUserId: r.authorUserId === null ? null : asUserId(r.authorUserId),
            text: r.text,
            targetTotal: r.targetTotal,
            at: r.createdAt,
            readAt: r.readAt,
        }));
    }

    async markRead(invitationId: ScInvitationId, from: MessageSide, at: Date): Promise<void> {
        await this.ctx.executor.update(scMessages).set({ readAt: at })
            .where(and(eq(scMessages.invitationId, invitationId), eq(scMessages.sender, from), isNull(scMessages.readAt)));
    }

    async unreadCounts(invitationIds: readonly ScInvitationId[], from: MessageSide): Promise<Map<ScInvitationId, number>> {
        const out = new Map<ScInvitationId, number>();
        if (invitationIds.length === 0) return out;
        const rows = await this.ctx.executor.select({ invitationId: scMessages.invitationId, n: count() }).from(scMessages)
            .where(and(inArray(scMessages.invitationId, [...invitationIds]), eq(scMessages.sender, from), isNull(scMessages.readAt)))
            .groupBy(scMessages.invitationId);
        for (const r of rows) out.set(asScInvitationId(r.invitationId), r.n);
        return out;
    }
}
