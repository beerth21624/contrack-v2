import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { type UserId, type WorkspaceId, asUserId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { memberships, users } from '../../../../shared/infrastructure/database/schema';
import { userChannelLinks } from '../../../../shared/infrastructure/database/schema-platform';
import { type Recipient, RecipientDirectory } from '../../application/ports/recipient-directory.port';

/**
 * Reads memberships and users directly (read-only): recipients are the listed users that exist plus every member of
 * the listed workspaces, with their language. Only verified phones are used for SMS and only verified LINE links
 * (`user_channel_links`) for LINE.
 */
export class DrizzleRecipientDirectory extends RecipientDirectory {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async resolve(userIds: readonly UserId[], workspaceIds: readonly WorkspaceId[]): Promise<Recipient[]> {
        const ids = new Set<string>(userIds);
        if (workspaceIds.length > 0) {
            const members = await this.ctx.executor.select({ userId: memberships.userId }).from(memberships)
                .where(inArray(memberships.workspaceId, [...new Set(workspaceIds)]));
            for (const m of members) ids.add(m.userId);
        }
        if (ids.size === 0) return [];
        const rows = await this.ctx.executor
            .select({ id: users.id, phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt, locale: users.locale })
            .from(users)
            .where(inArray(users.id, [...ids]));
        const byId = new Map(rows.map(r => [r.id, r]));
        const lines = await this.ctx.executor
            .select({ userId: userChannelLinks.userId, address: userChannelLinks.address })
            .from(userChannelLinks)
            .where(and(inArray(userChannelLinks.userId, [...ids]), eq(userChannelLinks.channel, 'line'), isNotNull(userChannelLinks.verifiedAt)));
        const lineOf = new Map(lines.map(l => [l.userId, l.address]));
        const out: Recipient[] = [];
        for (const id of ids) {
            const row = byId.get(id);
            if (row === undefined) continue;
            out.push({
                userId: asUserId(row.id),
                locale: row.locale === 'en' ? 'en' : 'th',
                phone: row.phoneVerifiedAt === null ? null : row.phone,
                // Rows come from the LINE linking flow (LINE Login / OA follow event), which is not built yet.
                lineUserId: lineOf.get(row.id) ?? null,
            });
        }
        return out;
    }
}
