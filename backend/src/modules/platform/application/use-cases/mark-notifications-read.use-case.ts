import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, isUuid } from '../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { asNotificationId } from '../../domain/platform-ids';
import { NotificationRepository } from '../ports/notification.repository';

export interface MarkNotificationsReadInput {
    actorId: UserId;
    ids?: readonly string[];
    all?: boolean;
}

/** Marks some (`ids`) or every (`all`) notification of the caller read. Ids of other users' notifications do nothing. */
@Injectable()
export class MarkNotificationsReadUseCase {
    constructor(private readonly notifications: NotificationRepository, private readonly clock: Clock) {}

    async execute(input: MarkNotificationsReadInput): Promise<Result<undefined, DomainError>> {
        const now = this.clock.now();
        if (input.all === true) {
            await this.notifications.markAllRead(input.actorId, now);
            return okVoid();
        }
        if (input.ids === undefined) return err(DomainError.validation('Give ids or all: true'));
        const ids = [...new Set(input.ids.filter(isUuid).map(id => asNotificationId(id.toLowerCase())))];
        if (ids.length > 0) await this.notifications.markRead(input.actorId, ids, now);
        return okVoid();
    }
}
