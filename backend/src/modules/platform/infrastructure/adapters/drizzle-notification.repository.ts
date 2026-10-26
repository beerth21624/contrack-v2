import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { type UserId, asUserId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { notifications } from '../../../../shared/infrastructure/database/schema-platform';
import { NotificationRepository } from '../../application/ports/notification.repository';
import { Notification } from '../../domain/entities/notification.entity';
import { type NotificationId, asNotificationId } from '../../domain/platform-ids';

type Row = typeof notifications.$inferSelect;

const toEntity = (row: Row): Notification => Notification.rehydrate({
    id: asNotificationId(row.id),
    userId: asUserId(row.userId),
    template: row.template,
    title: row.title,
    body: row.body,
    href: row.href,
    payload: row.payload,
    createdAt: row.createdAt,
    readAt: row.readAt,
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. Every query filters by `user_id`. */
export class DrizzleNotificationRepository extends NotificationRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insertMany(items: readonly Notification[]): Promise<void> {
        if (items.length === 0) return;
        await this.ctx.executor.insert(notifications).values(items.map(item => {
            const p = item.toProps();
            return {
                id: p.id, userId: p.userId, template: p.template, title: p.title, body: p.body, href: p.href,
                payload: p.payload, createdAt: p.createdAt, readAt: p.readAt,
            };
        }));
    }

    async listForUser(userId: UserId, limit: number): Promise<Notification[]> {
        const rows = await this.ctx.executor.select().from(notifications)
            .where(eq(notifications.userId, userId))
            .orderBy(desc(notifications.createdAt), desc(notifications.id))
            .limit(limit);
        return rows.map(toEntity);
    }

    async countUnread(userId: UserId): Promise<number> {
        const [row] = await this.ctx.executor.select({ n: count() }).from(notifications)
            .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
        return row?.n ?? 0;
    }

    async markRead(userId: UserId, ids: readonly NotificationId[], at: Date): Promise<void> {
        if (ids.length === 0) return;
        await this.ctx.executor.update(notifications).set({ readAt: at })
            .where(and(eq(notifications.userId, userId), inArray(notifications.id, [...ids]), isNull(notifications.readAt)));
    }

    async markAllRead(userId: UserId, at: Date): Promise<void> {
        await this.ctx.executor.update(notifications).set({ readAt: at })
            .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    }
}
