import type { UserId } from '../../../../shared/domain/ids';
import { NotificationRepository } from '../../application/ports/notification.repository';
import { Notification, type NotificationProps } from '../../domain/entities/notification.entity';
import type { NotificationId } from '../../domain/platform-ids';

/** Map-based; stores snapshots (insertion order breaks ties of equal times, like the id order in Postgres). */
export class InMemoryNotificationRepository extends NotificationRepository {
    private readonly rows = new Map<NotificationId, NotificationProps>();

    insertMany(items: readonly Notification[]): Promise<void> {
        for (const item of items) this.rows.set(item.id, item.toProps());
        return Promise.resolve();
    }

    listForUser(userId: UserId, limit: number): Promise<Notification[]> {
        const mine = this.ofUser(userId).reverse()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return Promise.resolve(mine.slice(0, limit).map(r => Notification.rehydrate(r)));
    }

    countUnread(userId: UserId): Promise<number> {
        return Promise.resolve(this.ofUser(userId).filter(r => r.readAt === null).length);
    }

    markRead(userId: UserId, ids: readonly NotificationId[], at: Date): Promise<void> {
        for (const id of ids) {
            const row = this.rows.get(id);
            if (row?.userId === userId && row.readAt === null) this.rows.set(id, { ...row, readAt: new Date(at.getTime()) });
        }
        return Promise.resolve();
    }

    markAllRead(userId: UserId, at: Date): Promise<void> {
        for (const row of this.ofUser(userId)) {
            if (row.readAt === null) this.rows.set(row.id, { ...row, readAt: new Date(at.getTime()) });
        }
        return Promise.resolve();
    }

    private ofUser(userId: UserId): NotificationProps[] {
        return [...this.rows.values()].filter(r => r.userId === userId);
    }
}
