import type { NotificationDelivery } from '../../domain/entities/notification-delivery.entity';

/** Outbox of SMS / LINE / e-mail messages. */
export abstract class NotificationDeliveryRepository {
    abstract insertMany(items: readonly NotificationDelivery[]): Promise<void>;
    /**
     * Runs `work` with up to `limit` queued deliveries (oldest first), locked so that another server instance does not
     * send them too (Postgres: `for update skip locked` in a transaction; in memory: one batch at a time).
     * `work` changes the entities; every one of them is saved after it.
     */
    abstract withQueued(limit: number, work: (items: NotificationDelivery[]) => Promise<void>): Promise<number>;
}
