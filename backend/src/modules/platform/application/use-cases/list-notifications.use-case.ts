import { Injectable } from '@nestjs/common';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import { type Result, ok } from '../../../../shared/domain/result';
import type { Notification } from '../../domain/entities/notification.entity';
import { NotificationRepository } from '../ports/notification.repository';

export interface ListNotificationsInput {
    actorId: UserId;
    limit: number;
}

export interface NotificationList {
    items: Notification[];
    unread: number;
}

/** The caller's own notifications, newest first, with the number still unread. */
@Injectable()
export class ListNotificationsUseCase {
    constructor(private readonly notifications: NotificationRepository) {}

    async execute(input: ListNotificationsInput): Promise<Result<NotificationList, DomainError>> {
        const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 100);
        const [items, unread] = await Promise.all([
            this.notifications.listForUser(input.actorId, limit),
            this.notifications.countUnread(input.actorId),
        ]);
        return ok({ items, unread });
    }
}
