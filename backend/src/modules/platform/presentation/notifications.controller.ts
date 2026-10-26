import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
    type MarkNotificationsReadRequest, type NotificationListDto, markNotificationsReadRequestSchema, notificationQuerySchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { ListNotificationsUseCase } from '../application/use-cases/list-notifications.use-case';
import { MarkNotificationsReadUseCase } from '../application/use-cases/mark-notifications-read.use-case';
import { toNotificationListDto } from './platform.mapper';

/** The signed-in user's own notifications (the bell). */
@Controller('notifications')
export class NotificationsController {
    constructor(
        private readonly listNotifications: ListNotificationsUseCase,
        private readonly markRead: MarkNotificationsReadUseCase,
    ) {}

    @Get()
    async list(
        @CurrentUser() user: AuthenticatedUser,
        @Query(new ZodPipe(notificationQuerySchema)) query: { limit: number },
    ): Promise<NotificationListDto> {
        return toNotificationListDto(unwrap(await this.listNotifications.execute({ actorId: user.userId, limit: query.limit })));
    }

    @Post('read')
    @HttpCode(HttpStatus.NO_CONTENT)
    async read(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodPipe(markNotificationsReadRequestSchema)) body: MarkNotificationsReadRequest,
    ): Promise<void> {
        unwrap(await this.markRead.execute({ actorId: user.userId, ids: body.ids, all: body.all }));
    }
}
