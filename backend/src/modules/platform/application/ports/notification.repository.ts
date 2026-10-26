import type { UserId } from '../../../../shared/domain/ids';
import type { Notification } from '../../domain/entities/notification.entity';
import type { NotificationId } from '../../domain/platform-ids';

/** In-app notifications. Every query is keyed by the recipient user (a user only ever sees their own). */
export abstract class NotificationRepository {
    abstract insertMany(items: readonly Notification[]): Promise<void>;
    /** Newest first. */
    abstract listForUser(userId: UserId, limit: number): Promise<Notification[]>;
    abstract countUnread(userId: UserId): Promise<number>;
    /** Marks the given notifications of `userId` read (ids of other users are ignored). */
    abstract markRead(userId: UserId, ids: readonly NotificationId[], at: Date): Promise<void>;
    abstract markAllRead(userId: UserId, at: Date): Promise<void>;
}
