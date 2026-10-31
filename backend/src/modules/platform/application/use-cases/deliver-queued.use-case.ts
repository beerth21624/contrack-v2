import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, ok } from '../../../../shared/domain/result';
import type { NotificationDelivery } from '../../domain/entities/notification-delivery.entity';
import { NotificationChannels } from '../ports/notification-channel.port';
import { NotificationDeliveryRepository } from '../ports/notification-delivery.repository';

export const DELIVERY_BATCH_SIZE = 50;

export interface DeliveryRunOutcome {
    sent: number;
    /** Failed this time; tried again on a later run. */
    retrying: number;
    /** Given up after MAX_DELIVERY_ATTEMPTS. */
    failed: number;
}

function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** One pass of the delivery worker: sends a batch of queued SMS / LINE messages and records failures (retry up to 3). */
@Injectable()
export class DeliverQueuedUseCase {
    private readonly logger = new Logger('NotificationDelivery');

    constructor(
        private readonly deliveries: NotificationDeliveryRepository,
        private readonly channels: NotificationChannels,
        private readonly clock: Clock,
    ) {}

    async execute(limit = DELIVERY_BATCH_SIZE): Promise<Result<DeliveryRunOutcome, DomainError>> {
        const outcome: DeliveryRunOutcome = { sent: 0, retrying: 0, failed: 0 };
        await this.deliveries.withQueued(limit, async items => {
            for (const item of items) await this.deliver(item, outcome);
        });
        return ok(outcome);
    }

    private async deliver(item: NotificationDelivery, outcome: DeliveryRunOutcome): Promise<void> {
        try {
            const channel = this.channels.get(item.channel);
            // TODO(e-mail): no e-mail channel yet, nothing queues these.
            if (channel === undefined) throw new Error(`${item.channel} delivery is not available`);
            const sent = await channel.send(item.toAddress, item.body);
            if (!sent.ok) throw new Error(sent.error.message);
            item.markSent(this.clock.now());
            outcome.sent += 1;
        } catch (error: unknown) {
            item.markAttemptFailed(describeError(error));
            if (item.status === 'failed') {
                outcome.failed += 1;
                this.logger.warn(`${item.channel} delivery ${item.id} failed for good: ${item.lastError ?? ''}`);
            } else {
                outcome.retrying += 1;
            }
        }
    }
}
