import { Injectable } from '@nestjs/common';
import { AppLinks, Clock, IdGenerator, type NotificationRequest, UnitOfWork } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, ok } from '../../../../shared/domain/result';
import { Notification } from '../../domain/entities/notification.entity';
import { type DeliveryChannel, NotificationDelivery } from '../../domain/entities/notification-delivery.entity';
import { type NotificationId, asDeliveryId, asNotificationId } from '../../domain/platform-ids';
import { LineSender } from '../ports/line-sender.port';
import { NotificationDeliveryRepository } from '../ports/notification-delivery.repository';
import { NotificationRepository } from '../ports/notification.repository';
import { RecipientDirectory } from '../ports/recipient-directory.port';
import { SMS_WORTHY_TEMPLATES, renderNotification } from '../services/notification-templates';

export interface SendNotificationOutcome {
    /** In-app rows written (one per recipient user). */
    notifications: number;
    /** Outside messages queued for the delivery worker. */
    deliveries: number;
}

/** The same phone written differently (spaces, dashes) gets one SMS. */
function normalisePhone(phone: string): string {
    return phone.replace(/[\s\-()]/g, '');
}

/**
 * Behind Notifier.notify: resolves the recipients (listed users + every member of the listed workspaces), writes one
 * in-app notification per user and queues SMS (the explicit `toPhone`; users with a phone for SMS-worthy templates) and
 * LINE (users who linked LINE, when LINE is configured). Sending happens in the background (DeliverQueuedUseCase).
 */
@Injectable()
export class SendNotificationUseCase {
    constructor(
        private readonly recipients: RecipientDirectory,
        private readonly notifications: NotificationRepository,
        private readonly deliveries: NotificationDeliveryRepository,
        private readonly line: LineSender,
        private readonly links: AppLinks,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(request: NotificationRequest): Promise<Result<SendNotificationOutcome, DomainError>> {
        const now = this.clock.now();
        const href = typeof request.payload.href === 'string' ? request.payload.href : '';
        const explicitUrl = typeof request.payload.url === 'string' && request.payload.url !== '' ? request.payload.url : undefined;
        const url = explicitUrl ?? (href === '' ? undefined : this.links.url(href));
        const text = renderNotification(request.template, request.payload, url);

        const people = await this.recipients.resolve(request.toUserIds ?? [], request.toWorkspaceIds ?? []);
        const rows: Notification[] = [];
        const queued: NotificationDelivery[] = [];
        const phonesDone = new Set<string>();
        const queue = (channel: DeliveryChannel, toAddress: string, notificationId: NotificationId | null): void => {
            queued.push(NotificationDelivery.queue({
                id: asDeliveryId(this.ids.newId()), notificationId, channel, toAddress, body: text.short, now,
            }));
        };
        const queueSms = (rawPhone: string, notificationId: NotificationId | null): void => {
            const phone = normalisePhone(rawPhone);
            if (phone === '' || phonesDone.has(phone)) return;
            phonesDone.add(phone);
            queue('sms', phone, notificationId);
        };

        for (const person of people) {
            const notification = Notification.create({
                id: asNotificationId(this.ids.newId()),
                userId: person.userId,
                template: request.template,
                title: text.title,
                body: text.body,
                href,
                payload: request.payload,
                createdAt: now,
            });
            rows.push(notification);
            if (person.phone !== null && SMS_WORTHY_TEMPLATES.has(request.template)) queueSms(person.phone, notification.id);
            if (person.lineUserId !== null && this.line.enabled) queue('line', person.lineUserId, notification.id);
        }
        // A phone that may have no account yet (invitations): SMS whatever the template.
        if (request.toPhone !== undefined) queueSms(request.toPhone, null);

        if (rows.length > 0 || queued.length > 0) {
            await this.uow.run(async () => {
                if (rows.length > 0) await this.notifications.insertMany(rows);
                if (queued.length > 0) await this.deliveries.insertMany(queued);
            });
        }
        return ok({ notifications: rows.length, deliveries: queued.length });
    }
}
