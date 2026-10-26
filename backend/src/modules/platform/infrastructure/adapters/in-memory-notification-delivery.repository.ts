import { NotificationDeliveryRepository } from '../../application/ports/notification-delivery.repository';
import { NotificationDelivery, type NotificationDeliveryProps } from '../../domain/entities/notification-delivery.entity';
import type { DeliveryId } from '../../domain/platform-ids';

/** Map-based; one `withQueued` batch at a time (stands in for `for update skip locked`). */
export class InMemoryNotificationDeliveryRepository extends NotificationDeliveryRepository {
    private readonly rows = new Map<DeliveryId, NotificationDeliveryProps>();
    private tail: Promise<unknown> = Promise.resolve();

    insertMany(items: readonly NotificationDelivery[]): Promise<void> {
        for (const item of items) this.rows.set(item.id, item.toProps());
        return Promise.resolve();
    }

    withQueued(limit: number, work: (items: NotificationDelivery[]) => Promise<void>): Promise<number> {
        const run = this.tail.then(async () => {
            const items = [...this.rows.values()]
                .filter(r => r.status === 'queued')
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                .slice(0, limit)
                .map(r => NotificationDelivery.rehydrate(r));
            if (items.length === 0) return 0;
            await work(items);
            for (const item of items) this.rows.set(item.id, item.toProps());
            return items.length;
        });
        this.tail = run.catch(() => undefined);
        return run;
    }

    /** Every delivery (tests and the e2e app read what was queued / sent). */
    all(): NotificationDelivery[] {
        return [...this.rows.values()].map(r => NotificationDelivery.rehydrate(r));
    }
}
