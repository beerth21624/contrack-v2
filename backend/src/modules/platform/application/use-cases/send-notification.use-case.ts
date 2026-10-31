import { Injectable } from '@nestjs/common';
import type { UserLocale } from '@contrack/contract';
import { AppLinks, Clock, IdGenerator, type NotificationRequest, UnitOfWork } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, ok } from '../../../../shared/domain/result';
import { Notification } from '../../domain/entities/notification.entity';
import { type DeliveryChannel, NotificationDelivery } from '../../domain/entities/notification-delivery.entity';
import { type NotificationId, asDeliveryId, asNotificationId } from '../../domain/platform-ids';
import { NotificationChannels } from '../ports/notification-channel.port';
import { NotificationDeliveryRepository } from '../ports/notification-delivery.repository';
import { NotificationRepository } from '../ports/notification.repository';
import { RecipientDirectory } from '../ports/recipient-directory.port';
import { type RenderedNotification, SMS_WORTHY_TEMPLATES, renderNotification } from '../services/notification-templates';

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
 * in-app notification per user in that user's language (`users.locale`) and queues SMS (the explicit `toPhone`; users with a phone for SMS-worthy templates) and
 * LINE (users who linked LINE, when LINE is configured). Sending happens in the background (DeliverQueuedUseCase).
 */
@Injectable()
export class SendNotificationUseCase {
    constructor(
        private readonly recipients: RecipientDirectory,
        private readonly notifications: NotificationRepository,
        private readonly deliveries: NotificationDeliveryRepository,
        private readonly channels: NotificationChannels,
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
        const rendered = new Map<UserLocale, RenderedNotification>();
        const textIn = (locale: UserLocale): RenderedNotification => {
            let text = rendered.get(locale);
            if (text === undefined) {
                text = renderNotification(request.template, request.payload, url, locale);
                rendered.set(locale, text);
            }
            return text;
        };
        const lineOn = this.channels.get('line')?.enabled === true;

        const people = await this.recipients.resolve(request.toUserIds ?? [], request.toWorkspaceIds ?? []);
        const rows: Notification[] = [];
        const queued: NotificationDelivery[] = [];
        const phonesDone = new Set<string>();
        const queue = (channel: DeliveryChannel, toAddress: string, notificationId: NotificationId | null, body: string): void => {
            queued.push(NotificationDelivery.queue({
                id: asDeliveryId(this.ids.newId()), notificationId, channel, toAddress, body, now,
            }));
        };
        const queueSms = (rawPhone: string, notificationId: NotificationId | null, body: string): void => {
            const phone = normalisePhone(rawPhone);
            if (phone === '' || phonesDone.has(phone)) return;
            phonesDone.add(phone);
            queue('sms', phone, notificationId, body);
        };

        for (const person of people) {
            const text = textIn(person.locale);
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
            if (person.phone !== null && SMS_WORTHY_TEMPLATES.has(request.template)) queueSms(person.phone, notification.id, text.short);
            if (person.lineUserId !== null && lineOn) queue('line', person.lineUserId, notification.id, text.short);
        }
        // A phone that may have no account yet (invitations): SMS whatever the template, in Thai.
        if (request.toPhone !== undefined) queueSms(request.toPhone, null, textIn('th').short);

        if (rows.length > 0 || queued.length > 0) {
            await this.uow.run(async () => {
                if (rows.length > 0) await this.notifications.insertMany(rows);
                if (queued.length > 0) await this.deliveries.insertMany(queued);
            });
        }
        return ok({ notifications: rows.length, deliveries: queued.length });
    }
}
