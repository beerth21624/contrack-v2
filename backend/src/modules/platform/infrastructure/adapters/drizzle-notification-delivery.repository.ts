import { asc, eq } from 'drizzle-orm';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { notificationDeliveries } from '../../../../shared/infrastructure/database/schema-platform';
import { NotificationDeliveryRepository } from '../../application/ports/notification-delivery.repository';
import { NotificationDelivery } from '../../domain/entities/notification-delivery.entity';
import { asDeliveryId, asNotificationId } from '../../domain/platform-ids';

type Row = typeof notificationDeliveries.$inferSelect;

const toEntity = (row: Row): NotificationDelivery => NotificationDelivery.rehydrate({
    id: asDeliveryId(row.id),
    notificationId: row.notificationId === null ? null : asNotificationId(row.notificationId),
    channel: row.channel,
    toAddress: row.toAddress,
    body: row.body,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
});

/** Postgres outbox. `withQueued` locks a batch with `for update skip locked`, so several instances never send twice. */
export class DrizzleNotificationDeliveryRepository extends NotificationDeliveryRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insertMany(items: readonly NotificationDelivery[]): Promise<void> {
        if (items.length === 0) return;
        await this.ctx.executor.insert(notificationDeliveries).values(items.map(item => {
            const p = item.toProps();
            return {
                id: p.id, notificationId: p.notificationId, channel: p.channel, toAddress: p.toAddress, body: p.body,
                status: p.status, attempts: p.attempts, lastError: p.lastError, createdAt: p.createdAt, sentAt: p.sentAt,
            };
        }));
    }

    withQueued(limit: number, work: (items: NotificationDelivery[]) => Promise<void>): Promise<number> {
        return this.ctx.transaction(async () => {
            const rows = await this.ctx.executor.select().from(notificationDeliveries)
                .where(eq(notificationDeliveries.status, 'queued'))
                .orderBy(asc(notificationDeliveries.createdAt))
                .limit(limit)
                .for('update', { skipLocked: true });
            if (rows.length === 0) return 0;
            const items = rows.map(toEntity);
            await work(items);
            for (const item of items) {
                const p = item.toProps();
                await this.ctx.executor.update(notificationDeliveries)
                    .set({ status: p.status, attempts: p.attempts, lastError: p.lastError, sentAt: p.sentAt, body: p.body })
                    .where(eq(notificationDeliveries.id, p.id));
            }
            return items.length;
        });
    }
}
